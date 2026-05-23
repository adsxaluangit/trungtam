import React, { useState, useEffect } from 'react';
import { Search, User, BookOpen, Award, FileText, Calendar, Paperclip, Download } from 'lucide-react';
import { fetchCategory, COLLECTIONS } from '../services/api';
import { downloadFile } from '../utils/fileUtils';

interface LookupViewProps {
    onRegisterAnother?: (student: any) => void;
}

const LookupView: React.FC<LookupViewProps> = ({ onRegisterAnother }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    // Data State
    const [classes, setClasses] = useState<any[]>([]);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [recognitionDecisions, setRecognitionDecisions] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sData, cData, dData] = await Promise.all([
                fetchCategory(COLLECTIONS.STUDENTS),
                fetchCategory(COLLECTIONS.CLASSES),
                fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?populate[students][populate]=documents&populate[school_class]=true`)
            ]);

            if (sData) {
                setStudents(sData.map((s: any) => {
                    const classData = s.school_class?.data || s.school_class;
                    return {
                        id: s.documentId || s.id,
                        studentCode: s.student_code || s.code || '',
                        idNumber: s.id_number || s.card_number || '',
                        fullName: s.full_name || '',
                        dob: s.dob || '',
                        pob: s.pob || '',
                        gender: s.gender || '',
                        phone: s.phone || '',
                        email: s.email || '',
                        className: classData?.name || s.class_name || '',
                        trainingCourse: s.training_course || '',
                        photo: s.photo || null,
                        documents: (s.documents?.data || s.documents || []).map((doc: any) => ({
                            id: doc.documentId || doc.id,
                            name: doc.name,
                            url: doc.url,
                            type: doc.type
                        }))
                    };
                }));
            }

            if (cData) setClasses(cData);

            if (dData) {
                const openDecs = dData.filter((d: any) => d.type === 'OPENING').map((d: any) => ({
                    id: d.documentId || d.id,
                    number: d.decision_number,
                    className: d.school_class?.data?.name || d.school_class?.name || '',
                    trainingCourse: d.training_course,
                    signedDate: d.signed_date,
                    students: (d.students?.data || d.students || []).map((s: any) => ({
                        id: s.documentId || s.id,
                        studentCode: s.student_code || s.code || '',
                        documents: (s.documents?.data || s.documents || []).map((doc: any) => ({
                            id: doc.documentId || doc.id,
                            name: doc.name,
                            url: doc.url,
                            type: doc.type
                        }))
                    }))
                }));
                setDecisions(openDecs);

                const recDecs = dData.filter((d: any) => d.type === 'RECOGNITION').map((d: any) => ({
                    id: d.documentId || d.id,
                    number: d.decision_number,
                    className: d.school_class?.data?.name || d.school_class?.name || '',
                    trainingCourse: d.training_course,
                    signedDate: d.signed_date,
                    students: (d.students?.data || d.students || []).map((s: any) => ({
                        id: s.documentId || s.id,
                        studentCode: s.student_code || s.code || '',
                        fullName: s.full_name || s.fullName || '',
                        dob: s.dob || '',
                        pob: s.pob || '',
                        gender: s.gender || '',
                        rank: s.rank || 'Hoàn thành',
                        photo: s.photo || null,
                        documents: (s.documents?.data || s.documents || []).map((doc: any) => ({
                            id: doc.documentId || doc.id,
                            name: doc.name,
                            url: doc.url,
                            type: doc.type
                        }))
                    }))
                }));
                setRecognitionDecisions(recDecs);
            }
        } catch (error) {
            console.error("Failed to load lookup data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            setFilteredStudents([]);
            return;
        }

        const term = searchTerm.toLowerCase();

        // 1. Search in main Student List
        const mainResults = students.filter(s =>
            s.fullName?.toLowerCase().includes(term) ||
            s.studentCode?.toLowerCase().includes(term) ||
            s.idNumber?.toLowerCase().includes(term) ||
            s.phone?.includes(term)
        );

        // 2. Search in Recognition Decisions
        const recognitionResults: any[] = [];
        recognitionDecisions.forEach(decision => {
            if (decision.students) {
                const matches = decision.students.filter((s: any) =>
                    s.fullName?.toLowerCase().includes(term) ||
                    s.studentCode?.toLowerCase().includes(term) ||
                    s.idNumber?.toLowerCase().includes(term) ||
                    s.cardNumber?.toLowerCase().includes(term)
                );
                recognitionResults.push(...matches);
            }
        });

        // Identify which IDs are recognized and their course info
        const recInfoMap = new Map();
        recognitionDecisions.forEach(d => {
            d.students?.forEach((s: any) => {
                recInfoMap.set(s.studentCode, {
                    className: d.className,
                    trainingCourse: d.trainingCourse
                });
            });
        });

        // 3. Merge and Deduplicate by studentCode
        const combinedMap = new Map();

        // Add main student records first
        mainResults.forEach(s => {
            const recInfo = recInfoMap.get(s.studentCode);
            if (recInfo) { // Only if they have a recognition record
                combinedMap.set(s.studentCode, {
                    ...s,
                    isRecognized: true,
                    displayClassName: s.className || recInfo?.className,
                    displayTrainingCourse: s.trainingCourse || recInfo?.trainingCourse
                });
            }
        });

        // Add recognition records as fallback for students not in main list
        recognitionResults.forEach(s => {
            if (!combinedMap.has(s.studentCode)) {
                const recInfo = recInfoMap.get(s.studentCode);
                combinedMap.set(s.studentCode, {
                    ...s,
                    id: s.id || `temp-${s.studentCode}`,
                    isRecognized: true,
                    displayClassName: s.className || recInfo?.className,
                    displayTrainingCourse: s.trainingCourse || recInfo?.trainingCourse
                });
            }
        });

        const finalResults = Array.from(combinedMap.values());
        setFilteredStudents(finalResults);
        setSelectedStudent(null);
    };

    const getStudentHistory = (studentCode: string) => {
        // Find Recognized Classes (from Recognition Decisions)
        const studentRecDecisions = recognitionDecisions.filter(d =>
            d.students?.some((s: any) => s.studentCode === studentCode)
        );

        return {
            recognition: studentRecDecisions
        };
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Tra cứu thông tin</h1>
                    <p className="text-slate-500">Tìm kiếm thông tin học viên, lịch sử đào tạo và văn bằng.</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhập từ khóa tìm kiếm</label>
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Tìm theo Tên, Mã học viên (CCCD), Số điện thoại..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                    >
                        Tìm kiếm
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Results List */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-700">Kết quả tìm kiếm ({filteredStudents.length})</h3>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {filteredStudents.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 italic">
                                {searchTerm ? 'Không tìm thấy kết quả.' : 'Vui lòng nhập từ khóa để tìm kiếm.'}
                            </div>
                        ) : (
                            filteredStudents.map(student => (
                                <div
                                    key={student.id}
                                    onClick={() => setSelectedStudent(student)}
                                    className={`p-4 rounded-xl cursor-pointer border transition-all hover:shadow-md
                    ${selectedStudent?.id === student.id
                                            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500'
                                            : 'bg-white border-slate-100 hover:border-blue-200'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-16 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden shadow-sm">
                                            {student.photo ? (
                                                <img src={student.photo} alt={student.fullName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center text-lg font-bold
                                                  ${selectedStudent?.id === student.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    {student.fullName?.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div className="font-bold text-slate-900 truncate">{student.fullName}</div>
                                                {student.isRecognized && (
                                                    <span className="bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Đã TN</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">{student.studentCode}</div>
                                            <div className="mt-2 flex flex-col gap-1">
                                                {student.displayClassName && (
                                                    <div className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-medium inline-block w-fit">
                                                        {student.displayClassName}
                                                    </div>
                                                )}
                                                {student.displayTrainingCourse && (
                                                    <div className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-medium inline-block w-fit italic">
                                                        {student.displayTrainingCourse}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail View */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
                    {selectedStudent ? (
                        <div className="flex-1 overflow-y-auto">
                            {/* Header */}
                            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-20 h-28 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl font-bold border border-white/30 overflow-hidden shadow-lg">
                                            {selectedStudent.photo ? (
                                                <img src={selectedStudent.photo} alt={selectedStudent.fullName} className="w-full h-full object-cover" />
                                            ) : (
                                                selectedStudent.fullName?.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">{selectedStudent.fullName}</h2>
                                            <div className="flex gap-4 mt-2 text-blue-100 text-sm">
                                                <span className="flex items-center gap-1"><User size={14} /> {selectedStudent.gender || 'N/A'}</span>
                                                <span className="flex items-center gap-1"><Calendar size={14} /> {selectedStudent.dob}</span>
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-md font-mono">{selectedStudent.studentCode}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {onRegisterAnother && (
                                        <button
                                            onClick={() => onRegisterAnother(selectedStudent)}
                                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold border border-white/20 transition-all flex items-center gap-2 backdrop-blur"
                                        >
                                            <User size={16} className="text-blue-200" />
                                            Đăng ký lớp khác
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-8">


                                {/* Training History */}
                                <div>
                                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                                        <BookOpen className="text-blue-600" size={20} /> Lịch sử đào tạo
                                    </h3>

                                    <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Văn bằng / Chứng chỉ đã cấp</h4>
                                    {getStudentHistory(selectedStudent.studentCode).recognition.length > 0 ? (
                                        <div className="space-y-4">
                                            {getStudentHistory(selectedStudent.studentCode).recognition.map((dec: any, idx: number) => {
                                                // Find student specific data in decision
                                                const sData = dec.students.find((s: any) => s.studentCode === selectedStudent.studentCode);
                                                return (
                                                    <div key={idx} className="bg-green-50 p-4 rounded-xl border border-green-100">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <div className="font-bold text-slate-900 text-lg">{dec.className}</div>
                                                                <div className="text-slate-500 text-sm">{dec.trainingCourse}</div>
                                                            </div>
                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                                      ${sData?.rank === 'Xuất sắc' ? 'bg-purple-100 text-purple-700' :
                                                                    sData?.rank === 'Giỏi' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {sData?.rank || 'Hoàn thành'}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t border-green-200/50">
                                                            <div>
                                                                <span className="text-slate-400 text-xs block">Quyết định số</span>
                                                                <span className="font-mono font-medium text-slate-700">{dec.number}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 text-xs block">Ngày ký</span>
                                                                <span className="font-medium text-slate-700">{dec.signedDate}</span>
                                                            </div>
                                                        </div>

                                                        {/* Document Download on Card */}
                                                        {sData?.documents && sData.documents.length > 0 && (
                                                            <div className="mt-4 pt-3 border-t border-green-200/50">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {sData.documents.map((doc: any, dIdx: number) => (
                                                                        <button
                                                                            key={dIdx}
                                                                            onClick={() => downloadFile(doc.url, doc.name)}
                                                                            className="flex items-center gap-2 bg-white text-green-700 px-3 py-1.5 rounded-lg border border-green-200 text-xs font-bold hover:bg-green-100 transition-all shadow-sm"
                                                                        >
                                                                            <Download size={14} /> {doc.name.length > 20 ? doc.name.substring(0, 20) + '...' : doc.name}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                                            Chưa có dữ liệu khóa học / văn bằng đã tốt nghiệp.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Search size={32} className="opacity-50" />
                            </div>
                            <p>Chọn một học viên để xem chi tiết</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LookupView;
