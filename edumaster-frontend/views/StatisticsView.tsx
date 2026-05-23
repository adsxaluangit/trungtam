
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Filter, Calendar, Users, BookOpen, CheckCircle, Clock, FileDown, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchCategory, COLLECTIONS } from '../services/api';
import { formatDate } from '../utils/dateUtils';

interface StatDecision {
    id: string;
    number: string;
    className: string;
    trainingCourse: string;
    signedDate: string; // ISO date string
    startDate: string;
    studentCount: number;
    status: 'Ongoing' | 'Completed'; // Completed if related_decision exists
    month: number;
    year: number;
    quarter: number;
    classId?: string;
    students?: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const StatisticsView: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<StatDecision[]>([]);
    const [filteredData, setFilteredData] = useState<StatDecision[]>([]);

    // Filters
    // Filters - Date Range
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6); // Default to last 6 months
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [uniqueClasses, setUniqueClasses] = useState<{ id: string, name: string }[]>([]);

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    // Filter Data when dependencies change
    useEffect(() => {
        filterData();
    }, [data, startDate, endDate, selectedClass]);

    // Extract unique classes when data changes
    useEffect(() => {
        const classesMap = new Map();
        data.forEach(d => {
            if (d.classId && d.className) {
                classesMap.set(d.classId, d.className);
            }
        });
        const classes = Array.from(classesMap.entries()).map(([id, name]) => ({ id, name }));
        setUniqueClasses(classes);
    }, [data]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch OPENING decisions with students and related_decision to determine status
            const response = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?populate[students]=true&populate[school_class]=true&populate[related_decision]=true`);

            if (response) {
                // Map and process intermediate data
                const processed = response
                    .filter((d: any) => d.type === 'OPENING')
                    .map((d: any) => {
                        const date = new Date(d.signed_date || d.created_at);
                        const month = date.getMonth() + 1;
                        const year = date.getFullYear();
                        const quarter = Math.ceil(month / 3);

                        return {
                            raw: d,
                            month,
                            year,
                            quarter
                        };
                    });

                // We actually need the full list to cross-reference
                const recognitionDecisions = response.filter((d: any) => d.type === 'RECOGNITION');
                const finalizedIds = new Set(
                    recognitionDecisions.map((d: any) => {
                        const rel = d.related_decision?.data || d.related_decision;
                        return String(rel?.documentId || rel?.id || '');
                    }).filter((id: string) => id !== '')
                );

                const finalData: StatDecision[] = processed.map((item: any) => {
                    const d = item.raw;
                    const id = String(d.documentId || d.id);
                    return {
                        id: id,
                        number: d.decision_number,
                        className: d.school_class?.data?.attributes?.name || d.school_class?.name || 'Lớp chưa đặt tên',
                        trainingCourse: d.training_course || 'K.01',
                        signedDate: d.signed_date,
                        startDate: d.start_date || d.signed_date,
                        studentCount: d.students?.data?.length || d.students?.length || 0,
                        status: finalizedIds.has(id) ? 'Completed' : 'Ongoing',
                        month: item.month,
                        year: item.year,
                        quarter: item.quarter,
                        classId: d.school_class?.data?.documentId || d.school_class?.documentId || d.school_class?.data?.id || d.school_class?.id,
                        students: d.students?.data || d.students || []
                    };
                });

                setData(finalData);
            }
        } catch (e) {
            console.error("Failed to load statistics data", e);
        } finally {
            setLoading(false);
        }
    };

    const filterData = () => {
        let res = data;

        // Filter by Date Range
        if (startDate) {
            res = res.filter(d => d.signedDate >= startDate);
        }
        if (endDate) {
            res = res.filter(d => d.signedDate <= endDate);
        }

        // Filter by Class
        if (selectedClass !== 'all') {
            res = res.filter(d => d.classId === selectedClass);
        }

        setFilteredData(res);
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const wsData = filteredData.map((d, index) => ({
            "STT": index + 1,
            "Số Quyết Định": d.number,
            "Tên Lớp": d.className,
            "Khóa": d.trainingCourse,
            "Ngày Ký": d.signedDate ? formatDate(d.signedDate) : '',
            "Sĩ Số": d.studentCount,
            "Trạng Thái": d.status === 'Completed' ? 'Đã tốt nghiệp' : 'Đang đào tạo',
            "Năm": d.year,
            "Quý": d.quarter,
            "Tháng": d.month
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "ThongKeDaoTao");
        XLSX.writeFile(wb, `ThongKeDaoTao_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportSummary = async () => {
        try {
            // Fetch all training assignments with populated decision and class
            // Relation name is 'decision', not 'class_decision'
            const assignments = await fetchCategory(`${COLLECTIONS.TRAINING_ASSIGNMENTS}?populate[decision][populate][school_class]=true&pagination[limit]=1000`);

            if (!assignments) {
                alert("Không có dữ liệu phân công giảng dạy.");
                return;
            }

            // Get IDs of filtered decisions (from the current view)
            const filteredDecisionIds = new Set(filteredData.map(d => d.id));

            // Filter assignments that belong to the visible decisions
            const relevantAssignments = assignments.filter((a: any) => {
                // Check direct relation 'decision'
                const decisionData = a.decision?.data || a.decision;
                if (!decisionData) return false;

                const decisionId = String(decisionData.documentId || decisionData.id || '');
                return filteredDecisionIds.has(decisionId);
            });

            if (relevantAssignments.length === 0) {
                alert("Không tìm thấy dữ liệu phân công phù hợp với bộ lọc hiện tại.");
                return;
            }

            // Prepare Excel Data
            // Each assignment entity has a 'schedule' JSON field containing array of rows
            let wsData: any[] = [];
            let stt = 1;

            relevantAssignments.forEach((assignment: any) => {
                const decisionData = assignment.decision?.data || assignment.decision;
                const classData = decisionData?.attributes?.school_class?.data || decisionData?.school_class?.data || decisionData?.school_class;

                const className = classData?.attributes?.name || classData?.name || "N/A";
                const course = decisionData?.attributes?.training_course || decisionData?.training_course || "N/A";

                const schedule = assignment.schedule || []; // JSON field

                if (Array.isArray(schedule)) {
                    schedule.forEach((row: any) => {
                        wsData.push({
                            "STT": stt++,
                            "Lớp": className,
                            "Khóa": course,
                            "Môn học": row.subjectName || "N/A",
                            "Giảng viên": row.teacherName || "Chưa phân công",
                            "Ngày học": row.date ? new Date(row.date).toLocaleDateString('vi-VN') : "N/A",
                            "Buổi": row.shift || "N/A",
                            "Ghi chú": row.notes || ""
                        });
                    });
                }
            });

            if (wsData.length === 0) {
                alert("Dữ liệu phân công trống (chưa có lịch học).");
                return;
            }

            // Create Workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(wsData);

            // Auto-width columns
            const wscols = [
                { wch: 5 },  // STT
                { wch: 25 }, // Lop
                { wch: 10 }, // Khoa
                { wch: 30 }, // Mon hoc
                { wch: 25 }, // Giang vien
                { wch: 15 }, // Ngay
                { wch: 10 }, // Buoi
                { wch: 20 }  // Ghi chu
            ];
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "TongHopGiangDay");
            XLSX.writeFile(wb, `TongHopGiangDay_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (error: any) {
            console.error("Export failed", error);
            alert("Có lỗi khi xuất dữ liệu: " + (error.message || error));
        }
    };

    const handleExportStudentSummary = () => {
        const completed = filteredData.filter(d => d.status === 'Completed');
        if (completed.length === 0) {
            alert("Không có lớp học nào đã hoàn thành trong bộ lọc hiện tại.");
            return;
        }

        let wsData: any[] = [];
        let stt = 1;

        completed.forEach(d => {
            const students = d.students || [];
            students.forEach((s: any) => {
                // Handle Strapi v4/v5 nested or flattened structure
                const student = s.attributes || s;
                
                // Get name from possible fields
                const name = student.fullName || student.name || student.full_name || "...";
                
                // Use the shared formatDate utility for dd/mm/yyyy
                const dob = student.dob ? formatDate(student.dob) : "...";

                wsData.push({
                    "STT": stt++,
                    "Họ và Tên": name,
                    "CCCD": student.id_number || student.idNumber || student.student_code || '',
                    "Ngày sinh": dob,
                    "Lớp": d.className,
                    "Khóa": d.trainingCourse,
                    "Số QĐ": d.number,
                    "Ghi chú": student.notes || ""
                });
            });
        });

        if (wsData.length === 0) {
            alert("Không có dữ liệu học viên để xuất.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "TongHopHocVien");
        XLSX.writeFile(wb, `TongHopHocVien_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // --- Calculations for UI ---
    const totalClasses = filteredData.length;
    const totalStudents = filteredData.reduce((sum, d) => sum + d.studentCount, 0);
    const ongoingClasses = filteredData.filter(d => d.status === 'Ongoing').length;
    const completedClasses = filteredData.filter(d => d.status === 'Completed').length;

    // Chart Data: Students per Class (Top 10 ?)
    const classData = filteredData.slice(0, 15).map(d => ({
        name: `${d.className} (${d.trainingCourse})`,
        students: d.studentCount
    }));

    // Chart Data: Group by Month within the selected range
    const getChartData = () => {
        if (!startDate || !endDate) return [];
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const chartMap = new Map();

        // Generate all months between start and end
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
            const label = `${current.getMonth() + 1}/${current.getFullYear()}`;
            chartMap.set(label, { name: label, classes: 0, students: 0, sortKey: current.getTime() });
            current.setMonth(current.getMonth() + 1);
        }

        // If range is within 1 month, maybe show daily? For now stick to months or specific labels
        if (chartMap.size === 0) {
             const label = `${start.getMonth() + 1}/${start.getFullYear()}`;
             chartMap.set(label, { name: label, classes: 0, students: 0, sortKey: start.getTime() });
        }

        filteredData.forEach(d => {
            const date = new Date(d.signedDate);
            const label = `${date.getMonth() + 1}/${date.getFullYear()}`;
            if (chartMap.has(label)) {
                const val = chartMap.get(label);
                val.classes += 1;
                val.students += d.studentCount;
            }
        });

        return Array.from(chartMap.values()).sort((a, b) => a.sortKey - b.sortKey);
    };

    const monthlyData = getChartData();

    // Chart Data: Status Distribution
    const statusData = [
        { name: 'Đang đào tạo', value: ongoingClasses },
        { name: 'Đã hoàn thành', value: completedClasses }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Thống kê đào tạo</h1>
                    <p className="text-slate-500 mt-1">Tổng hợp số liệu về các lớp học, học viên và tiến độ đào tạo.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Class Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <BookOpen size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">Lớp:</span>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="bg-transparent font-bold text-slate-700 outline-none text-sm max-w-[200px]"
                        >
                            <option value="all">Tất cả</option>
                            {uniqueClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Start */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">Từ ngày:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent font-bold text-slate-700 outline-none text-sm cursor-pointer"
                        />
                    </div>

                    {/* Date Range End */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">Đến ngày:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent font-bold text-slate-700 outline-none text-sm cursor-pointer"
                        />
                    </div>

                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <FileDown size={16} />
                        Xuất Excel
                    </button>
                    <button
                        onClick={handleExportSummary}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <FileText size={16} />
                        Tổng hợp
                    </button>
                    <button
                        onClick={handleExportStudentSummary}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Users size={16} />
                        TH Học viên
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><BookOpen size={24} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Tổng lớp</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{totalClasses}</div>
                    <div className="text-xs text-slate-500 mt-1">Lớp được mở trong kỳ</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Users size={24} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Học viên</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{totalStudents}</div>
                    <div className="text-xs text-slate-500 mt-1">Tổng số lượt đào tạo</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><Clock size={24} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Đang học</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{ongoingClasses}</div>
                    <div className="text-xs text-slate-500 mt-1">Lớp chưa kết thúc</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CheckCircle size={24} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Hoàn thành</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{completedClasses}</div>
                    <div className="text-xs text-slate-500 mt-1">Đã có quyết định công nhận</div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart: Classes/Students per Month */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Biểu đồ Đào tạo theo Tháng</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Legend />
                                <Bar dataKey="classes" name="Số lớp" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="students" name="Số học viên" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Side Chart: Status Distribution */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Tỷ lệ hoàn thành</h3>
                    <div className="flex-1 w-full min-h-[300px] flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#f97316' : '#22c55e'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center mt-[-20px]">
                                <div className="text-3xl font-black text-slate-800">{Math.round((completedClasses / (totalClasses || 1)) * 100)}%</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Hoàn thành</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Chi tiết các lớp học ({filteredData.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                            <tr>
                                <th className="px-6 py-3">Số Quyết Định</th>
                                <th className="px-6 py-3">Tên Lớp / Khóa</th>
                                <th className="px-6 py-3">Ngày Ký</th>
                                <th className="px-6 py-3 text-center">Sĩ số</th>
                                <th className="px-6 py-3">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map((d) => (
                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{d.number}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{d.className}</div>
                                        <div className="text-xs text-slate-500">Khóa: {d.trainingCourse}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{d.signedDate ? formatDate(d.signedDate) : ''}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold">
                                            {d.studentCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                    ${d.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {d.status === 'Completed' ? 'Đã tốt nghiệp' : 'Đang đào tạo'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                        Không có dữ liệu lớp học nào trong khoảng thời gian này.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StatisticsView;
