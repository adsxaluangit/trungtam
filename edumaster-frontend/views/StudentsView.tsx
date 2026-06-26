
import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Trash2, Plus, Search, Filter, ChevronDown, X, Camera, Save, Calendar, User, Upload, Check, Phone, MapPin, Briefcase, Flag, School, Edit3, Image as ImageIcon, FileText, CheckCircle2, XCircle, ShieldCheck, Printer } from 'lucide-react';
import { Student } from '../types';
import ExcelJS from 'exceljs';

import { fetchCategory, fetchCategoryPaginated, createCategory, updateCategory, deleteCategory, COLLECTIONS, uploadFile, checkDuplicateStudent } from '../services/api';
import { formatDate, parseToISO } from '../utils/dateUtils';
import { downloadFile } from '../utils/fileUtils';



interface StudentsViewProps {
  prefilledStudent?: any;
  onClearPrefill?: () => void;
  onRegisterAnother?: (student: any) => void;
}

const StudentsView: React.FC<StudentsViewProps> = ({ prefilledStudent, onClearPrefill, onRegisterAnother }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nations, setNations] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [allDecisions, setAllDecisions] = useState<any[]>([]);

  // Server-Side Config
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalStudents, setTotalStudents] = useState(0);
  const [searchTermServer, setSearchTermServer] = useState('');

  // Photo states
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [isCameraLive, setIsCameraLive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Document Upload State
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);
  const [uploadingDocName, setUploadingDocName] = useState<string | null>(null);
  const [viewingDocsStudentId, setViewingDocsStudentId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [sharedDocs, setSharedDocs] = useState<any[]>([]);
  const [sharedDocsLoading, setSharedDocsLoading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // --- Duplicate guard state ---
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // --- Docs to copy from source student when using "+" button ---
  const [prefilledStudentDocs, setPrefilledStudentDocs] = useState<any[]>([]);

  // --- Docs fetch theo CCCD khi nhập form mới ---
  const [prefillDocs, setPrefillDocs] = useState<{front: string|null, back: string|null}>({front: null, back: null});

  const [formData, setFormData] = useState({
    studentCode: '',
    fullName: '',
    dob: '',
    pob: '',
    ethnicity: '',
    phone: '',
    idNumber: '',
    group: '',
    classCode: '',
    classId: '', // Added for Relation
    nationality: 'Việt Nam',
    address: '',
    gender: 'Nam',
    cardNumber: ''
  });



  // Helper: Map API Response (snake_case) to Frontend Model (camelCase)
  const mapStudentFromApi = (data: any): Student => {
    // Handle school_class relation (could be object or wrapper)
    const classRel = data.school_class?.data || data.school_class;
    const classObj = classRel?.attributes ? { id: classRel.id, ...classRel.attributes } : classRel;

    return {
      id: String(data.documentId || data.id), // Prefer Document ID in v5
      strapiId: data.strapiId || data.id, // Store numeric ID for relations
      stt: data.stt || 0,
      studentCode: data.student_code || '',
      // ... (rest preserved internally)
      full_name: data.full_name || '', // Note: fullName property is below
      fullName: data.full_name || '',
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      dob: data.dob || '',
      pob: data.pob || '',
      gender: data.gender || 'Nam',
      idNumber: data.id_number || '', // CCCD
      ethnicity: data.ethnicity || '',
      nationality: data.nationality || 'Việt Nam',
      address: data.address || '',
      phone: data.phone || '',
      company: data.company || '',
      photo: data.photo || null,
      group: classObj?.name || data.group || '', // Prefer relation name
      classCode: classObj?.code || data.class_code || '',
      className: classObj?.name || data.class_name || '',
      classId: String(classObj?.id || ''),      // numeric id from raw school_class relation (consistent with strapiId)
      cardNumber: data.card_number || '', // If used
      isApproved: data.is_approved || false,
      notes: data.notes || '',
      documents: (Array.isArray(data.documents) ? data.documents : data.documents?.data || []).map((d: any) => ({
        id: d.documentId || d.id,
        name: d.attributes?.name || d.name,
        url: d.attributes?.url || d.url,
        type: d.attributes?.mime || d.type || 'application/pdf',
        date: d.attributes?.createdAt || d.createdAt ? new Date(d.attributes?.createdAt || d.createdAt).toLocaleDateString('vi-VN') : ''
      })) || []
    } as any; // Cast as any to avoid strict type error if type not updated yet
  };

  // Load nations and classes from API
  const loadData = async () => {
    setLoading(true);
    try {
      const classesData = await fetchCategory(COLLECTIONS.CLASSES);
      if (classesData) setAvailableClasses(classesData);
      else setAvailableClasses([]);

      const nationsData = await fetchCategory(COLLECTIONS.NATIONS);
      if (nationsData) setNations(nationsData);
      else setNations([]);

      const customParams = `sort=createdAt:desc&populate[school_class]=true&populate[documents][fields][0]=name&populate[documents][fields][1]=url&populate[documents][fields][2]=type&fields[0]=student_code&fields[1]=full_name&fields[2]=first_name&fields[3]=last_name&fields[4]=dob&fields[5]=pob&fields[6]=gender&fields[7]=id_number&fields[8]=address&fields[9]=phone&fields[10]=is_approved&fields[11]=group&fields[12]=class_code&fields[13]=company&fields[14]=ethnicity&fields[15]=nationality&fields[16]=photo`;
      
      let filters = '';
      if (searchTermServer) {
         filters = `filters[$or][0][full_name][$containsi]=${encodeURIComponent(searchTermServer)}&filters[$or][1][id_number][$contains]=${encodeURIComponent(searchTermServer)}`;
      }
      if (selectedClassFilter) {
         // Filter through the school_class relation using class name
         // (most students have empty 'group' text field; data is in school_class relation)
         filters += (filters ? '&' : '') + `filters[school_class][name][$eq]=${encodeURIComponent(selectedClassFilter)}`;
      }

      // Always use unassigned endpoint to exclude students already in decisions (handled by backend)
      const studentEndpoint = 'students/unassigned';
      const [res] = await Promise.all([
        fetchCategoryPaginated(studentEndpoint, currentPage, pageSize, filters, customParams),
        // Fetch decisions only for recognition check if needed, but not for exclusion here
        fetchCategory(COLLECTIONS.CLASS_DECISIONS).then(data => setAllDecisions(data || []))
      ]);

      if (res && res.data) {
        let fetchedStudents = res.data.map(mapStudentFromApi);
        setStudents(fetchedStudents);
        setTotalStudents(res.meta.pagination.total);
      }

    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, searchTermServer, selectedClassFilter]);

  useEffect(() => {
    if (prefilledStudent) {
      // idNumber fallback: old records may have CCCD only in student_code
      const idNum = prefilledStudent.idNumber || prefilledStudent.studentCode || '';
      setFormData({
        studentCode: idNum,  // reuse CCCD as studentCode for new registration
        fullName: prefilledStudent.fullName || '',
        dob: prefilledStudent.dob ? (prefilledStudent.dob.includes('-') ? prefilledStudent.dob.split('-').reverse().join(',') : prefilledStudent.dob) : '',
        pob: prefilledStudent.pob || '',
        ethnicity: prefilledStudent.ethnicity || '',
        phone: prefilledStudent.phone || '',
        idNumber: idNum,
        group: '',
        classCode: '',
        classId: '',
        nationality: prefilledStudent.nationality || 'Việt Nam',
        address: prefilledStudent.address || '',
        company: prefilledStudent.company || '',  // Đơn vị công tác
        gender: prefilledStudent.gender || 'Nam',
        cardNumber: prefilledStudent.cardNumber || ''
      } as any);
      setStudentPhoto(prefilledStudent.photo || null);
      // Store source documents to copy after save
      setPrefilledStudentDocs(prefilledStudent.documents || []);
      setEditingId(null);
      setIsFormOpen(true);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefilledStudent]);

  const [loading, setLoading] = useState(false);



  // Filtered Students
  // When class filter active: frontend also strips out students assigned to OPENING decisions (see loadData above)
  const filteredStudents = students;

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Danh sách học viên');

      ws.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã HV / CCCD', key: 'studentCode', width: 18 },
        { header: 'Họ và Tên', key: 'fullName', width: 28 },
        { header: 'Giới tính', key: 'gender', width: 10 },
        { header: 'Ngày sinh', key: 'dob', width: 14 },
        { header: 'Nơi sinh', key: 'pob', width: 22 },
        { header: 'Dân tộc', key: 'ethnicity', width: 12 },
        { header: 'Quốc tịch', key: 'nationality', width: 12 },
        { header: 'Số điện thoại', key: 'phone', width: 16 },
        { header: 'Số CCCD', key: 'idNumber', width: 18 },
        { header: 'Lớp học', key: 'className', width: 35 },
        { header: 'Mã lớp', key: 'classCode', width: 14 },
        { header: 'Công ty / Đơn vị', key: 'company', width: 28 },
        { header: 'Địa chỉ', key: 'address', width: 30 },
        { header: 'Nhóm', key: 'group', width: 10 },
      ];

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Add data rows
      filteredStudents.forEach((s, idx) => {
        const row = ws.addRow({
          stt: idx + 1,
          studentCode: s.studentCode || '',
          fullName: s.fullName || '',
          gender: s.gender || '',
          dob: s.dob ? formatDate(s.dob) : '',
          pob: (s as any).pob || '',
          ethnicity: (s as any).ethnicity || '',
          nationality: (s as any).nationality || '',
          phone: s.phone || '',
          idNumber: (s as any).idNumber || '',
          className: s.className || '',
          classCode: s.classCode || '',
          company: s.company || '',
          address: (s as any).address || '',
          group: s.group || '',
        });

        row.height = 20;
        row.eachCell((cell, colNum) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', wrapText: false };
          // Center: STT, Giới tính, Ngày sinh, Mã lớp, Nhóm
          if ([1, 4, 5, 12, 15].includes(colNum)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          // Alternating row color
          if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
      });

      // Auto-fit (freeze header)
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`;
      const fileName = selectedClassFilter
        ? `DanhSach_${selectedClassFilter.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`
        : `DanhSach_HocVien_${dateStr}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export Excel failed:', e);
      alert('Lỗi khi xuất Excel. Vui lòng thử lại.');
    }
  };

  // --- Duplicate check helper (called on CCCD blur / class change) ---
  const runDuplicateCheck = async (idNumber: string, classId: string, excludeId?: string | null) => {
    setDuplicateWarning(null);
    if (!idNumber || idNumber.length < 9 || !classId) return;
    setIsCheckingDuplicate(true);
    try {
      const result = await checkDuplicateStudent(idNumber, classId, excludeId || undefined);
      if (result.exists) {
        setDuplicateWarning(
          `⚠️ Học viên CCCD ${idNumber} đã đăng ký lớp này rồi (${result.count} lần). Không thể đăng ký trùng!`
        );
      }
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Handle class selection change
  const handleClassChange = (className: string) => {
    const selectedClass = availableClasses.find(c => c.name === className);
    // After normalizeStrapiList: .id = documentId (string), .strapiId = numeric id
    // Strapi relation needs numeric id (strapiId) to avoid locale:null error
    const numericId = selectedClass ? String(selectedClass.strapiId || '') : '';
    // checkDuplicate backend uses document_id column, so pass documentId (.id)
    const docId = selectedClass ? String(selectedClass.id || '') : '';
    setFormData({
      ...formData,
      group: className,
      classCode: selectedClass ? selectedClass.code : '',
      classId: numericId  // numeric strapiId for school_class relation
    });
    // Real-time duplicate check uses documentId
    if (formData.idNumber && docId) {
      runDuplicateCheck(formData.idNumber, docId, editingId);
    } else {
      setDuplicateWarning(null);
    }
  };

  // Xóa prefillDocs khi CCCD thay đổi
  const handleIdNumberChange = (val: string) => {
    const cleanedVal = val.replace(/\D/g, '');
    if (cleanedVal.length <= 12) {
      setFormData({
        ...formData,
        idNumber: cleanedVal,
        studentCode: cleanedVal
      });
      setDuplicateWarning(null);
      if (!editingId) {
        setStudentPhoto(null);
        setPrefillDocs({ front: null, back: null }); // Xóa docs cũ khi đổi CCCD
      }
    }
  };

  // Hàm lõi: lấy ảnh 3x4 mới nhất + CCCD mặt trước/sau theo số CCCD
  // Dùng chung cho cả tạo mới và edit (khi record thiếu ảnh)
  const fetchPhotoAndDocsByIdNumber = async (idNumber: string, currentPhoto: string | null) => {
    if (!idNumber || idNumber.length < 9) return;
    try {
      const token = localStorage.getItem('jwt_token') || '';

      // 1. Lấy ảnh 3x4 mới nhất theo CCCD (chỉ nếu chưa có ảnh)
      if (!currentPhoto) {
        // Chỉ tìm ảnh từ records tạo trong 5 năm gần nhất
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        const photoRes = await fetch(
          `/api/students?filters[id_number][$eq]=${idNumber}&filters[createdAt][$gte]=${fiveYearsAgo.toISOString()}&fields[0]=photo&sort=createdAt:desc&pagination[limit]=20&publicationState=preview`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (photoRes.ok) {
          const json = await photoRes.json();
          // Lấy ảnh có giá trị (khác null/rỗng) đầu tiên trong tất cả records cùng CCCD
          const allRecords: any[] = json?.data || [];
          const latestPhoto = allRecords
            .map((r: any) => r.photo || r.attributes?.photo)
            .find((p: any) => !!p) || null;
          if (latestPhoto) setStudentPhoto(latestPhoto);
        }
      }

      // 2. Lấy CCCD mặt trước/sau gần nhất
      const docsRes = await fetch(
        `/api/student-documents/by-id-number?id_number=${encodeURIComponent(idNumber)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        const docs: any[] = docsJson?.data || [];
        const front = docs.find((d: any) => d.name === 'CCCD Mặt trước')?.url || null;
        const back  = docs.find((d: any) => d.name === 'CCCD Mặt sau')?.url  || null;
        setPrefillDocs({ front, back });
      }
    } catch (_) {
      // Bỏ qua lỗi — không bắt buộc phải có
    }
  };

  // Tự động lấy ảnh 3x4 Mới nhất + file CCCD đính kèm theo CCCD khi nhập form mới
  // → Học viên đăng ký lớp mới không cần upload lại ảnh lẫn hồ sơ
  // → Record cũ / quyết định cũ KHÔNG bị ảnh hưởng
  const fetchLatestPhotoByIdNumber = async (idNumber: string) => {
    if (!idNumber || idNumber.length < 9 || editingId) return; // Chỉ áp dụng khi tạo mới
    if (studentPhoto) return; // Đã có ảnh (từ prefilledStudent) thì giữ nguyên
    await fetchPhotoAndDocsByIdNumber(idNumber, studentPhoto);
  };

  // Real-time check on CCCD blur
  const handleIdNumberBlur = () => {
    // Tự động load ảnh gần nhất khi CCCD đủ 12 số và đang tạo mới
    if (formData.idNumber && formData.idNumber.length === 12 && !editingId) {
      fetchLatestPhotoByIdNumber(formData.idNumber);
    }
    if (formData.idNumber && formData.classId) {
      // classId in formData = numeric strapiId OR documentId from existing student
      // Find class by matching either strapiId or documentId
      const cls = availableClasses.find(
        (c: any) => String(c.strapiId) === formData.classId || String(c.id) === formData.classId
      );
      const docId = cls ? String(cls.id) : formData.classId; // cls.id = documentId after normalization
      runDuplicateCheck(formData.idNumber, docId, editingId);
    }
  };

  const startCamera = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraLive(true);
      }
    } catch (err) {
      alert("Không thể truy cập Camera. Vui lòng kiểm tra quyền trình duyệt.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraLive(false);
  };

  const capturePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        // Định dạng ảnh chuẩn 3x4 (300px x 400px hoặc 600px x 800px)
        canvas.width = 600;
        canvas.height = 800;
        const video = videoRef.current;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const targetRatio = 3 / 4;

        let sX = 0, sY = 0, sW = videoWidth, sH = videoHeight;

        // Cắt ảnh từ trung tâm video theo tỉ lệ 3:4
        if (videoWidth / videoHeight > targetRatio) {
          sW = videoHeight * targetRatio;
          sX = (videoWidth - sW) / 2;
        } else {
          sH = videoWidth / targetRatio;
          sY = (videoHeight - sH) / 2;
        }

        context.drawImage(video, sX, sY, sW, sH, 0, 0, 600, 800);
        setStudentPhoto(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
      }
    }
  };

  const handleEdit = (student: Student, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(student.id);
    setFormData({
      studentCode: student.studentCode || '',
      fullName: student.fullName || '',
      dob: student.dob ? (student.dob.includes('-') ? student.dob.split('-').reverse().join(',') : student.dob) : '',
      pob: student.pob || '',
      ethnicity: student.ethnicity || '',
      phone: student.phone || '',
      idNumber: student.idNumber || '',
      group: student.group || '',
      classCode: student.classCode || '',
      // Find class ID based on name if editing existing student
      classId: availableClasses.find(c => c.name === student.group)?.strapiId || availableClasses.find(c => c.name === student.group)?.id || '',
      nationality: student.nationality || 'Việt Nam',
      address: student.address || '',
      company: (student as any).company || '',
      gender: student.gender || 'Nam',
      cardNumber: student.cardNumber || '',
      notes: (student as any).notes || ''
    });
    setStudentPhoto(student.photo || null);
    setIsFormOpen(true);

    // Nếu record thiếu ảnh → tự động lấy ảnh mới nhất từ CCCD (các lớp học khác cùng người)
    if (!student.photo && student.idNumber && student.idNumber.length >= 9) {
      fetchPhotoAndDocsByIdNumber(student.idNumber, null);
    }
  };

  const handleDobChange = (dob: string) => {
    setFormData(prev => ({ ...prev, dob }));
    if (!dob) return;

    const parts = dob.split(',');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 16) {
        alert("Bạn chưa đủ 16 tuổi.");
      }
    }
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.group || !formData.idNumber || !formData.dob) {
      alert('Vui lòng nhập đầy đủ: Họ tên, Ngày sinh, Lớp học và Số CMND/CCCD!');
      return;
    }

    if (formData.idNumber.length !== 12) {
      alert('Vui lòng nhập chính xác 12 số CCCD/CMND!');
      return;
    }

    // Age validation check on save
    const parts = formData.dob.split(',');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      alert('Vui lòng chọn đầy đủ ngày tháng năm sinh!');
      return;
    }
    const birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 16) {
      alert("Bạn chưa đủ 16 tuổi.");
      return;
    }

    // --- Validation: Check 5-Year Re-registration Rule ---
    const currentClassId = formData.classId;
    const currentClassName = formData.group.trim().toLowerCase();
    const currentIdNumber = formData.idNumber.trim();

    // --- HARD BLOCK: Kiểm tra trùng lập tại cơ sở dữ liệu ---
    if (formData.idNumber && formData.classId) {
      // classId could be numeric strapiId (new selection) or documentId (from existing student data)
      // Find matching class by either strapiId or documentId (.id)
      const classForCheck = availableClasses.find(
        (c: any) => String(c.strapiId) === formData.classId || String(c.id) === formData.classId
      );
      // After normalizeStrapiList: c.id = documentId
      const classDocId = classForCheck ? String(classForCheck.id) : formData.classId;
      const dupResult = await checkDuplicateStudent(formData.idNumber, classDocId, editingId || undefined);
      if (dupResult.exists) {
        alert(`KHÔNG THỂ LƯU\n\nHọc viên có số CCCD ${formData.idNumber} đã đăng ký lớp này rồi (${dupResult.count} lần).\nVui lòng kiểm tra lại!`);
        setDuplicateWarning(`⚠️ Học viên CCCD ${formData.idNumber} đã đăng ký lớp này rồi (${dupResult.count} lần). Không thể đăng ký trùng!`);
        return;
      }
    }
    // ---------------------------------------------------------------

    // 1. Check if already enrolled in the ACTIVE students list for THIS class
    if (!editingId) {
      const isAlreadyInActive = students.some(s =>
        (s.studentCode === currentIdNumber || s.idNumber === currentIdNumber) &&
        (s.classId === currentClassId || s.group.trim().toLowerCase() === currentClassName)
      );
      if (isAlreadyInActive) {
        alert("THÔNG BÁO: Học viên này hiện đang có tên trong danh sách lớp này rồi!");
        return;
      }
    }

    // 2. Check 5-year rule from previous recognition decisions
    const conflictingDecision = allDecisions.find((d: any) => {
      if (d.type !== 'RECOGNITION') return false;

      const decClass = d.school_class?.data || d.school_class;
      const decClassId = String(decClass?.documentId || decClass?.id || '');
      const decClassName = (decClass?.name || d.class_name || '').trim().toLowerCase();

      // Match class by ID (preferred) or Name
      const isSameClass = (currentClassId && decClassId === currentClassId) || (decClassName === currentClassName);
      if (!isSameClass) return false;

      const studentsInDec = d.students?.data || d.students || [];
      return studentsInDec.some((s: any) =>
        s.student_code === currentIdNumber ||
        s.id_number === currentIdNumber ||
        s.card_number === currentIdNumber
      );
    });

    if (conflictingDecision) {
      const signedDateStr = conflictingDecision.signed_date || conflictingDecision.signedDate;
      if (signedDateStr) {
        const signedDate = new Date(signedDateStr);
        const now = new Date();
        const diffYears = (now.getTime() - signedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

        if (diffYears < 5) {
          const proceed = window.confirm(`THÔNG BÁO: Học viên này ĐÃ CÓ CHỨNG CHỈ NÀY RỒI.\n(Được cấp theo Quyết định số ${conflictingDecision.decision_number || conflictingDecision.number} ngày ${signedDateStr})\n\nBạn có chắc chắn muốn đăng ký cho học viên này học lại lớp này (trong vòng 5 năm) không?`);
          if (!proceed) return;
        }
      }
    }
    // -----------------------------------------------------

    // Prepare Payload
    const nameParts = formData.fullName.trim().split(' ');
    const firstName = nameParts.length > 1 ? nameParts.pop() || '' : formData.fullName;
    const lastName = nameParts.length > 0 ? nameParts.join(' ') : '';

    // Payload for Strapi (snake_case)
    const payload = {
      student_code: formData.studentCode,
      full_name: formData.fullName.toUpperCase(),
      first_name: firstName.toUpperCase(),
      last_name: lastName.toUpperCase(),
      dob: parseToISO(formData.dob),
      pob: formData.pob,
      gender: formData.gender,
      id_number: formData.idNumber, // CCCD
      ethnicity: formData.ethnicity,
      nationality: formData.nationality,
      address: formData.address,
      company: (formData as any).company || '',
      phone: formData.phone,
      photo: studentPhoto,

      // Relations
      school_class: formData.classId || null,
      // Strapi v5 uses documentId (string) for relations. 
      // Safe to pass as-is.

      // Redundant String Fields (Optional, keep for now if needed by other views)
      group: formData.group,
      class_code: formData.classCode,
      class_name: formData.group,
      card_number: formData.idNumber,
      notes: (formData as any).notes || ''
    };

    // Clean Payload remove empty strings if necessary or rely on API handling
    if (!payload.school_class) delete payload.school_class;

    const saveToApi = async () => {
      try {
        let finalPhotoUrl = studentPhoto;
        
        // If photo is a newly captured Base64 string, upload it to Server Filesystem
        if (studentPhoto && studentPhoto.startsWith('data:image/')) {
          const uploadedInfo = await uploadFile(studentPhoto, `avatar_${formData.studentCode || Date.now()}.jpg`);
          if (uploadedInfo && uploadedInfo.length > 0) {
            finalPhotoUrl = uploadedInfo[0].url; 
          }
        }

        payload.photo = finalPhotoUrl;

        if (editingId) {
          await updateCategory(COLLECTIONS.STUDENTS, editingId, payload);
        } else {
          const newStudent = await createCategory(COLLECTIONS.STUDENTS, payload);

          // --- KHÔNG copy documents khi đăng ký lớp mới ---
          // Tài liệu được chia sẻ qua số CCCD (id_number), không gắn riêng với từng student record.
          // Khi xem tài liệu, frontend sẽ load theo CCCD để hiển thị chung cho mọi lớp.
          setPrefilledStudentDocs([]);
          // -------------------------------------------------------------------
        }
        alert(editingId ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        setIsFormOpen(false);
        setEditingId(null);
        loadData();
      } catch (e) {
        console.error(e);
        alert("Có lỗi xảy ra khi lưu dữ liệu!");
      }
    };
    saveToApi();
  };

  const handleDeleteRow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc muốn xóa học viên này? (Hành động này sẽ xóa trên hệ thống)')) {
      try {
        await deleteCategory(COLLECTIONS.STUDENTS, id);
        setStudents(prev => prev.filter(s => s.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        alert("đã xóa thành công!");
      } catch (err) {
        console.error(err);
        alert("Lỗi khi xóa học viên!");
      }
    }
  };

  const handleTriggerUpload = (studentId: string, e: React.MouseEvent, docName?: string) => {
    e.stopPropagation();
    setUploadingStudentId(studentId);
    setUploadingDocName(docName || null);
    docInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingStudentId) {
      // Create a capture of the current ID to avoid state race conditions
      const studentId = uploadingStudentId;
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const studentObj = students.find(s => s.id === studentId);
          let finalDocUrl = reader.result as string; 
          
          if (finalDocUrl.startsWith('data:image/')) {
             const uploadedInfo = await uploadFile(finalDocUrl, `doc_${studentObj?.studentCode || Date.now()}_${file.name}`);
             if (uploadedInfo && uploadedInfo.length > 0) {
                 finalDocUrl = uploadedInfo[0].url;
             }
          }

          const payload = {
            name: uploadingDocName || file.name,
            type: file.type,
            date: new Date().toLocaleDateString('vi-VN'),
            url: finalDocUrl,
            student: studentObj?.strapiId || studentId, // Use numeric ID for relation
            id_number: (studentObj as any)?.idNumber || '' // CCCD — dùng để chia sẻ docs qua nhiều lớp
          };

          // Gọi API replace-or-create: nếu đã có doc cùng tên + CCCD → cập nhật URL
          // Tránh tạo file thừa trên ổ đĩa
          const token = localStorage.getItem('jwt_token') || '';
          const replaceRes = await fetch('/api/student-documents/replace-or-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
          });
          const replaceJson = await replaceRes.json();
          const savedDoc = replaceJson?.data || null;

          if (savedDoc) {
            setStudents(prev => prev.map(s => {
              if (s.id === studentId) {
                return { ...s, documents: [...(s.documents || []), savedDoc] };
              }
              return s;
            }));
            alert('Đã tải lên và lưu hồ sơ thành công!');
          }
        } catch (err) {
          console.error("Upload failed:", err);
          alert('Lỗi khi lưu hồ sơ vào hệ thống!');
        } finally {
          setUploadingStudentId(null);
          if (docInputRef.current) docInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleApproval = async (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
      const newStatus = !student.isApproved;
      // Optimistic update
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return { ...s, isApproved: newStatus };
        }
        return s;
      }));

      await updateCategory(COLLECTIONS.STUDENTS, studentId, { is_approved: newStatus });
    } catch (err) {
      console.error("Failed to toggle approval:", err);
      // Revert if failed
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return { ...s, isApproved: !student.isApproved };
        }
        return s;
      }));
    }
  };

  const handlePrintRegistrationCard = () => {
    const { fullName, dob, pob, idNumber, ethnicity, nationality, phone, address, group } = formData;
    const company = (formData as any).company || '';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Vui lòng cho phép Pop-ups trên trình duyệt để in phiếu.");
      return;
    }

    // Format DOB correctly to DD/MM/YYYY
    let formattedDob = dob;
    if (dob && dob.includes(',')) {
      formattedDob = dob.replace(/,/g, '/');
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Phiếu đăng ký học</title>
      <style>
        @page {
            size: A5 portrait;
            margin: 0;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.25;
          margin: 0;
          padding: 1.5cm 1.5cm 1.5cm 2cm;
          box-sizing: border-box;
          background-color: #fff;
          color: #000;
        }
        .container {
          display: block;
        }
        .header-right {
          float: right;
          width: 3cm;
          height: 4cm;
          border: 1px solid #777;
          display: flex;
          align-items: center;
          justify-content: center;
          color: red;
          font-size: 10pt;
          overflow: hidden;
          margin-left: 15px;
          margin-bottom: 10px;
        }
        .header-right img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .header-left {
          text-align: center;
          font-size: 10pt;
          margin-bottom: 15px;
        }
        .header-left .agency {
          text-transform: uppercase;
        }
        .header-left .school {
          text-transform: uppercase;
          font-weight: bold;
        }
        .title {
          text-align: center;
          font-weight: bold;
          font-size: 14pt;
          margin: 0 0 15px 0;
          text-transform: uppercase;
        }
        .info-row {
          display: flex;
          margin-bottom: 4px;
        }
        .info-row .label {
          white-space: nowrap;
          min-width: fit-content;
        }
        .info-row .value {
          flex: 1;
          margin-left: 5px;
          margin-right: 5px;
          display: flex;
          align-items: flex-end;
          padding-bottom: 2px;
        }
        .row-group-flex {
          display: flex;
          width: 100%;
          margin-bottom: 2px;
        }
        .row-group-flex .label {
          white-space: nowrap;
          min-width: fit-content;
        }
        .row-group-flex .value {
          margin-left: 5px;
          display: flex;
          align-items: flex-end;
          padding-bottom: 2px;
        }
        .content {
          margin-bottom: 10px;
        }
        .signature-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 5px;
        }
        .signature-box {
          text-align: center;
          width: 6cm;
        }
        .signature-box .role {
          font-style: italic;
        }
        @media print {
            body {
                padding-top: 1.5cm;
                padding-left: 2cm;
                padding-right: 1.5cm;
            }
        }
      </style>
    </head>
    <body onload="window.print()">
      <div class="container">
        <div class="header-right">
          ${studentPhoto ? `<img src="${studentPhoto}" alt="Ảnh 3x4" />` : 'Ảnh 3x4'}
        </div>
        
        <div class="header-left">
          <div class="agency">CỤC HÀNG HẢI VÀ ĐƯỜNG THUỶ VIỆT NAM</div>
          <div class="school">TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THUỶ I</div>
        </div>

        <div class="title">PHIẾU ĐĂNG KÝ HỌC</div>

        <div class="content">
          <div class="info-row">
            <span class="label">Họ và tên:</span>
            <span class="value"><b>${fullName.toUpperCase()}</b></span>
          </div>
          <div class="info-row" style="margin-bottom: -8px;">
            <span class="label">Ngày, tháng, năm sinh:</span>
            <span class="value">${formattedDob}</span>
          </div>

          <div style="line-height: 1.1; margin-top: 0px;">
            <div class="row-group-flex" style="margin-bottom: 0px;">
              <span class="label">Nơi sinh:</span>
              <span class="value" style="flex: 1.5">${pob}</span>
              <span class="label" style="margin-left: 10px;">Số CCCD:</span>
              <span class="value" style="flex: 1.5">${idNumber}</span>
            </div>
            <div class="row-group-flex" style="margin-bottom: 0px;">
              <span class="label">Dân tộc:</span>
              <span class="value" style="flex: 1.5">${ethnicity}</span>
              <span class="label" style="margin-left: 10px;">Quốc tịch:</span>
              <span class="value" style="flex: 1.5">${nationality}</span>
            </div>
            <div class="info-row" style="margin-bottom: 0px;">
              <span class="label">Số điện thoại liên lạc:</span>
              <span class="value">${phone}</span>
            </div>
            <div class="info-row" style="margin-bottom: 0px;">
              <span class="label">Đơn vị công tác:</span>
              <span class="value">${(formData as any).company || ''}</span>
            </div>
            <div class="info-row" style="margin-bottom: 0px;">
              <span class="label">Địa chỉ thường trú:</span>
              <span class="value">${address}</span>
            </div>
            <div class="info-row" style="margin-bottom: 0px;">
              <span class="label">Đăng ký học:</span>
              <span class="value">${group}</span>
            </div>
          </div>
        </div>

        <div class="signature-section" style="margin-right: 15mm; margin-top: 10px;">
          <div class="signature-box">
            <div class="role">Học viên (ký và ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderStudentForm = () => (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[1400px] rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-1.5 flex justify-between items-center text-sm font-bold">
          <span>{editingId ? 'Cập nhật thông tin học viên' : 'Thêm mới học viên'}</span>
          <button onClick={() => { stopCamera(); setIsFormOpen(false); }} className="hover:bg-white/20 p-1 rounded"><X size={18} /></button>
        </div>

        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={handlePrintRegistrationCard} className="px-5 py-1 bg-white text-blue-600 rounded border border-blue-300 text-[12px] font-bold shadow-sm hover:bg-blue-50 flex items-center gap-1.5 transition-colors"><Printer size={14} /> In Phiếu ĐK Học</button>
          <button
            onClick={handleSave}
            disabled={!!duplicateWarning}
            title={duplicateWarning ? 'Không thể lưu khi có học viên trùng' : ''}
            className={`px-5 py-1 rounded border text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all ${
              duplicateWarning
                ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed'
                : 'bg-[#54a0ff] text-white border-[#2e86de] hover:brightness-105'
            }`}
          >
            <Save size={14} /> Lưu
          </button>
          <button onClick={() => { stopCamera(); setIsFormOpen(false); setDuplicateWarning(null); }} className="px-5 py-1 bg-white text-slate-700 rounded border border-slate-300 text-[12px] font-bold shadow-sm outline-none hover:bg-slate-100 transition-colors">Đóng</button>
        </div>

        {/* Duplicate Warning Banner */}
        {duplicateWarning && (
          <div className="mx-0 px-4 py-2.5 bg-red-50 border-b-2 border-red-400 flex items-center gap-3">
            <span className="text-red-600 text-lg">🚫</span>
            <div className="flex-1">
              <p className="text-red-700 font-bold text-[12px]">{duplicateWarning}</p>
            </div>
            <button
              onClick={() => setDuplicateWarning(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
              title="Bỏ qua cảnh báo"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="p-6 bg-white overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-9 space-y-4 h-full overflow-y-auto pr-2">

              {/* Section 1: Thông tin cá nhân */}
              <div className="border border-slate-200 rounded p-4 relative pt-6 bg-slate-50/50 mt-2">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[12px] font-bold text-blue-600 border border-blue-100 rounded shadow-sm">
                  1. Thông tin cá nhân
                </span>
                <div className="grid grid-cols-4 gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Mã học viên:</label>
                    <input
                      type="text"
                      value={formData.studentCode}
                      readOnly
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] bg-slate-100 text-slate-500 font-mono"
                      placeholder="Tự động tạo từ CCCD"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Họ và tên HV<span className="text-red-500">*</span>:</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all"
                      placeholder="NHẬP HỌ VÀ TÊN"
                    />
                  </div>

                  {/* Row 2: Birth Info */}
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Ngày sinh<span className="text-red-500">*</span>:</label>
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                      <div className="relative">
                        <select
                          value={formData.dob.split(',')[0] || ''}
                          onChange={e => {
                            const parts = formData.dob.split(',');
                            handleDobChange(`${e.target.value},${parts[1] || ''},${parts[2] || ''}`);
                          }}
                          className="w-full border border-slate-300 rounded-sm pl-2 pr-6 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white appearance-none hover:border-blue-400 transition-colors text-slate-700 shadow-sm cursor-pointer"
                        >
                          <option value="" disabled className="text-slate-400">Ngày</option>
                          {Array.from({ length: 31 }, (_, i) => {
                            const day = (i + 1).toString().padStart(2, '0');
                            return <option key={day} value={day}>{day}</option>
                          })}
                        </select>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>

                      <div className="relative">
                        <select
                          value={formData.dob.split(',')[1] || ''}
                          onChange={e => {
                            const parts = formData.dob.split(',');
                            handleDobChange(`${parts[0] || ''},${e.target.value},${parts[2] || ''}`);
                          }}
                          className="w-full border border-slate-300 rounded-sm pl-2 pr-6 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white appearance-none hover:border-blue-400 transition-colors text-slate-700 shadow-sm cursor-pointer"
                        >
                          <option value="" disabled className="text-slate-400">Tháng</option>
                          {Array.from({ length: 12 }, (_, i) => {
                            const month = (i + 1).toString().padStart(2, '0');
                            return <option key={month} value={month}>{month}</option>
                          })}
                        </select>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>

                      <div className="relative">
                        <select
                          value={formData.dob.split(',')[2] || ''}
                          onChange={e => {
                            const parts = formData.dob.split(',');
                            handleDobChange(`${parts[0] || ''},${parts[1] || ''},${e.target.value}`);
                          }}
                          className="w-full border border-slate-300 rounded-sm pl-2 pr-6 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white appearance-none hover:border-blue-400 transition-colors text-slate-700 shadow-sm cursor-pointer"
                        >
                          <option value="" disabled className="text-slate-400">Năm</option>
                          {Array.from({ length: 100 }, (_, i) => {
                            const year = (new Date().getFullYear() - i).toString();
                            return <option key={year} value={year}>{year}</option>
                          })}
                        </select>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Nơi sinh:</label>
                    <select
                      value={formData.pob}
                      onChange={e => setFormData({ ...formData, pob: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">--Chọn nơi sinh--</option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Huế">Huế</option>
                      <option value="Lai Châu">Lai Châu</option>
                      <option value="Điện Biên">Điện Biên</option>
                      <option value="Sơn La">Sơn La</option>
                      <option value="Lạng Sơn">Lạng Sơn</option>
                      <option value="Quảng Ninh">Quảng Ninh</option>
                      <option value="Thanh Hoá">Thanh Hoá</option>
                      <option value="Nghệ An">Nghệ An</option>
                      <option value="Hà Tĩnh">Hà Tĩnh</option>
                      <option value="Cao Bằng">Cao Bằng</option>
                      <option value="Tuyên Quang">Tuyên Quang</option>
                      <option value="Lào Cai">Lào Cai</option>
                      <option value="Thái Nguyên">Thái Nguyên</option>
                      <option value="Phú Thọ">Phú Thọ</option>
                      <option value="Bắc Ninh">Bắc Ninh</option>
                      <option value="Hưng Yên">Hưng Yên</option>
                      <option value="Hải Phòng">Hải Phòng</option>
                      <option value="Ninh Bình">Ninh Bình</option>
                      <option value="Quảng Trị">Quảng Trị</option>
                      <option value="Đà Nẵng">Đà Nẵng</option>
                      <option value="Quảng Ngãi">Quảng Ngãi</option>
                      <option value="Gia Lai">Gia Lai</option>
                      <option value="Khánh Hòa">Khánh Hòa</option>
                      <option value="Lâm Đồng">Lâm Đồng</option>
                      <option value="Đắk Lắk">Đắk Lắk</option>
                      <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                      <option value="Đồng Nai">Đồng Nai</option>
                      <option value="Tây Ninh">Tây Ninh</option>
                      <option value="Cần Thơ">Cần Thơ</option>
                      <option value="Vĩnh Long">Vĩnh Long</option>
                      <option value="Đồng Tháp">Đồng Tháp</option>
                      <option value="Cà Mau">Cà Mau</option>
                      <option value="An Giang">An Giang</option>
                    </select>
                  </div>

                  {/* Row 3: Gender & ID */}
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Giới tính:</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Số CMND/CCCD<span className="text-red-500">*</span>:</label>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.idNumber}
                        onChange={e => handleIdNumberChange(e.target.value)}
                        onBlur={handleIdNumberBlur}
                        className={`w-full border rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none font-mono ${
                          duplicateWarning ? 'border-red-400 bg-red-50' : 'border-slate-300'
                        }`}
                        placeholder="Nhập số CCCD/CMND"
                      />
                      {isCheckingDuplicate && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 animate-pulse">Đang kiểm tra...</span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Ethnicity & Nationality */}
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Dân tộc:</label>
                    <input
                      type="text"
                      value={formData.ethnicity}
                      onChange={e => setFormData({ ...formData, ethnicity: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Quốc tịch:</label>
                    <select
                      value={formData.nationality}
                      onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white"
                    >
                      {nations.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                    </select>
                  </div>

                  {/* Row 5: Class */}
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Lớp học<span className="text-red-500">*</span>:</label>
                    <select
                      value={formData.group}
                      onChange={e => handleClassChange(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white font-medium text-blue-700"
                    >
                      <option value="">--Chọn lớp học--</option>
                      {availableClasses.map(cls => <option key={cls.id} value={cls.name}>{cls.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Liên lạc (Contact) */}
              <div className="border border-slate-200 rounded p-4 relative pt-6 bg-slate-50/50">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[12px] font-bold text-blue-600 border border-blue-100 rounded shadow-sm">
                  2. Thông tin liên lạc
                </span>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 text-right text-[12px] text-slate-600 font-medium">Địa chỉ thường trú:</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 text-right text-[12px] text-slate-600 font-medium">Đơn vị công tác:</label>
                    <input
                      type="text"
                      value={(formData as any).company || ''}
                      onChange={e => setFormData({ ...formData, ['company' as any]: e.target.value } as any)}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                      placeholder="Tên cơ quan, công ty, đơn vị..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-32 text-right text-[12px] text-slate-600 font-medium">Điện thoại:</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                      placeholder="Số điện thoại liên hệ"
                    />
                  </div>
                  <div className="flex items-start gap-2 col-span-2">
                    <label className="w-32 text-right text-[12px] text-slate-600 font-medium pt-1.5">Ghi chú:</label>
                    <textarea
                      rows={2}
                      value={(formData as any).notes || ''}
                      onChange={e => setFormData({ ...formData, ['notes' as any]: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none resize-none"
                      placeholder="Ghi chú thêm (nếu có)..."
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Photo & Score */}
            <div className="col-span-3 space-y-6">
              <div className="flex flex-col items-center">
                <span className="text-[12px] font-bold text-slate-600 mb-2 w-full text-center">Ảnh thẻ 3x4</span>
                <div
                  onClick={isCameraLive ? undefined : startCamera}
                  className="w-[150px] h-[200px] border-2 border-slate-300 rounded-sm bg-white flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group cursor-pointer shadow-md hover:border-blue-400 transition-all"
                  title={isCameraLive ? "" : "Click để mở Webcam"}
                >
                  {isCameraLive ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale-[0.2]" />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-full border-[20px] border-black/40"></div>
                        <div className="absolute inset-0 border-2 border-dashed border-white/50 m-2"></div>
                      </div>
                    </>
                  ) : studentPhoto ? (
                    <img src={studentPhoto} className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="opacity-20 group-hover:opacity-40 transition-opacity" />
                  )}

                  {!isCameraLive && (
                    <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="bg-white/90 p-3 rounded-full shadow-lg">
                        <Camera size={28} className="text-blue-600" />
                      </div>
                    </div>
                  )}

                  {isCameraLive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 gap-2 bg-gradient-to-t from-black/60 via-transparent to-transparent animate-in fade-in duration-300">
                      <div className="flex gap-4">
                        <button
                          onClick={capturePhoto}
                          className="p-3 bg-white rounded-full text-blue-600 shadow-xl hover:scale-110 active:scale-95 transition-all pointer-events-auto"
                          title="Chụp ảnh ngay"
                        >
                          <Camera size={24} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); stopCamera(); }}
                          className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white shadow hover:bg-red-600 transition-all pointer-events-auto"
                          title="Hủy chụp"
                        >
                          <X size={24} />
                        </button>
                      </div>
                      <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Căn giữa khuôn mặt</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 w-full max-w-[150px]">
                  <button
                    onClick={isCameraLive ? stopCamera : startCamera}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-[11px] font-bold transition-all border shadow-sm ${isCameraLive
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                      }`}
                  >
                    <Camera size={14} />
                    {isCameraLive ? 'Hủy bỏ' : 'Chụp ảnh 3x4'}
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded border border-slate-200 text-[11px] font-bold hover:bg-slate-100 transition-all shadow-sm"
                  >
                    <Upload size={14} />
                    Tải ảnh lên
                  </button>
                </div>

                <input type="file" ref={fileInputRef} hidden onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = () => {
                      setStudentPhoto(r.result as string);
                      stopCamera();
                    };
                    r.readAsDataURL(file);
                  }
                }} />

                {/* CCCD SECTION IN FORM (cả tạo mới lẫn chỉnh sửa) */}
                <div className="mt-6 w-full border-t border-slate-100 pt-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Căn cước công dân (Hồ sơ)</span>
                  {!editingId && (prefillDocs.front || prefillDocs.back) && (
                    <div className="mb-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded text-[10px] text-green-700 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Đã tìm thấy CCCD cũ — hiển thị bên dưới. Nhấn "Ảnh mới" nếu muốn cập nhật.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Front */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 font-medium">Mặt trước:</span>
                        <button
                          onClick={(e) => handleTriggerUpload(editingId || 'new', e, 'CCCD Mặt trước')}
                          className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <Upload size={10} /> {!editingId && prefillDocs.front ? 'Ảnh mới' : 'Tải lên'}
                        </button>
                      </div>
                      <div
                        className="aspect-[1.58/1] bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-all relative group"
                        onClick={() => {
                          const url = editingId
                            ? students.find(s => s.id === editingId)?.documents?.find(d => d.name === 'CCCD Mặt trước')?.url
                            : prefillDocs.front;
                          if (url) setZoomedImage(url);
                        }}
                      >
                        {(() => {
                          const url = editingId
                            ? students.find(s => s.id === editingId)?.documents?.find(d => d.name === 'CCCD Mặt trước')?.url
                            : prefillDocs.front;
                          return url ? (
                            <img src={url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-[10px] bg-white">Chưa có ảnh</div>
                          );
                        })()}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Search size={16} className="text-white" />
                        </div>
                      </div>
                    </div>
                    {/* Back */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 font-medium">Mặt sau:</span>
                        <button
                          onClick={(e) => handleTriggerUpload(editingId || 'new', e, 'CCCD Mặt sau')}
                          className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <Upload size={10} /> {!editingId && prefillDocs.back ? 'Ảnh mới' : 'Tải lên'}
                        </button>
                      </div>
                      <div
                        className="aspect-[1.58/1] bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-all relative group"
                        onClick={() => {
                          const url = editingId
                            ? students.find(s => s.id === editingId)?.documents?.find(d => d.name === 'CCCD Mặt sau')?.url
                            : prefillDocs.back;
                          if (url) setZoomedImage(url);
                        }}
                      >
                        {(() => {
                          const url = editingId
                            ? students.find(s => s.id === editingId)?.documents?.find(d => d.name === 'CCCD Mặt sau')?.url
                            : prefillDocs.back;
                          return url ? (
                            <img src={url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-[10px] bg-white">Chưa có ảnh</div>
                          );
                        })()}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Search size={16} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div >
  );

  // Bước 5: Load tài liệu theo CCCD — chia sẻ chung cho mọi lớp của cùng 1 người
  const openDocsModal = async (studentId: string) => {
    setViewingDocsStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    const idNumber = (student as any)?.idNumber;
    if (idNumber) {
      setSharedDocsLoading(true);
      try {
        const res = await fetch(`/api/student-documents/by-id-number?id_number=${encodeURIComponent(idNumber)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('jwt_token') || ''}` }
        });
        if (res.ok) {
          const json = await res.json();
          setSharedDocs(json.data || []);
        } else {
          // Fallback về docs gắn với student record này
          setSharedDocs(student?.documents || []);
        }
      } catch {
        setSharedDocs(student?.documents || []);
      } finally {
        setSharedDocsLoading(false);
      }
    } else {
      // Không có CCCD → dùng docs gốc
      setSharedDocs(student?.documents || []);
    }
  };

  const renderDocsModal = () => {
    const student = students.find(s => s.id === viewingDocsStudentId);
    if (!student) return null;
    const docsToShow = sharedDocs;

    return (
      <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-700 text-sm">Hồ sơ đính kèm ({sharedDocsLoading ? '...' : docsToShow.length})</h3>
              {(student as any)?.idNumber && (
                <p className="text-[10px] text-slate-400 mt-0.5">CCCD: {(student as any).idNumber} — hiển thị chung mọi lớp</p>
              )}
            </div>
            <button onClick={() => { setViewingDocsStudentId(null); setSharedDocs([]); }} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {sharedDocsLoading ? (
              <p className="text-center text-slate-400 py-8 text-xs animate-pulse">Đang tải hồ sơ...</p>
            ) : docsToShow.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-xs italic">Chưa có hồ sơ nào</p>
            ) : (
              <div className="space-y-2">
                {docsToShow.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-md hover:border-blue-200 hover:shadow-sm group transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-slate-700 truncate" title={doc.name}>{doc.name}</span>
                        <span className="text-[10px] text-slate-400">{doc.date} • {doc.type?.split('/')?.[1]?.toUpperCase() || 'FILE'}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => downloadFile(doc.url, doc.name)} 
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                      title="Tải xuống"
                    >
                      <Upload size={16} className="rotate-180" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex justify-end">
            <button onClick={() => { setViewingDocsStudentId(null); setSharedDocs([]); }} className="px-4 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-600 hover:bg-slate-100">Đóng</button>
          </div>
        </div>
      </div>
    );
  };

  const renderLightbox = () => {
    if (!zoomedImage) return null;
    return (
      <div 
        className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
        onClick={() => setZoomedImage(null)}
      >
        <button 
          className="absolute top-4 right-4 text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all"
          onClick={() => setZoomedImage(null)}
        >
          <X size={32} />
        </button>
        <img 
          src={zoomedImage} 
          className="max-w-full max-h-full object-contain rounded shadow-2xl animate-in fade-in zoom-in duration-300" 
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-500">
      <div className="bg-[#4a5568] text-white px-3 py-1.5 flex justify-between items-center text-xs font-bold">
        <div className="flex items-center gap-2"><span>Quản lý học viên (v1.1 - {selectedClassFilter ? `Lọc: ${selectedClassFilter}` : 'Chưa xếp lớp'})</span><X size={14} className="cursor-pointer hover:bg-white/10" /></div>
      </div>

      {isFormOpen && renderStudentForm()}
      {viewingDocsStudentId && renderDocsModal()}

      <div className="p-2 border-b border-slate-200 bg-white flex justify-between items-center gap-2">
        <div className="relative flex-1 max-w-md ml-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm: Họ tên, CCCD (Enter)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setCurrentPage(1);
                setSearchTermServer(searchTerm);
              }
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 ring-blue-500/20"
          />
        </div>
        <div className="w-[450px]">
          <select
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 ring-blue-500/20 bg-white"
          >
            <option value="">-- Tất cả lớp --</option>
            {availableClasses.map((cls: any) => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mr-2">
          <button onClick={handleExportExcel} className="px-4 py-1.5 bg-slate-50 text-slate-700 rounded border border-slate-300 hover:bg-slate-100 transition-all flex items-center gap-2 text-[12px] font-bold shadow-sm"><FileSpreadsheet size={16} /> Export Excel</button>
          <button onClick={loadData} className="px-4 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] hover:brightness-105 transition-all flex items-center gap-2 text-[12px] font-bold shadow-sm"><RefreshCw size={16} /> Tải lại</button>
          <button onClick={() => { setEditingId(null); setFormData({ studentCode: '', fullName: '', dob: '', pob: '', ethnicity: '', phone: '', idNumber: '', group: '', classCode: '', classId: '', nationality: 'Việt Nam', address: '', company: '', gender: 'Nam', cardNumber: '', ['notes' as any]: '' } as any); setStudentPhoto(null); setIsFormOpen(true); }} className="px-4 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] hover:brightness-105 transition-all flex items-center gap-2 text-[12px] font-bold shadow-sm"><Plus size={16} /> Thêm mới</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#f8f9fa]">
        <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
          <thead className="bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
            <tr className="border-b border-slate-200 bg-white">
              <th className="w-16 border-r px-2 py-2 text-center text-[12px] font-bold text-slate-700">Ảnh (3x4)</th>
              <th className="w-32 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Mã HV (CCCD)</th>
              <th className="w-56 border-r px-3 py-2 text-[12px] font-bold text-slate-700">Họ và Tên</th>
              <th className="w-28 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Ngày sinh</th>
              <th className="w-20 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Giới tính</th>
              <th className="w-80 border-r px-3 py-2 text-[12px] font-bold text-slate-700">Lớp học</th>
              <th className="w-28 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Điện thoại</th>
              <th className="w-24 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Hồ sơ HV</th>
              <th className="w-28 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Trạng thái</th>
              <th className="w-24 px-3 py-2 text-center text-[12px] font-bold text-slate-700">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="border-b hover:bg-[#e3f2fd] transition-colors text-[12px]">
                <td className="border-r px-2 py-1.5 text-center">
                  <div className="w-[36px] h-[48px] mx-auto rounded overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm">
                    {s.photo ? (
                      <img src={s.photo} alt={s.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="text-slate-300" />
                    )}
                  </div>
                </td>
                <td className="border-r px-3 py-1.5 font-medium text-blue-700 text-center">{s.studentCode}</td>
                <td className="border-r px-3 py-1.5 font-bold uppercase truncate">{s.fullName}</td>
                <td className="border-r px-3 py-1.5 text-center">
                  {formatDate(s.dob)}
                </td>
                <td className="border-r px-3 py-1.5 text-center">{s.gender}</td>
                <td className="border-r px-3 py-1.5 font-medium text-indigo-700 truncate">{s.group}</td>
                <td className="border-r px-3 py-1.5 text-center">{s.phone || '--'}</td>
                <td className="border-r px-3 py-1.5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => handleTriggerUpload(s.id, e)} className="text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 p-1.5 rounded-full hover:bg-blue-50" title="Tải hồ sơ lên">
                      <Upload size={14} className="mx-auto" />
                    </button>
                    <span
                      className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded-full font-bold cursor-pointer hover:underline hover:bg-blue-100 transition-colors"
                      onClick={(e) => { e.stopPropagation(); openDocsModal(s.id); }}
                      title="Xem hồ sơ đính kèm"
                    >
                      {s.documents && s.documents.length > 0 ? `${s.documents.length} file` : 'Xem HS'}
                    </span>
                  </div>
                </td>
                <td className="border-r px-3 py-1.5 text-center">
                  <button
                    onClick={(e) => toggleApproval(s.id, e)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border transition-all shadow-sm mx-auto ${s.isApproved
                      ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                      : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'}`}
                    title={s.isApproved ? "Click để hủy duyệt" : "Click để duyệt hồ sơ"}
                  >
                    {s.isApproved ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
                    {s.isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                  </button>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={(e) => handleEdit(s, e)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Sửa"><Edit3 size={16} /></button>
                    {onRegisterAnother && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegisterAnother({
                            fullName: s.fullName,
                            dob: s.dob,
                            pob: s.pob,
                            studentCode: s.studentCode,
                            idNumber: s.idNumber || s.studentCode,
                            phone: s.phone,
                            gender: s.gender,
                            photo: s.photo,
                            email: (s as any).email || '',
                            ethnicity: (s as any).ethnicity || '',
                            address: (s as any).address || '',
                            company: (s as any).company || '',
                            nationality: (s as any).nationality || 'Việt Nam',
                            documents: (s as any).documents || [],
                          });
                        }}
                        className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                        title="Đăng ký lớp mới cho học viên này"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                    <button onClick={(e) => handleDeleteRow(s.id, e)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Xóa"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={10} className="py-20 text-center text-slate-400 italic">Không tìm thấy học viên nào phù hợp với từ khóa "{searchTerm}"</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 border-t px-4 py-1.5 flex justify-between items-center text-[11px] text-slate-500 font-medium">
        <div>Tổng số bản ghi: {totalStudents} học viên (Trang {currentPage})</div>
        <div className="flex gap-4 items-center">
          {selectedIds.size > 0 && <span className="text-blue-600 font-bold mr-4">Đang chọn: {selectedIds.size}</span>}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              className="px-2 py-1 border rounded bg-white hover:bg-slate-200 disabled:opacity-50"
            >« Trước</button>
            <span className="font-bold text-blue-600 px-2">Trang {currentPage} / {Math.ceil(totalStudents / pageSize) || 1}</span>
            <button 
              onClick={() => setCurrentPage(p => p + 1)} 
              disabled={currentPage >= Math.ceil(totalStudents / pageSize)}
              className="px-2 py-1 border rounded bg-white hover:bg-slate-200 disabled:opacity-50"
            >Sau »</button>
          </div>
        </div>
      </div>
      <input type="file" ref={docInputRef} hidden onChange={handleFileChange} />
      {renderDocsModal()}
      {renderLightbox()}
    </div>
  );
};

export default StudentsView;
