
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Upload, Save, CheckCircle, LogIn, Lock, User, ChevronDown, AlertCircle } from 'lucide-react';
import { Student } from '../types';

import { fetchCategory, createCategory, COLLECTIONS, uploadFile, checkDuplicateStudent } from '../services/api';
import { parseToISO } from '../utils/dateUtils';
import { PROVINCES_LIST } from '../constants';

const compressImage = (file: File, maxWidth: number = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else {
                    resolve(e.target?.result as string);
                }
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

interface RegistrationViewProps {
    onLoginSuccess: () => void;
    initialData?: any;
}

const RegistrationView: React.FC<RegistrationViewProps> = ({ onLoginSuccess, initialData }) => {
    const [isSuccess, setIsSuccess] = useState(false);
    const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
    const [cccdFront, setCccdFront] = useState<string | null>(null);
    const [cccdBack, setCccdBack] = useState<string | null>(null);
    const [availableClasses, setAvailableClasses] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        fullName: '',
        dob: '',
        pob: '',
        ethnicity: 'Kinh',
        phone: '',
        idNumber: '',
        gender: 'Nam',
        address: '',
        email: '',
        parentName: '',
        parentPhone: '',
        company: '',
        notes: ''
    });

    // Multi-class selection
    const [selectedClasses, setSelectedClasses] = useState<any[]>([]);
    // Per-class duplicate status: { [classId]: 'checking' | 'ok' | 'duplicate' }
    const [classCheckStatus, setClassCheckStatus] = useState<Record<string, string>>({});
    // Pre-fill form if initialData is provided
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                fullName: initialData.fullName || '',
                dob: initialData.dob || '',
                pob: initialData.pob || '',
                idNumber: initialData.idNumber || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                gender: initialData.gender || 'Nam',
            }));
            if (initialData.photo) {
                setStudentPhoto(initialData.photo);
            }
        }
    }, [initialData]);




    const [existingData, setExistingData] = useState<any>(null);
    const [isCheckingId, setIsCheckingId] = useState(false);

    // Per-class duplicate check
    const checkClassDuplicate = async (idNumber: string, cls: any): Promise<boolean> => {
        const clsId = String(cls.id || ''); // documentId after normalization
        setClassCheckStatus(prev => ({ ...prev, [clsId]: 'checking' }));
        try {
            const result = await checkDuplicateStudent(idNumber, clsId);
            setClassCheckStatus(prev => ({ ...prev, [clsId]: result.exists ? 'duplicate' : 'ok' }));
            return result.exists;
        } catch {
            setClassCheckStatus(prev => ({ ...prev, [clsId]: 'ok' }));
            return false;
        }
    };

    // Toggle class selection + run duplicate check if CCCD is filled
    const toggleClassSelection = async (cls: any) => {
        const isSelected = selectedClasses.some(c => c.id === cls.id);
        if (isSelected) {
            setSelectedClasses(prev => prev.filter(c => c.id !== cls.id));
            setClassCheckStatus(prev => { const n = { ...prev }; delete n[String(cls.id)]; return n; });
        } else {
            setSelectedClasses(prev => [...prev, cls]);
            if (formData.idNumber.length === 12) {
                await checkClassDuplicate(formData.idNumber, cls);
            }
        }
    };

    // Re-check all selected classes when CCCD changes
    useEffect(() => {
        if (formData.idNumber.length === 12 && selectedClasses.length > 0) {
            setClassCheckStatus({});
            selectedClasses.forEach(cls => checkClassDuplicate(formData.idNumber, cls));
        } else if (formData.idNumber.length !== 12) {
            setClassCheckStatus({});
        }
    }, [formData.idNumber]);

    // Load available classes from API
    useEffect(() => {
        const loadClasses = async () => {
            try {
                const classes = await fetchCategory(COLLECTIONS.CLASSES);
                if (classes && classes.length > 0) {
                    setAvailableClasses(classes);
                } else {
                    setAvailableClasses([]);
                }
            } catch (error) {
                console.error("Failed to load classes", error);
                setAvailableClasses([]);
            }
        };
        loadClasses();
    }, []);

    // Check for existing student when 12 digits ID is typed — and auto-fill form
    useEffect(() => {
        const checkExisting = async (cccd: string) => {
            setIsCheckingId(true);
            try {
                const fiveYearsAgo = new Date();
                fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                const filters = `filters[id_number][$eq]=${cccd}&filters[createdAt][$gte]=${fiveYearsAgo.toISOString()}&sort=createdAt:desc`;
                const endpoint = `${COLLECTIONS.STUDENTS}?populate=*&pagination[pageSize]=1&${filters}`;
                const data = await fetchCategory(endpoint);
                
                if (data && data.length > 0) {
                    const latestStudent = data[0];
                    setExistingData(latestStudent);
                    // Auto-fill student info from existing record
                    setFormData(prev => ({
                        ...prev,
                        fullName: latestStudent.full_name || latestStudent.fullName || prev.fullName,
                        dob: latestStudent.dob
                            ? (() => {
                                const d = new Date(latestStudent.dob);
                                if (isNaN(d.getTime())) return prev.dob;
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = String(d.getFullYear());
                                return `${day},${month},${year}`;
                              })()
                            : prev.dob,
                        gender: latestStudent.gender || prev.gender,
                        phone: latestStudent.phone || prev.phone,
                        pob: latestStudent.pob || prev.pob,
                        address: latestStudent.address || prev.address,
                        company: latestStudent.company || prev.company,
                    }));
                    // Auto-fill photo
                    if (latestStudent.photo && !studentPhoto) {
                        setStudentPhoto(latestStudent.photo);
                    }
                } else {
                    setExistingData(null);
                }
            } catch (err) {
                console.error("Check existing failed", err);
            } finally {
                setIsCheckingId(false);
            }
        };

        if (formData.idNumber.length === 12) {
            checkExisting(formData.idNumber);
        } else {
            setExistingData(null);
        }
    }, [formData.idNumber]);



    const [submitResult, setSubmitResult] = useState<{ok: string[], skipped: string[]}>({ ok: [], skipped: [] });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.idNumber || formData.idNumber.length !== 12) {
            alert('Vui lòng nhập chính xác 12 số CCCD/CMND!');
            return;
        }
        if (!formData.fullName || !formData.phone || !formData.pob || !formData.address) {
            alert('Vui lòng điền đầy đủ các trường bắt buộc (Họ tên, SĐT, Nơi sinh, Địa chỉ)!');
            return;
        }
        // Validate DOB
        const dobParts = formData.dob.split(',');
        if (!dobParts[0] || !dobParts[1] || !dobParts[2]) {
            alert('Vui lòng chọn đầy đủ Ngày tháng năm sinh!');
            return;
        }
        // Validate CCCD images
        const hasCccdFront = cccdFront || existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt trước')?.url;
        const hasCccdBack = cccdBack || existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt sau')?.url;
        if (!hasCccdFront) {
            alert('Vui lòng tải lên ảnh CCCD Mặt trước!');
            return;
        }
        if (!hasCccdBack) {
            alert('Vui lòng tải lên ảnh CCCD Mặt sau!');
            return;
        }
        if (selectedClasses.length === 0) {
            alert('Vui lòng chọn ít nhất 1 lớp học muốn đăng ký!');
            return;
        }
        // Block if any selected class is already duplicate
        const hasDuplicate = selectedClasses.some(cls => classCheckStatus[String(cls.id)] === 'duplicate');
        if (hasDuplicate) {
            alert('Một số lớp bạn chọn đã bị đăng ký rồi. Vui lòng bỏ chọn các lớp được đánh dấu đỏ trước khi gửi.');
            return;
        }

        const nameParts = formData.fullName.trim().split(' ');
        const firstName = nameParts.length > 1 ? nameParts.pop() || '' : formData.fullName;
        const lastName = nameParts.length > 0 ? nameParts.join(' ') : '';

        // --- Upload images ONCE before the loop ---
        let finalPhotoUrl: string | null = studentPhoto;
        if (!finalPhotoUrl && existingData?.photo) finalPhotoUrl = existingData.photo;
        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image/')) {
            const up = await uploadFile(finalPhotoUrl, `avatar_${formData.idNumber}_${Date.now()}.jpg`);
            if (up && up.length > 0) { finalPhotoUrl = up[0].url; setStudentPhoto(finalPhotoUrl); }
        }

        let finalCccdFront: string | null = cccdFront;
        const existingCccdFront = existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt trước')?.url;
        if (!finalCccdFront && existingCccdFront) finalCccdFront = existingCccdFront;
        if (finalCccdFront && finalCccdFront.startsWith('data:image/')) {
            const up = await uploadFile(finalCccdFront, `cccd_front_${formData.idNumber}_${Date.now()}.jpg`);
            if (up && up.length > 0) { finalCccdFront = up[0].url; setCccdFront(finalCccdFront); }
        }

        let finalCccdBack: string | null = cccdBack;
        const existingCccdBack = existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt sau')?.url;
        if (!finalCccdBack && existingCccdBack) finalCccdBack = existingCccdBack;
        if (finalCccdBack && finalCccdBack.startsWith('data:image/')) {
            const up = await uploadFile(finalCccdBack, `cccd_back_${formData.idNumber}_${Date.now()}.jpg`);
            if (up && up.length > 0) { finalCccdBack = up[0].url; setCccdBack(finalCccdBack); }
        }
        // -----------------------------------------------

        const okList: string[] = [];
        const skippedList: string[] = [];

        try {
            for (const cls of selectedClasses) {
                // Final duplicate check per class
                const dupResult = await checkDuplicateStudent(formData.idNumber, String(cls.id));
                if (dupResult.exists) {
                    skippedList.push(cls.name);
                    continue;
                }

                const newStudentData = {
                    stt: 0,
                    class_code: cls.code || '',
                    class_name: cls.name || '',
                    school_class: cls.strapiId || cls.id,
                    student_code: formData.idNumber,
                    id_number: formData.idNumber,
                    card_number: '',
                    first_name: firstName.toUpperCase(),
                    last_name: lastName.toUpperCase(),
                    full_name: formData.fullName.toUpperCase(),
                    gender: formData.gender,
                    dob: parseToISO(formData.dob),
                    pob: formData.pob,
                    ethnicity: formData.ethnicity,
                    nationality: 'Việt Nam',
                    phone: formData.phone,
                    address: formData.address,
                    company: formData.company,
                    photo: finalPhotoUrl,
                    notes: formData.notes,
                    is_approved: false
                };

                const createdStudent = await createCategory(COLLECTIONS.STUDENTS, newStudentData);

                if (createdStudent && (createdStudent.strapiId || createdStudent.id)) {
                    const studentIdStr = createdStudent.strapiId || createdStudent.id;
                    if (finalCccdFront) {
                        await createCategory(COLLECTIONS.STUDENT_DOCUMENTS, {
                            name: 'CCCD Mặt trước', type: 'image/jpeg',
                            date: new Date().toISOString(), url: finalCccdFront, student: studentIdStr
                        });
                    }
                    if (finalCccdBack) {
                        await createCategory(COLLECTIONS.STUDENT_DOCUMENTS, {
                            name: 'CCCD Mặt sau', type: 'image/jpeg',
                            date: new Date().toISOString(), url: finalCccdBack, student: studentIdStr
                        });
                    }
                }
                okList.push(cls.name);
            }

            setSubmitResult({ ok: okList, skipped: skippedList });
            setIsSuccess(true);
        } catch (error) {
            console.error('Failed to register student', error);
            alert('Đã có lỗi xảy ra khi gửi đăng ký. Vui lòng thử lại sau.');
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Đăng ký thành công!</h2>
                    {submitResult.ok.length > 0 && (
                        <div className="mt-3 mb-2 text-left bg-green-50 rounded-lg p-3 border border-green-200">
                            <p className="text-sm font-bold text-green-700 mb-1">✅ Đã đăng ký ({submitResult.ok.length} lớp):</p>
                            {submitResult.ok.map((name, i) => (
                                <p key={i} className="text-sm text-green-600 pl-2">• {name}</p>
                            ))}
                        </div>
                    )}
                    {submitResult.skipped.length > 0 && (
                        <div className="mt-2 mb-3 text-left bg-orange-50 rounded-lg p-3 border border-orange-200">
                            <p className="text-sm font-bold text-orange-700 mb-1">⚠️ Bỏ qua ({submitResult.skipped.length} lớp đã đăng ký):</p>
                            {submitResult.skipped.map((name, i) => (
                                <p key={i} className="text-sm text-orange-600 pl-2">• {name}</p>
                            ))}
                        </div>
                    )}
                    <p className="text-slate-500 text-sm mt-3 mb-6">Nhà trường sẽ liên hệ với bạn trong thời gian sớm nhất.</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => {
                                setIsSuccess(false);
                                setSelectedClasses([]);
                                setClassCheckStatus({});
                                setSubmitResult({ ok: [], skipped: [] });
                            }}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Đăng ký lớp mới
                        </button>
                        <button
                            onClick={() => { window.location.href = 'https://mic1.edu.vn'; }}
                            className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded hover:bg-slate-200 transition-colors"
                        >
                            Thoát
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 font-sans text-slate-700">
            {/* Header */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">T</div>
                        <span className="font-bold text-xl text-slate-800 tracking-tight">Trungtam<span className="text-blue-600">Pro</span></span>
                    </div>
                    <button onClick={() => window.location.href = '/quantri'} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2 px-3 py-1.5 border border-transparent hover:border-blue-100 rounded transition-all">
                        <LogIn size={16} /> Đăng nhập hệ thống
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 md:p-8">
                <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="bg-blue-600 p-6 text-white text-center">
                        <h1 className="text-2xl font-bold mb-2">Phiếu Đăng Ký Học</h1>
                        <p className="text-blue-100">Vui lòng điền đầy đủ thông tin bên dưới để hoàn tất thủ tục đăng ký</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8">
                        {/* Input ẩn — giữ để logic auto-fill ảnh từ CCCD vẫn hoạt động */}
                        <input type="file" accept="image/*" ref={fileInputRef} hidden onChange={async e => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const compressed = await compressImage(file, 600);
                                setStudentPhoto(compressed);
                            }
                        }} />

                        <div className="grid grid-cols-1 gap-8">
                            {/* Form Fields — full width vì đã ẩn cột ảnh */}
                            <div className="col-span-1 space-y-3">

                                {/* === CMND/CCCD — luôn ở đầu để tra cứu thí sinh === */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">CMND/CCCD <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={12}
                                        value={formData.idNumber}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 12) setFormData({ ...formData, idNumber: val });
                                        }}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Nhập 12 số CCCD"
                                    />
                                    {isCheckingId && <p className="text-xs text-blue-500 mt-1 animate-pulse">Đang tìm kiếm thông tin thí sinh...</p>}
                                    {existingData && !isCheckingId && (
                                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                                            <CheckCircle size={16} className="mt-0.5 shrink-0 text-blue-600" />
                                            <div>
                                                <p className="font-bold">Đã tìm thấy thí sinh: {existingData.full_name || existingData.fullName}</p>
                                                <p className="text-xs text-blue-600 mt-0.5">Thông tin đã được điền tự động. Vui lòng kiểm tra lại trước khi gửi.</p>
                                            </div>
                                        </div>
                                    )}
                                    {!existingData && !isCheckingId && formData.idNumber.length === 12 && (
                                        <p className="text-xs text-slate-500 mt-1">Không tìm thấy thí sinh trong hệ thống. Vui lòng điền thông tin bên dưới.</p>
                                    )}
                                </div>

                                {/* === Họ và tên thí sinh === */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Họ và tên thí sinh <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase font-bold"
                                        placeholder="NGUYỄN VĂN A"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Ngày sinh <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="relative">
                                            <select
                                                value={formData.dob.split(',')[0] || ''}
                                                onChange={e => {
                                                    const parts = formData.dob.split(',');
                                                    setFormData({ ...formData, dob: `${e.target.value},${parts[1] || ''},${parts[2] || ''}` });
                                                }}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 appearance-none transition-all shadow-sm hover:border-blue-400 cursor-pointer"
                                            >
                                                <option value="" disabled className="text-slate-400">Ngày</option>
                                                {Array.from({ length: 31 }, (_, i) => {
                                                    const day = (i + 1).toString().padStart(2, '0');
                                                    return <option key={day} value={day}>{day}</option>
                                                })}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <select
                                                value={formData.dob.split(',')[1] || ''}
                                                onChange={e => {
                                                    const parts = formData.dob.split(',');
                                                    setFormData({ ...formData, dob: `${parts[0] || ''},${e.target.value},${parts[2] || ''}` });
                                                }}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 appearance-none transition-all shadow-sm hover:border-blue-400 cursor-pointer"
                                            >
                                                <option value="" disabled className="text-slate-400">Tháng</option>
                                                {Array.from({ length: 12 }, (_, i) => {
                                                    const month = (i + 1).toString().padStart(2, '0');
                                                    return <option key={month} value={month}>Tháng {month}</option>
                                                })}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <select
                                                value={formData.dob.split(',')[2] || ''}
                                                onChange={e => {
                                                    const parts = formData.dob.split(',');
                                                    setFormData({ ...formData, dob: `${parts[0] || ''},${parts[1] || ''},${e.target.value}` });
                                                }}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 appearance-none transition-all shadow-sm hover:border-blue-400 cursor-pointer"
                                            >
                                                <option value="" disabled className="text-slate-400">Năm</option>
                                                {Array.from({ length: 100 }, (_, i) => {
                                                    const year = (new Date().getFullYear() - i).toString();
                                                    return <option key={year} value={year}>{year}</option>
                                                })}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Giới tính</label>
                                    <div className="flex gap-6 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="gender" value="Nam" checked={formData.gender === 'Nam'} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                            <span className="group-hover:text-blue-600 transition-colors">Nam</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="gender" value="Nữ" checked={formData.gender === 'Nữ'} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                            <span className="group-hover:text-blue-600 transition-colors">Nữ</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>


                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nơi sinh (Tỉnh/TP) <span className="text-red-500">*</span></label>
                                    <select
                                        required={!(formData.pob !== '' && !PROVINCES_LIST.includes(formData.pob))}
                                        value={(formData.pob !== '' && !PROVINCES_LIST.includes(formData.pob)) ? 'other' : formData.pob}
                                        onChange={e => setFormData({ ...formData, pob: e.target.value === 'other' ? 'Khác' : e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Chọn tỉnh/thành phố --</option>
                                        {PROVINCES_LIST.map(province => (
                                            <option key={province} value={province}>{province}</option>
                                        ))}
                                        <option value="other">Khác...</option>
                                    </select>
                                    {(formData.pob !== '' && !PROVINCES_LIST.includes(formData.pob)) && (
                                        <input
                                            type="text"
                                            required
                                            value={formData.pob === 'Khác' ? '' : formData.pob}
                                            onChange={e => setFormData({ ...formData, pob: e.target.value || 'Khác' })}
                                            placeholder="Nhập tên Tỉnh/Thành phố hoặc Quốc gia..."
                                            className="w-full mt-2 px-4 py-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm animate-in fade-in slide-in-from-top-1"
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Địa chỉ thường trú <span className="text-red-500">*</span></label>
                                    <textarea
                                        required
                                        rows={1}
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Đơn vị công tác</label>
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={e => setFormData({ ...formData, company: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        placeholder="Tên cơ quan, công ty, đơn vị công tác..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Đăng ký lớp học <span className="text-red-500">*</span>
                                        {selectedClasses.length > 0 && (
                                            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                                Đã chọn: {selectedClasses.length} lớp
                                            </span>
                                        )}
                                    </label>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {availableClasses.map((cls: any) => {
                                            const clsId = String(cls.id || '');
                                            const isSelected = selectedClasses.some(c => c.id === cls.id);
                                            const status = classCheckStatus[clsId];
                                            const isDuplicate = status === 'duplicate';
                                            const isChecking = status === 'checking';
                                            return (
                                                <div
                                                    key={clsId}
                                                    onClick={() => !isDuplicate && toggleClassSelection(cls)}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all select-none ${
                                                        isDuplicate
                                                            ? 'border-red-200 bg-red-50 cursor-not-allowed opacity-70'
                                                            : isSelected
                                                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                                        isDuplicate ? 'border-red-300 bg-red-100'
                                                        : isSelected ? 'border-blue-500 bg-blue-500'
                                                        : 'border-slate-300 bg-white'
                                                    }`}>
                                                        {isSelected && !isDuplicate && (
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                        {isDuplicate && <span className="text-red-500 text-xs font-bold">!</span>}
                                                    </div>
                                                    <span className={`flex-1 text-sm font-medium ${
                                                        isDuplicate ? 'text-red-600' : isSelected ? 'text-blue-800 font-bold' : 'text-slate-700'
                                                    }`}>{cls.name}</span>
                                                    {isChecking && (
                                                        <span className="text-[10px] text-blue-400 animate-pulse shrink-0">Đang kiểm tra...</span>
                                                    )}
                                                    {isDuplicate && (
                                                        <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded shrink-0">Đã ĐK</span>
                                                    )}
                                                    {isSelected && !isDuplicate && status === 'ok' && (
                                                        <span className="text-[10px] bg-green-100 text-green-600 font-bold px-1.5 py-0.5 rounded shrink-0">✓ Hợp lệ</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {selectedClasses.length === 0 && (
                                        <p className="text-red-500 text-xs mt-2">※ Bắt buộc phải chọn ít nhất 1 lớp học</p>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                                        placeholder="Ghi chú thêm (nếu có)..."
                                    />
                                </div>

                                <div className="mb-6 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            CCCD Mặt trước <span className="text-red-500">*</span>
                                        </label>
                                        <div className={`border-2 border-dashed rounded-lg p-2 text-center h-[120px] flex flex-col items-center justify-center relative hover:bg-slate-50 cursor-pointer overflow-hidden group ${
                                            !cccdFront && !existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt trước')
                                                ? 'border-red-300 bg-red-50/30'
                                                : 'border-slate-300'
                                        }`}>
                                            {cccdFront ? (
                                                <img src={cccdFront} alt="CCCD Front" className="absolute inset-0 w-full h-full object-cover" />
                                            ) : existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt trước')?.url ? (
                                                <img src={existingData.documents.find((d: any) => d.name === 'CCCD Mặt trước').url} alt="CCCD Front" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <>
                                                    <Upload className="text-red-400 mb-2" size={24} />
                                                    <span className="text-xs text-red-500 font-medium">Bắt buộc tải ảnh</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const compressed = await compressImage(file, 1200);
                                                        setCccdFront(compressed);
                                                    }
                                                }}
                                            />
                                        </div>
                                        {existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt trước') && !cccdFront && (
                                            <p className="text-xs text-green-600 mt-1">✓ Dùng ảnh từ lần đăng ký trước</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            CCCD Mặt sau <span className="text-red-500">*</span>
                                        </label>
                                        <div className={`border-2 border-dashed rounded-lg p-2 text-center h-[120px] flex flex-col items-center justify-center relative hover:bg-slate-50 cursor-pointer overflow-hidden group ${
                                            !cccdBack && !existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt sau')
                                                ? 'border-red-300 bg-red-50/30'
                                                : 'border-slate-300'
                                        }`}>
                                            {cccdBack ? (
                                                <img src={cccdBack} alt="CCCD Back" className="absolute inset-0 w-full h-full object-cover" />
                                            ) : existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt sau')?.url ? (
                                                <img src={existingData.documents.find((d: any) => d.name === 'CCCD Mặt sau').url} alt="CCCD Back" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <>
                                                    <Upload className="text-red-400 mb-2" size={24} />
                                                    <span className="text-xs text-red-500 font-medium">Bắt buộc tải ảnh</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const compressed = await compressImage(file, 1200);
                                                        setCccdBack(compressed);
                                                    }
                                                }}
                                            />
                                        </div>
                                        {existingData?.documents?.find((d: any) => d.name === 'CCCD Mặt sau') && !cccdBack && (
                                            <p className="text-xs text-green-600 mt-1">✓ Dùng ảnh từ lần đăng ký trước</p>
                                        )}
                                    </div>
                                </div>

                                <hr className="mb-6 border-slate-100" />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={selectedClasses.length === 0 || selectedClasses.some(c => classCheckStatus[String(c.id)] === 'duplicate')}
                                className={`px-8 py-3 font-bold rounded-lg shadow-lg text-sm flex items-center gap-2 transition-all ${
                                    selectedClasses.length === 0 || selectedClasses.some(c => classCheckStatus[String(c.id)] === 'duplicate')
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                        : 'bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5'
                                }`}
                            >
                                <Save size={18} /> GỬI ĐĂNG KÝ ({selectedClasses.length} lớp)
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center mt-8 text-slate-400 text-sm">
                    &copy; 2026 Cao đẳng Hàng hải và Đường thủy I All rights reserved.
                </div>
            </div>

        </div>
    );
};

export default RegistrationView;
