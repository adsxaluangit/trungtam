import React, { useState, useEffect } from 'react';
import { Search, Calculator, Save, BookOpen, Users, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { fetchCategory, fetchCategoryAll, createCategory, updateCategory, fetchItem, COLLECTIONS } from '../services/api';

// Interfaces
interface DecisionRecord {
    id: string; // documentId
    strapiId?: number;
    documentId?: string;
    number: string;
    className: string;
    classCode: string;
    trainingCourse: string;
    classId: string;
    studentCount: number;
    signedDate?: string;
    students?: any; // Can be array or { data: [] }
}

interface Student {
    id: string;
    studentCode: string;
    fullName: string;
    dob: string;
    gender: string;
}

interface Subject {
    id: string;
    strapiId?: number;
    code: string;
    name: string;
    hasTheory?: boolean;
    hasPractice?: boolean;
}

interface ApprovalRecord {
    practicePass: boolean;
    theoryApproved: boolean;
}

interface GradeData {
    theory: string;
    practice: string;
}

const GradeEntryView: React.FC = () => {
    // Data State
    const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Context Data for Modal
    const [decisionStudents, setDecisionStudents] = useState<Student[]>([]);
    const [decisionSubjects, setDecisionSubjects] = useState<Subject[]>([]);

    // Approvals: Map<subjectId, Map<studentCode, ApprovalRecord>>
    const [approvals, setApprovals] = useState<Record<string, Record<string, ApprovalRecord>>>({});

    // Grades: Record<studentCode, { theory, practice }>
    const [inputGrades, setInputGrades] = useState<Record<string, GradeData>>({});
    const [currentGradeId, setCurrentGradeId] = useState<string | null>(null); // documentId of exam-grade record

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [decisionsData, subjectsData] = await Promise.all([
                fetchCategoryAll(`${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students][count]=true`, ''),
                fetchCategoryAll(COLLECTIONS.SUBJECTS, 'populate=*')
            ]);

            const allDecs = decisionsData || [];

            // 1. Identify IDs of Opening decisions that already have a Recognition decision
            const finalizedOpeningIds = new Set(
                allDecs
                    .filter((d: any) => d.type === 'RECOGNITION')
                    .map((d: any) => {
                        const rel = d.related_decision?.data || d.related_decision;
                        return String(rel?.documentId || rel?.id || '');
                    })
                    .filter((id: string) => id !== '')
            );

            const activeOpeningDecisions = allDecs.filter((d: any) => {
                const isOpening = d.type === 'OPENING';
                const classData = d.school_class?.data || d.school_class;
                const isNotFinalized = !finalizedOpeningIds.has(String(d.documentId || d.id));
                return isOpening && !!classData && isNotFinalized;
            }).map((d: any) => ({
                id: d.documentId || d.id,
                strapiId: d.id,
                documentId: d.documentId,
                number: d.decision_number,
                className: (d.school_class?.data?.attributes?.name || d.school_class?.name || d.school_class?.attributes?.name),
                classCode: (d.school_class?.data?.attributes?.code || d.school_class?.code || d.school_class?.attributes?.code || ''),
                classId: (d.school_class?.data?.documentId || d.school_class?.documentId || d.school_class?.data?.id || d.school_class?.id),
                trainingCourse: d.training_course,
                signedDate: d.signed_date,
                studentCount: (d.students?.count ?? (d.students?.data?.length || d.students?.length || 0)),
                students: [], // Save memory, don't keep full list
                type: d.type
            }));

            setDecisions(activeOpeningDecisions);
            // Keep track of recognized student IDs globally or locally
            const recognizedIds = new Set<string>();
            allDecs.filter((d: any) => d.type === 'RECOGNITION').forEach((d: any) => {
                const sData = d.students?.data || d.students || [];
                sData.forEach((s: any) => recognizedIds.add(String(s.documentId || s.id)));
            });
            (window as any)._recognizedIds = recognizedIds; // Temporary hack to pass data without new state if preferred, but let's use a better way if possible. Actually, I can just filter in handleDecisionSelect by fetching again or using the data.


            const mappedSubjects = (subjectsData || []).map((s: any) => ({
                id: String(s.id),
                strapiId: s.strapiId,
                code: s.code,
                name: s.name,
                hasTheory: s.has_theory !== false,
                hasPractice: s.has_practice === true
            }));
            setSubjects(mappedSubjects);

        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Decisions
    const filteredDecisions = decisions.filter(d =>
        (d.number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.className || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.classCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handlers
    const handleDecisionSelect = async (decision: DecisionRecord) => {
        setSelectedDecision(decision);
        setLoading(true);

        try {
            // 1. Fetch Class Subjects
            let classSubs: Subject[] = [];
            if (decision.classId) {
                try {
                    const classDetail = await fetchItem(COLLECTIONS.CLASSES, decision.classId);
                    let rawSubs: any[] = [];
                    if (classDetail) {
                        if (Array.isArray(classDetail.subjects)) rawSubs = classDetail.subjects;
                        else if (classDetail.subjects?.data) rawSubs = classDetail.subjects.data;
                        else if (classDetail.data?.attributes?.subjects?.data) rawSubs = classDetail.data.attributes.subjects.data;
                    }
                    classSubs = rawSubs.map((s: any) => ({
                        id: String(s.id),
                        strapiId: s.strapiId,
                        code: s.code,
                        name: s.name,
                        hasTheory: s.has_theory !== false,
                        hasPractice: s.has_practice === true
                    }));
                } catch (e) { console.warn(e); }
            }
            if (classSubs.length === 0) classSubs = subjects;
            setDecisionSubjects(classSubs);

            // 2. Fetch Students and filter out those already recognized
            const allDecsForFilter = await fetchCategoryAll(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&populate[students][fields][0]=id`, '');
            const recognizedInAny = new Set<string>();
            (allDecsForFilter || []).forEach((d: any) => {
                const sData = d.students?.data || d.students || [];
                sData.forEach((s: any) => recognizedInAny.add(String(s.documentId || s.id)));
            });

            let rawStudents = [];
            const decisionId = decision.documentId || decision.id;
            const fullDecisionRaw = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${decisionId}&populate[students][populate]=*`);
            
            if (fullDecisionRaw && fullDecisionRaw.length > 0) {
                const fd = fullDecisionRaw[0];
                if (fd.students) {
                    if (Array.isArray(fd.students)) rawStudents = fd.students;
                    else if (fd.students.data) rawStudents = fd.students.data;
                }
            }

            const mappedStudents: Student[] = rawStudents
                .map((s: any) => ({
                    id: String(s.documentId || s.id),
                    studentCode: s.student_code || s.code || s.studentCode || '',
                    fullName: s.full_name || s.name || s.fullName || '',
                    dob: s.dob || s.date_of_birth || '',
                    gender: s.gender || ''
                }))
                .filter(s => !recognizedInAny.has(s.id)) // Filter out recognized students
                .sort((a, b) => {
                    const nameA = a.fullName.split(' ').pop() || '';
                    const nameB = b.fullName.split(' ').pop() || '';
                    return nameA.localeCompare(nameB);
                });
            setDecisionStudents(mappedStudents);

            // 3. Fetch Existing Approvals (for checking eligibility)
            await loadExistingApprovals(decision.documentId || decision.id);

            // 4. Fetch Existing Grades
            await loadExistingGrades(decision.documentId || decision.id);

            setSelectedSubjectId(null);
            setIsModalOpen(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadExistingApprovals = async (decisionId: string) => {
        setApprovals({});
        try {
            const query = `${COLLECTIONS.EXAM_APPROVALS}?filters[decision][documentId][$eq]=${decisionId}`;
            const res = await fetchCategory(query);
            if (res && res.length > 0) {
                if (res[0].approvals) {
                    const rawApprovals = res[0].approvals;
                    const normalized: Record<string, Record<string, ApprovalRecord>> = {};

                    Object.keys(rawApprovals).forEach(subId => {
                        const val = rawApprovals[subId];
                        normalized[subId] = {};
                        if (Array.isArray(val)) {
                            // Legacy format: array of codes
                            val.forEach((code: string) => {
                                normalized[subId][code] = { practicePass: true, theoryApproved: true };
                            });
                        } else {
                            // New format: object
                            normalized[subId] = val;
                        }
                    });
                    setApprovals(normalized);
                }
            }
        } catch (e) { console.warn(e); }
    };

    const loadExistingGrades = async (decisionId: string) => {
        setInputGrades({});
        setCurrentGradeId(null);
        try {
            const query = `${COLLECTIONS.EXAM_GRADES}?filters[decision][documentId][$eq]=${decisionId}`;
            const res = await fetchCategory(query);
            if (res && res.length > 0) {
                const record = res[0];
                setCurrentGradeId(record.documentId || record.id);
                if (record.grades) setInputGrades(record.grades); // { studentCode: { theory, practice } }
            }
        } catch (e) { console.warn(e); }
    };

    const handleGradeChange = (studentCode: string, type: 'theory' | 'practice', value: string) => {
        if (!selectedSubjectId) return;

        // Simple validation
        const num = parseFloat(value);
        if (value !== '' && (isNaN(num) || num < 0 || num > 10)) return;

        setInputGrades(prev => {
            const sub = decisionSubjects.find(s => s.id === selectedSubjectId);
            const subKey = String(sub?.strapiId || selectedSubjectId);
            const currentSubGrades = prev[subKey] as any || {};
            const studentGrades = currentSubGrades[studentCode] || { theory: '', practice: '' };

            return {
                ...prev,
                [subKey]: {
                    ...currentSubGrades,
                    [studentCode]: {
                        ...studentGrades,
                        [type]: value
                    }
                }
            };
        });
    };

    const handleSaveGrades = async () => {
        if (!selectedDecision) return;

        try {
            const payload = {
                decision: selectedDecision.strapiId || selectedDecision.id,
                grades: inputGrades
            };

            if (currentGradeId) {
                await updateCategory(COLLECTIONS.EXAM_GRADES, currentGradeId, payload);
            } else {
                const newRec = await createCategory(COLLECTIONS.EXAM_GRADES, payload);
                if (newRec) setCurrentGradeId(newRec.documentId || newRec.id);
            }
            alert("Đã lưu bảng điểm thành công!");
        } catch (e) {
            console.error(e);
            alert("Lỗi khi lưu bảng điểm.");
        }
    };

    // Helper to get grades
    const getStudentGrade = (studentCode: string) => {
        if (!selectedSubjectId) return { theory: '', practice: '' };
        const sub = decisionSubjects.find(s => s.id === selectedSubjectId);
        const subKey = String(sub?.strapiId || selectedSubjectId);
        const subGrades = (inputGrades as any)[subKey] || {};
        return subGrades[studentCode] || { theory: '', practice: '' };
    };

    // Renderers
    const renderModal = () => {
        if (!selectedDecision) return null;

        return (
            <div className="fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-300">
                    {/* Header */}
                    <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-700 rounded-md"><Calculator size={18} className="text-green-400" /></div>
                            <div>
                                <h2 className="text-[15px] font-bold">{selectedDecision.className}</h2>
                                <p className="text-[12px] text-slate-300 mt-0.5">Nhập điểm thi kết thúc môn</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleSaveGrades} className="px-3 py-1.5 bg-green-600 text-white text-[13px] font-semibold rounded-md flex items-center gap-1.5 hover:bg-green-700 shadow-sm shadow-green-900/50">
                                <Save size={15} /> Lưu Bảng Điểm
                            </button>
                            <div className="w-px h-6 bg-slate-600 mx-1"></div>
                            <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex">
                        {/* Sidebar */}
                        <div className="w-1/4 bg-slate-50 border-r border-slate-200 overflow-y-auto flex flex-col p-2">
                            {decisionSubjects.map(sub => (
                                <div
                                    key={sub.id}
                                    onClick={() => setSelectedSubjectId(sub.id)}
                                    className={`p-2.5 rounded-lg cursor-pointer mb-1.5 border transition-all ${String(selectedSubjectId) === String(sub.id) ? 'bg-white border-green-500 shadow-sm ring-1 ring-green-500' : 'bg-white border-slate-200 hover:border-green-300'}`}
                                >
                                    <div className="font-semibold text-slate-800 text-[13px] leading-snug">{sub.name}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{sub.code}</div>
                                </div>
                            ))}
                        </div>

                        {/* Main */}
                        <div className="flex-1 bg-white overflow-y-auto p-0 relative">
                            {!selectedSubjectId ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                                    <BookOpen size={32} className="mb-3 opacity-50" />
                                    <p className="text-[15px] font-medium text-slate-600">Chọn môn học để nhập điểm</p>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col">
                                    <div className="px-5 py-3 border-b bg-white sticky top-0 z-10 flex justify-between items-center">
                                        <h3 className="font-bold text-[15px] flex items-center gap-2">
                                            <BookOpen size={16} className="text-green-600" />
                                            {decisionSubjects.find(s => s.id === selectedSubjectId)?.name}
                                        </h3>
                                        <div className="text-[12px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
                                            Sĩ số: {decisionStudents.length}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-[13px] text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase sticky top-0 z-0 shadow-sm border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-2.5 w-12 text-center bg-slate-50">STT</th>
                                                    <th className="px-4 py-2.5 bg-slate-50">Mã HV</th>
                                                    <th className="px-4 py-2.5 bg-slate-50">Họ và tên</th>
                                                    <th className="px-4 py-2.5 text-center bg-slate-50">Trạng thái</th>
                                                    {decisionSubjects.find(s => s.id === selectedSubjectId)?.hasTheory && (
                                                        <th className="px-4 py-2.5 w-32 text-center bg-slate-50">Lý thuyết</th>
                                                    )}
                                                    {decisionSubjects.find(s => s.id === selectedSubjectId)?.hasPractice && (
                                                        <th className="px-4 py-2.5 w-32 text-center bg-slate-50 text-orange-600">Thực hành</th>
                                                    )}
                                                    <th className="px-4 py-2.5 w-32 text-center bg-slate-50">Tổng kết</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {decisionStudents.map((s, idx) => {
                                                    const sub = decisionSubjects.find(sub => sub.id === selectedSubjectId);
                                                    const subKey = String(sub?.strapiId || selectedSubjectId);
                                                    const subApprovals = approvals[subKey] || {};
                                                    const approval = subApprovals[s.studentCode] || { practicePass: !sub?.hasPractice, theoryApproved: false };

                                                    const isEligibleTheory = approval.theoryApproved;
                                                    const isEligiblePractice = sub?.hasPractice;

                                                    const grades = getStudentGrade(s.studentCode);
                                                    const tVal = grades.theory || '';
                                                    const pVal = grades.practice || '';

                                                    const t = parseFloat(tVal);
                                                    const p = parseFloat(pVal);

                                                    let result = '';
                                                    if (sub?.hasTheory) {
                                                        if (tVal !== '') result = t.toFixed(1);
                                                    } else if (sub?.hasPractice) {
                                                        result = approval.practicePass ? 'Đạt' : 'K.Đạt';
                                                    }

                                                    return (
                                                        <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-2 text-center text-slate-400 font-medium">{idx + 1}</td>
                                                            <td className="px-4 py-2 font-mono text-blue-600 font-bold">{s.studentCode}</td>
                                                            <td className="px-4 py-2 font-bold uppercase text-slate-700">{s.fullName}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                {(!sub?.hasTheory || isEligibleTheory) ? (
                                                                    <span className="text-green-600 text-[11px] font-bold flex items-center justify-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100"><CheckCircle2 size={12} /> Đủ ĐK thi</span>
                                                                ) : (
                                                                    <span className="text-red-400 text-[11px] font-bold flex items-center justify-center gap-1 bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><AlertCircle size={12} /> Chưa duyệt</span>
                                                                )}
                                                            </td>
                                                            {sub?.hasTheory && (
                                                                <td className="px-4 py-2 text-center">
                                                                    <div className="w-20 mx-auto">
                                                                        <input
                                                                            type="number"
                                                                            className={`w-full text-center border rounded-md p-1 transition-all text-[14px] ${!isEligibleTheory ? 'bg-slate-100 text-slate-300 cursor-not-allowed border-slate-200' : 'border-slate-300 focus:ring-2 focus:ring-green-500 font-bold text-slate-800'}`}
                                                                            disabled={!isEligibleTheory}
                                                                            value={tVal}
                                                                            onChange={e => handleGradeChange(s.studentCode, 'theory', e.target.value)}
                                                                            min="0" max="10" step="0.1"
                                                                            placeholder={isEligibleTheory ? '-' : 'X'}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {sub?.hasPractice && (
                                                                <td className="px-4 py-2 text-center">
                                                                    {approval.practicePass ? (
                                                                        <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-bold text-[11px] border border-green-200 uppercase">Đạt</span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-bold text-[11px] border border-red-200 uppercase">K.Đạt</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-2 text-center font-bold text-[14px] text-slate-800">
                                                                {result}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {decisionStudents.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">Chưa có học viên nào.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="mb-5 flex items-center gap-4">

                {/* Left: Icon + Title */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
                        <Calculator size={22} className="text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-slate-800 leading-tight">Nhập điểm thi</h1>
                        <p className="text-xs text-slate-400">Quản lý điểm thi kết thúc học phần theo Quyết định mở lớp</p>
                    </div>
                </div>

                {/* Center: Search Bar */}
                <div className="flex-1 relative group">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo quyết định, lớp..."
                        className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm outline-none shadow-sm focus:ring-2 focus:ring-green-100 focus:border-green-300 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDecisions.length === 0 ? (
                    <div className="col-span-3 text-center p-12 text-slate-400 border border-dashed rounded-xl">
                        Không tìm thấy lớp học nào.
                    </div>
                ) : (
                    filteredDecisions.map(d => (
                        <div key={d.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all group cursor-pointer flex flex-col h-full" onClick={() => handleDecisionSelect(d)}>
                            <div className="p-5 flex-1 space-y-3">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 leading-tight">{d.className}</h3>
                                    <div className="text-sm text-slate-500 font-mono mt-1">{d.classCode}</div>
                                </div>

                                <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Đợt/Khóa:</span>
                                        <span className="font-semibold text-slate-800">{d.trainingCourse || '---'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Số QĐ:</span>
                                        <span className="font-semibold text-slate-800">{d.number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Ngày ký:</span>
                                        <span className="font-semibold text-slate-800">{d.signedDate ? new Date(d.signedDate).toLocaleDateString('vi-VN') : '---'}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                                        <span className="text-slate-500">Sĩ số:</span>
                                        <span className="font-bold text-green-600">{d.studentCount} học viên</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0">
                                <span className="text-xs font-bold text-green-600 group-hover:underline flex items-center gap-1"><BookOpen size={14} /> Nhập điểm</span>
                                <div className="p-1 rounded-full bg-white border border-slate-200 text-slate-400 group-hover:text-green-600 group-hover:border-green-600 transition-colors">
                                    <Users size={14} />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && renderModal()}
        </div>
    );
};

export default GradeEntryView;
