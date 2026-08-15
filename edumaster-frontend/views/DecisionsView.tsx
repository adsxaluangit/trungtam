import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, List, Search, Trash2, Edit, UserPlus, Save, FileText, Calendar, Users, FileDown, GraduationCap, School, Paperclip, Upload, Printer, IdCard, FileSpreadsheet, History, Clock, ShieldCheck, ScrollText, Camera, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { Student } from '../types';
import { fetchCategory, fetchCategoryAll, fetchCategoryPaginated, createCategory, updateCategory, deleteCategory, COLLECTIONS, createLog, uploadFile } from '../services/api';
import { SearchableSelect, Option } from '../components/SearchableSelect';
import ExcelJS from 'exceljs';
import { formatDate, parseToISO } from '../utils/dateUtils';
import { downloadFile } from '../utils/fileUtils';

interface DecisionDetail {
  id: string;
  strapiId?: number;
  stt: number;
  fullName: string;
  gender: string;
  dob: string;
  cardNumber: string;
  studentCode: string;
  years: string;
  hometown: string;
  address: string;
  phone: string;
  notes: string;
  documents?: { id: string; name: string; url: string; date: string; type: string }[];
  photo?: string;
}

interface DecisionRecord {
  id: string;
  strapiId?: number;
  stt: number;
  number: string;
  type: 'OPENING' | 'RECOGNITION';
  group: string;
  classCode: string;
  classId?: string;
  className: string;
  trainingCourse: string;
  signedDate: string;
  signer: string;
  location: string;
  company: string;
  classType: string;
  notes: string;
  students: DecisionDetail[];
  relatedOpeningId?: string;
}

const FIXED_LOCATION = "Trường Cao đẳng Hàng hải và Đường thủy I";

import { User, UserRole } from '../types';

interface DecisionsViewProps {
  mode?: 'OPENING' | 'RECOGNITION';
  currentUser?: User;
}

const DecisionsView: React.FC<DecisionsViewProps> = ({ mode, currentUser }) => {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [viewType, setViewType] = useState<'OPENING' | 'RECOGNITION'>(mode || 'OPENING');

  useEffect(() => {
    if (mode) setViewType(mode);
  }, [mode]);
  const [loading, setLoading] = useState(false);
  const [printTemplates, setPrintTemplates] = useState<any[]>([]);

  // Data State
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [examGrades, setExamGrades] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mainSearchTerm, setMainSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<Set<string>>(new Set());
  const [tempStudents, setTempStudents] = useState<DecisionDetail[]>([]);
  const [viewingDocsStudentId, setViewingDocsStudentId] = useState<string | null>(null);
  const [viewingGradeStudentId, setViewingGradeStudentId] = useState<string | null>(null);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudentIndex, setEditingStudentIndex] = useState<number | null>(null);
  const [editingStudentData, setEditingStudentData] = useState<DecisionDetail | null>(null);

  // Camera state for Edit Student Modal
  const [isEditCameraLive, setIsEditCameraLive] = useState(false);
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Photo download state
  const [isDownloadingPhotos, setIsDownloadingPhotos] = useState(false);

  // Audit Log State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 25;

  const [availableOpeningDecisions, setAvailableOpeningDecisions] = useState<{id: string, className: string, number: string}[]>([]);
  const [lockedOpeningIds, setLockedOpeningIds] = useState<Set<string>>(new Set());

  // Reset pagination when mode or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [viewType, mainSearchTerm]);

  useEffect(() => {
    loadDecisions();
  }, [currentPage, viewType, mainSearchTerm]);

  const loadAuditLogs = async () => {
    // Fetch logs related to decisions if possible, or all logs
    // Currently, we'll fetch all and filter or just show top 50 recent
    const logs = await fetchCategory(`${COLLECTIONS.AUDIT_LOGS}?sort[0]=createdAt:desc&pagination[limit]=50`);
    if (logs) setAuditLogs(logs);
  };

  // --- Download Sample Excel ---
  const downloadSampleExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh sách tốt nghiệp');

    // Header row - mỗi dòng = 1 học viên
    sheet.columns = [
      { header: 'Số QĐ', key: 'so_qd', width: 14 },
      { header: 'Tên lớp', key: 'ten_lop', width: 30 },
      { header: 'Đợt/Khóa', key: 'dot_khoa', width: 18 },
      { header: 'Ngày ký (dd/mm/yyyy)', key: 'ngay_ky', width: 22 },
      { header: 'Người ký', key: 'nguoi_ky', width: 18 },
      { header: 'Họ và tên HV', key: 'ho_ten', width: 26 },
      { header: 'Ngày sinh (dd/mm/yyyy)', key: 'ngay_sinh', width: 22 },
      { header: 'Giới tính (Nam/Nữ)', key: 'gioi_tinh', width: 18 },
      { header: 'Số CMND/CCCD', key: 'so_cmnd', width: 18 },
      { header: 'Mã học viên', key: 'ma_hv', width: 16 },
      { header: 'Quê quán', key: 'que_quan', width: 28 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 24 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    headerRow.height = 30;

    // Sample data - cùng 1 Số QĐ = cùng 1 quyết định, nhiều dòng = nhiều học viên
    const sampleRows = [
      { so_qd: '0202', ten_lop: 'HUẤN LUYỆN NGHIỆP VỤ CƠ BẢN', dot_khoa: 'BTC-K1/2026', ngay_ky: '12/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'NGUYỄN VĂN AN', ngay_sinh: '15/05/1990', gioi_tinh: 'Nam', so_cmnd: '001234567890', ma_hv: 'HV001', que_quan: 'Hải Phòng', ghi_chu: '' },
      { so_qd: '0202', ten_lop: 'HUẤN LUYỆN NGHIỆP VỤ CƠ BẢN', dot_khoa: 'BTC-K1/2026', ngay_ky: '12/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'TRẦN THỊ BÌNH', ngay_sinh: '20/08/1992', gioi_tinh: 'Nữ', so_cmnd: '001234567891', ma_hv: 'HV002', que_quan: 'Hà Nội', ghi_chu: '' },
      { so_qd: '0202', ten_lop: 'HUẤN LUYỆN NGHIỆP VỤ CƠ BẢN', dot_khoa: 'BTC-K1/2026', ngay_ky: '12/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'LÊ VĂN CƯỜNG', ngay_sinh: '01/12/1988', gioi_tinh: 'Nam', so_cmnd: '001234567892', ma_hv: 'HV003', que_quan: 'Quảng Ninh', ghi_chu: '' },
      { so_qd: '0203', ten_lop: 'HUẤN LUYỆN AN TOÀN CÁ NHÂN', dot_khoa: 'BTC-K2/2026', ngay_ky: '15/03/2026', nguoi_ky: 'HIỆU TRƯỞNG', ho_ten: 'PHẠM VĂN DŨNG', ngay_sinh: '10/03/1995', gioi_tinh: 'Nam', so_cmnd: '001234567893', ma_hv: 'HV004', que_quan: 'Nam Định', ghi_chu: 'Ví dụ lớp 2' },
    ];

    sampleRows.forEach((row, idx) => {
      const r = sheet.addRow(row);
      r.eachCell(cell => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      });
      // Shade alternate decision groups
      if (idx < 3) {
        r.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        });
      }
    });

    // Add instruction note
    const noteRow = sheet.addRow([]);
    noteRow.getCell(1).value = '⚠️ Hướng dẫn: Cùng Số QĐ = Cùng 1 quyết định. Mỗi dòng là 1 học viên. Các lớp khác nhau thì dùng Số QĐ khác nhau.';
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' }, size: 9 };
    sheet.mergeCells(`A${noteRow.number}:L${noteRow.number}`);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_import_quyet_dinh_cong_nhan.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: convert various formats -> yyyy-mm-dd (for backend)
  const parseDateToISO = (raw: any): string => {
    return parseToISO(raw);
  };

  // --- Handle Import Excel File ---
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      const rows: any[] = [];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const values = row.values as any[];
        const soQd = String(values[1] ?? '').trim();
        const tenLop = String(values[2] ?? '').trim();
        if (!soQd && !tenLop) return; // skip empty rows
        rows.push({
          so_qd: soQd,
          ten_lop: tenLop,
          dot_khoa: String(values[3] ?? '').trim(),
          ngay_ky: parseDateToISO(values[4] ?? ''),
          nguoi_ky: String(values[5] ?? '').trim(),
          ho_ten: String(values[6] ?? '').trim(),
          ngay_sinh: parseDateToISO(values[7] ?? ''),
          gioi_tinh: String(values[8] ?? '').trim(),
          so_cmnd: String(values[9] ?? '').trim(),
          ma_hv: String(values[10] ?? '').trim(),
          que_quan: String(values[11] ?? '').trim(),
          ghi_chu: String(values[12] ?? '').trim(),
        });
      });

      setImportRows(rows);
      setIsImportModalOpen(true);
    } catch (err) {
      alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file.');
    }
  };

  // --- Confirm Import: group rows by Số QĐ, create decisions + link students ---
  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);
    let successCount = 0;
    let errorCount = 0;

    // Group rows by so_qd
    const grouped = new Map<string, any[]>();
    importRows.forEach(row => {
      const key = row.so_qd;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    for (const [soQd, rowGroup] of Array.from(grouped.entries())) {
      try {
        const firstRow = rowGroup[0];
        const signedDate = firstRow.ngay_ky || new Date().toISOString().split('T')[0];
        const currentYear = new Date(signedDate).getFullYear();

        // Check duplicate decision number in same year
        const isDuplicate = decisions.some(d => {
          if (!d.number || !d.signedDate) return false;
          const decYear = new Date(d.signedDate).getFullYear();
          return d.number.trim() === soQd.trim() && decYear === currentYear;
        });

        if (isDuplicate) {
          errorCount++;
          continue;
        }

        // Match students by ma_hv (mã học viên) or ho_ten
        const studentNumericIds: number[] = [];
        rowGroup.forEach(row => {
          if (!row.ho_ten) return;
          const matched = allStudents.find(s => {
            const codeMatch = row.ma_hv && (s.studentCode || '').toLowerCase().trim() === row.ma_hv.toLowerCase().trim();
            const nameMatch = (s.fullName || '').toLowerCase().trim() === row.ho_ten.toLowerCase().trim();
            return codeMatch || nameMatch;
          });
          if (matched) {
            const numId = Number((matched as any).strapiId || matched.id);
            if (numId && !studentNumericIds.includes(numId)) studentNumericIds.push(numId);
          }
        });

        const payload: any = {
          decision_number: soQd,
          type: 'RECOGNITION',
          training_course: firstRow.dot_khoa,
          signed_date: signedDate,
          signer_name: firstRow.nguoi_ky || 'HIỆU TRƯỞNG',
          notes: firstRow.ghi_chu,
          students: studentNumericIds,
        };

        // Try to match class by ten_lop name
        const matchedClass = availableClasses.find(
          c => (c.name || c.attributes?.name || '').toLowerCase().trim() === firstRow.ten_lop.toLowerCase().trim()
        );
        if (matchedClass) {
          payload.school_class = Number(matchedClass.strapiId || matchedClass.id);
        }

        await createCategory(COLLECTIONS.CLASS_DECISIONS, payload);
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }

    setImportLoading(false);
    setIsImportModalOpen(false);
    setImportRows([]);
    await loadDecisions();
    alert(`Import hoàn tất!\n✅ Thành công: ${successCount} quyết định\n❌ Thất bại/Trùng: ${errorCount} quyết định`);
  };


  const [formData, setFormData] = useState({
    number: '',
    signedDate: new Date().toISOString().split('T')[0],
    signer: 'HIỆU TRƯỞNG',
    location: FIXED_LOCATION,
    company: '',
    classType: 'Lớp tự do',
    classCode: '',
    className: '',
    trainingCourse: '',
    notes: '',
    classId: '',
    relatedOpeningId: '',
    startIndex: '1'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        // loadDecisions() is triggered by useEffect on mount due to currentPage/viewType dependencies
        loadClasses(),
        loadExamGrades(),
        loadTemplates(),
        loadAssignments()
      ]);
    } catch (e: any) {
      console.error("Load failed", e);
      setError("Không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra kết nối.");
    } finally {
      setLoading(false);
    }
  };

  // Constant for full deep population of students when needed
  const DEEP_POPULATE_STUDENTS = `populate[school_class]=true&populate[related_decision]=true&populate[students][populate][documents][fields][0]=name&populate[students][populate][documents][fields][1]=url&populate[students][populate][documents][fields][2]=type&populate[students][fields][0]=full_name&populate[students][fields][1]=dob&populate[students][fields][2]=gender&populate[students][fields][3]=card_number&populate[students][fields][4]=id_number&populate[students][fields][5]=student_code&populate[students][fields][6]=pob&populate[students][fields][7]=photo&populate[students][fields][8]=address&populate[students][fields][9]=notes&populate[students][fields][10]=phone`;

  const loadIdRef = React.useRef(0);

  const loadDecisions = async () => {
    const currentLoadId = ++loadIdRef.current;
    setLoading(true);
    let url = `${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=${viewType}&populate[school_class]=true&populate[related_decision]=true&populate[students]=true&sort[0]=signed_date:desc&sort[1]=id:desc`;

    if (mainSearchTerm) {
      url += `&filters[$or][0][decision_number][$containsi]=${encodeURIComponent(mainSearchTerm)}&filters[$or][1][training_course][$containsi]=${encodeURIComponent(mainSearchTerm)}&filters[$or][2][school_class][name][$containsi]=${encodeURIComponent(mainSearchTerm)}`;
    }

    const res = await fetchCategoryPaginated(url, currentPage, ITEMS_PER_PAGE, '', '');
    
    // Ignore stale responses to fix race condition
    if (loadIdRef.current !== currentLoadId) return;

    if (res) {
      const mapped = res.data.map((d: any, index: number) => {
        const classData = d.school_class?.data || d.school_class;
        const studentsData = d.students?.data || d.students || [];

        return {
          id: String(d.documentId || d.id),
          strapiId: d.strapiId || d.id,
          stt: index + 1,
          number: d.decision_number || '',
          type: d.type || 'OPENING',
          trainingCourse: d.training_course || '',
          signedDate: d.signed_date || '',
          signer: d.signer_name || 'HIỆU TRƯỞNG',
          classId: String(classData?.documentId || classData?.id || ''),
          className: classData?.attributes?.name || classData?.name || '',
          classCode: classData?.attributes?.code || classData?.code || '',
          notes: d.notes || '',
          students: Array.isArray(studentsData) ? studentsData.map((s: any, sIdx: number) => {
            const item = s.attributes || s;
            return {
              id: String(s.documentId || s.id),
              strapiId: s.strapiId || s.id,
              stt: sIdx + 1,
              fullName: item.full_name || item.fullName || '',
              gender: item.gender || 'Nam',
              dob: item.dob || '',
              studentCode: item.student_code || item.studentCode || item.code || '',
              hometown: item.pob || '',
              address: item.address || '',
              phone: item.phone || '',
              cardNumber: item.card_number || item.id_number || '',
              years: '',
              notes: item.notes || '',
              documents: (Array.isArray(item.documents) ? item.documents : item.documents?.data || []).map((doc: any) => ({
                id: doc.documentId || doc.id,
                name: doc.attributes?.name || doc.name,
                url: doc.attributes?.url || doc.url,
                type: doc.attributes?.mime || doc.type || 'application/pdf'
              })),
              photo: item.photo || null
            };
          }) : [],
          group: '',
          location: d.location || FIXED_LOCATION,
          company: d.company || '',
          classType: d.class_type || 'Lớp tự do',
          relatedOpeningId: (typeof d.related_decision === 'object')
            ? (d.related_decision?.documentId || d.related_decision?.id || d.related_decision?.data?.documentId || d.related_decision?.data?.id || '')
            : (String(d.related_decision || '')),
        } as DecisionRecord;
      });
      setDecisions(mapped);
      setTotalItems(res.meta.pagination.total);

      // Fetch locked status for these specific OPENING decisions
      if (viewType === 'OPENING' && mapped.length > 0) {
        const ids = mapped.map((d: DecisionRecord) => d.id);
        const idQueries = ids.map((id: string, idx: number) => `filters[related_decision][documentId][$in][${idx}]=${id}`).join('&');
        const relData = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&${idQueries}&populate[related_decision]=true`);
        const lockedSet = new Set<string>();
        if (relData) {
           relData.forEach((r: any) => {
              const rd = r.related_decision?.data || r.related_decision;
              if (rd) lockedSet.add(String(rd.documentId || rd.id));
           });
        }
        setLockedOpeningIds(lockedSet);
      } else {
        setLockedOpeningIds(new Set());
      }
    } else {
      setDecisions([]);
      setTotalItems(0);
      setLockedOpeningIds(new Set());
    }
    setLoading(false);
  };

  const loadClasses = async () => {
    // Fetch classes with subjects to valid grading requirements
    const data = await fetchCategory(`${COLLECTIONS.CLASSES}?populate=subjects`);
    if (data) setAvailableClasses(data);
  };

  // Load students for a SPECIFIC class only (lazy loading for scalability)
  // Called only when user selects a class in OPENING form
  // This scales to 500k+ students because we only fetch students for one class at a time
  const loadStudentsByClass = async (classDocId: string): Promise<Student[]> => {
    try {
      const params = `filters[school_class][documentId][$eq]=${classDocId}&filters[is_approved][$eq]=true&fields[0]=student_code&fields[1]=full_name&fields[2]=first_name&fields[3]=last_name&fields[4]=dob&fields[5]=pob&fields[6]=gender&fields[7]=id_number&fields[8]=is_approved&fields[9]=company&fields[10]=phone&fields[11]=address&populate[school_class]=true&pagination[pageSize]=500`;
      const data = await fetchCategory(`${COLLECTIONS.STUDENTS}?${params}`);
      if (!data) return [];
      return data.map((d: any) => {
        const classData = d.school_class?.data || d.school_class;
        return {
          id: String(d.documentId || d.id),
          strapiId: d.strapiId || d.id,
          stt: 0,
          studentCode: d.student_code || '',
          fullName: d.full_name || '',
          firstName: d.first_name || '',
          lastName: d.last_name || '',
          dob: d.dob || '',
          pob: d.pob || '',
          address: d.address || '',
          gender: d.gender || '',
          idNumber: d.id_number || '',
          cardNumber: '',
          group: classData?.attributes?.name || classData?.name || '',
          className: classData?.attributes?.name || classData?.name || '',
          classCode: classData?.attributes?.code || classData?.code || '',
          classId: String(classData?.documentId || classData?.id || ''),
          isApproved: d.is_approved === true || String(d.is_approved).toLowerCase() === 'true',
          documents: [],
          photo: null
        } as Student;
      });
    } catch (e) {
      console.error('Failed to load students for class', classDocId, e);
      return [];
    }
  };

  const loadTemplates = async () => {
    const data = await fetchCategory(COLLECTIONS.PRINT_TEMPLATES);
    if (data) setPrintTemplates(data);
  };

  const loadExamGrades = async () => {
    const data = await fetchCategoryAll(`${COLLECTIONS.EXAM_GRADES}?populate=decision`, '');
    if (data) setExamGrades(data);
  };

  const loadAssignments = async () => {
    const data = await fetchCategory(`${COLLECTIONS.TRAINING_ASSIGNMENTS}?populate=decision`);
    if (data) setAssignments(data);
  };

  // --- Download Student Photos as ZIP (3x4 photos) ---
  const handleDownloadStudentPhotos = async () => {
    const studentsWithPhotos = tempStudents.filter(s => s.photo && s.photo.trim() !== '');

    if (studentsWithPhotos.length === 0) {
      alert('Không có học viên nào trong danh sách có ảnh 3x4.');
      return;
    }

    setIsDownloadingPhotos(true);
    const zip = new JSZip();
    let successCount = 0;
    let failCount = 0;

    // Sanitize name for use as filename
    const sanitizeName = (name: string): string =>
      name.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');

    // Convert base64 data URL to Blob
    const base64ToBlob = (dataUrl: string): Blob => {
      const [header, data] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const byteChars = atob(data);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      return new Blob([byteArr], { type: mime });
    };

    // Get file extension from URL or mime type
    const getExtension = (url: string): string => {
      const fromUrl = url.split('?')[0].split('.').pop()?.toLowerCase();
      if (fromUrl && ['jpg','jpeg','png','webp','gif'].includes(fromUrl)) return fromUrl;
      return 'jpg';
    };

    for (let i = 0; i < studentsWithPhotos.length; i++) {
      const student = studentsWithPhotos[i];
      const photoSrc = student.photo!;
      const safeName = sanitizeName(student.fullName) || `hocvien_${i + 1}`;

      try {
        let blob: Blob;
        let ext = 'jpg';

        if (photoSrc.startsWith('data:image/')) {
          // Base64 embedded image
          const mime = photoSrc.match(/data:(.*?);/)?.[1] || 'image/jpeg';
          ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
          blob = base64ToBlob(photoSrc);
        } else {
          // URL-based image — resolve relative URLs to absolute
          let absoluteUrl = photoSrc;
          if (photoSrc.startsWith('/')) {
            absoluteUrl = `${window.location.origin}${photoSrc}`;
          }
          ext = getExtension(photoSrc);

          const token = localStorage.getItem('jwt_token');
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(absoluteUrl, { headers });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          blob = await res.blob();

          // Detect ext from content-type if ambiguous
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('jpeg') || ct.includes('jpg')) ext = 'jpg';
          else if (ct.includes('png')) ext = 'png';
          else if (ct.includes('webp')) ext = 'webp';
        }

        zip.file(`${String(i + 1).padStart(2, '0')}_${safeName}.${ext}`, blob);
        successCount++;
      } catch (err) {
        console.warn(`Failed to fetch photo for ${student.fullName}:`, err);
        failCount++;
      }
    }

    if (successCount === 0) {
      setIsDownloadingPhotos(false);
      alert('Không thể tải được ảnh nào. Vui lòng kiểm tra lại kết nối.');
      return;
    }

    try {
      // Tên file zip theo Đợt/Khóa
      const courseName = (formData.trainingCourse || formData.number || 'Quyet_Dinh')
        .trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
      const zipFileName = `Anh3x4_${courseName}.zip`;

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const msg = failCount > 0
        ? `✅ Đã tải ${successCount} ảnh vào file "${zipFileName}".\n⚠️ Không tải được ${failCount} ảnh (có thể chưa có ảnh trên server).`
        : `✅ Đã tải thành công ${successCount} ảnh vào file "${zipFileName}".`;
      alert(msg);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
      alert('Có lỗi khi tạo file ZIP. Vui lòng thử lại.');
    } finally {
      setIsDownloadingPhotos(false);
    }
  };

  const filteredDecisions = decisions; // decisions are already paginated and filtered by the server

  const loadAvailableOpeningDecisions = async (currentEditingId?: string) => {
    const activeEditingId = currentEditingId !== undefined ? currentEditingId : editingId;
    const allOpenings = await fetchCategoryAll(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=OPENING&populate[school_class]=true`, '');
    const allRecognitions = await fetchCategoryAll(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&fields[0]=id&populate[related_decision]=true`, '');
    const liveExamGrades = await fetchCategoryAll(`${COLLECTIONS.EXAM_GRADES}?populate=decision&fields[0]=id`, '');
    
    const linkedOpeningIds = new Set(
      allRecognitions.map((d: any) => {
        const rel = d.related_decision?.data || d.related_decision;
        return rel ? String(rel.documentId || rel.id) : null;
      }).filter(Boolean)
    );

    const decisionIdsWithGrades = new Set<string>();
    liveExamGrades.forEach((eg: any) => {
      const did = eg.decision?.documentId || eg.decision?.id || eg.decision?.data?.id || eg.decision?.data?.documentId;
      if (did) decisionIdsWithGrades.add(String(did));
    });

    const available = allOpenings.filter((d: any) => {
       const id = String(d.documentId || d.id);
       if (!decisionIdsWithGrades.has(id)) return false;
       const isUsedByAnother = linkedOpeningIds.has(id);
       if (!activeEditingId) return !isUsedByAnother;
       const currentDecision = decisions.find(rd => rd.id === activeEditingId);
       const usedByThisOne = currentDecision?.relatedOpeningId && String(currentDecision.relatedOpeningId) === id;
       return !isUsedByAnother || usedByThisOne;
    }).map((d: any) => {
        const classData = d.school_class?.data || d.school_class;
        return {
          id: String(d.documentId || d.id),
          className: classData?.attributes?.name || classData?.name || '',
          number: d.decision_number || '',
          classCode: classData?.attributes?.code || classData?.code || '',
          trainingCourse: d.training_course || '',
          classId: String(classData?.documentId || classData?.id || '')
        };
    });
    setAvailableOpeningDecisions(available);
  };

  const fetchClassesForDropdown = async (search: string): Promise<Option[]> => {
    let url = `${COLLECTIONS.CLASSES}?pagination[pageSize]=20`;
    if (search) {
       url += `&filters[$or][0][name][$containsi]=${encodeURIComponent(search)}&filters[$or][1][code][$containsi]=${encodeURIComponent(search)}`;
    } else {
       url += `&sort[0]=createdAt:desc`;
    }
    const data = await fetchCategory(url);
    if (!data) return [];
    return data.map((c: any) => ({
      id: String(c.documentId || c.id || c.strapiId),
      label: c.name ? `${c.code ? c.code + ' - ' : ''}${c.name}` : 'Không tên',
      data: c
    }));
  };

  const handleTypeLinkSelect = (selectedId: string, optData?: any) => {
    if (!selectedId) {
      setTempStudents([]);
      return;
    }

    if (viewType === 'OPENING') {
      // value from dropdown is c.id, find class by that or use optData
      const selectedClass = optData || availableClasses.find(c => String(c.id) === selectedId || String(c.strapiId) === selectedId || String(c.documentId) === selectedId);
      if (selectedClass) {
        const numericClassId = String(selectedClass.id || selectedClass.strapiId || selectedClass.documentId || '');
        setFormData({
          ...formData,
          className: selectedClass.name || selectedClass.attributes?.name || '',
          classCode: selectedClass.code || selectedClass.attributes?.code || '',
          classId: numericClassId
        });

        // LAZY LOAD: fetch only students for this specific class from the API
        // This avoids loading 500k+ students into browser memory
        setLoading(true);
        loadStudentsByClass(numericClassId).then(classStudents => {
          // Only include students who are approved AND not already assigned to another opening decision
          const approvedStudents = classStudents.filter(s => {
            const isApproved = (s as any).isApproved === true;
            const isAlreadyAssigned = assignedStudentIds.has(String(s.id)) || assignedStudentIds.has(String((s as any).strapiId));
            return isApproved && !isAlreadyAssigned;
          });
          
          const mappedStudents: DecisionDetail[] = approvedStudents.map((s, idx) => ({
            id: s.id,
            stt: idx + 1,
            fullName: s.fullName,
            dob: s.dob || '',
            cardNumber: s.cardNumber || s.idNumber || '',
            studentCode: s.studentCode,
            years: '',
            hometown: s.pob || '',
            address: (s as any).address || '',
            phone: (s as any).phone || '',
            notes: '',
            gender: s.gender || '',
            documents: s.documents || [],
            photo: s.photo,
          }));
          // Update allStudents so the picker table can show them
          setAllStudents(approvedStudents);
          setTempStudents(mappedStudents);
          setLoading(false);
        });
      }
    } else {
      const openingDecision = availableOpeningDecisions.find(d => String(d.id) === selectedId);
      if (openingDecision) {
        setFormData({
          ...formData,
          className: openingDecision.className,
          classCode: openingDecision.classCode,
          trainingCourse: openingDecision.trainingCourse,
          classId: openingDecision.classId || '',
          relatedOpeningId: String(openingDecision.id)
        });

        // Lazy fetch the fully populated OPENING decision to get complete student details for mapping
        setLoading(true);
        fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${selectedId}&${DEEP_POPULATE_STUDENTS}`)
          .then((raw) => {
            if (raw && raw.length > 0) {
              const fullOpeningDecision = raw[0];
              const studentsData = fullOpeningDecision.students?.data || fullOpeningDecision.students || [];
              const mappedFullStudents = Array.isArray(studentsData) ? studentsData.map((s: any, sIdx: number) => {
                const item = s.attributes || s;
                return {
                  id: String(s.documentId || s.id),
                  strapiId: s.strapiId || s.id,
                  stt: sIdx + 1,
                  fullName: item.full_name || item.fullName || '',
                  gender: item.gender || 'Nam',
                  dob: item.dob || '',
                  studentCode: item.student_code || item.studentCode || item.code || '',
                  hometown: item.pob || '',
                  address: item.address || '',
                  phone: item.phone || '',
                  cardNumber: item.card_number || item.id_number || '',
                  years: '',
                  notes: item.notes || '',
                  documents: (Array.isArray(item.documents) ? item.documents : item.documents?.data || []).map((doc: any) => ({
                    id: doc.documentId || doc.id,
                    name: doc.attributes?.name || doc.name,
                    url: doc.attributes?.url || doc.url,
                    type: doc.attributes?.mime || doc.type || 'application/pdf'
                  })),
                  photo: item.photo || null
                };
              }) : [];

              const gradeRecord = examGrades.find(eg => {
                const did = eg.decision?.documentId || eg.decision?.id;
                return String(did) === String(openingDecision.id);
              });

              if (gradeRecord && gradeRecord.grades) {
                const passingStudents: DecisionDetail[] = [];
                const subjectGrades = gradeRecord.grades;

                // Find the class to get the list of required subjects
                const classObj = availableClasses.find(c => String(c.id) === String(openingDecision.classId));
                const requiredSubjects = classObj?.subjects || [];

                mappedFullStudents.forEach(s => {
                  let hasAllGrades = true;

                  if (requiredSubjects.length === 0) {
                    hasAllGrades = true;
                  } else {
                    if (subjectGrades && typeof subjectGrades === 'object') {
                      for (const subj of requiredSubjects) {
                        const subId = String(subj.strapiId || subj.id);
                        const sGrades = subjectGrades[subId]?.[s.studentCode];
                        if (sGrades === undefined || sGrades === null || sGrades === '') {
                          hasAllGrades = false;
                          break;
                        }
                      }
                    } else {
                      hasAllGrades = false;
                    }
                  }

                  if (hasAllGrades) passingStudents.push(s);
                });
                
                // Re-index passing students STT
                setTempStudents(passingStudents.map((ps, idx) => ({ ...ps, stt: idx + 1 })));
              } else {
                setTempStudents([]);
              }
            }
          })
          .catch(e => {
             console.error("Failed to load opening decision details", e);
             setTempStudents([]);
          })
          .finally(() => {
             setLoading(false);
          });
      }
    }
  };

  const checkIfLocked = (id: string | null) => {
    if (!id || viewType !== 'OPENING') return false;
    return lockedOpeningIds.has(String(id));
  };

  const handleSaveDecision = async () => {
    if (editingId && checkIfLocked(editingId)) {
      const confirmForce = window.confirm("CẢNH BÁO: Quyết định này đã có QĐ Công nhận tốt nghiệp. Việc sửa đổi dữ liệu (đặc biệt là danh sách học viên) có thể làm sai lệch dữ liệu điểm và chứng chỉ! Bạn có CHẮC CHẮN muốn LƯU đè không?");
      if (!confirmForce) return;
    }
    if (!formData.number) {
      alert("Vui lòng nhập Số quyết định!");
      return;
    }

    // Validation: Check for duplicate training course codes within the same type
    if (formData.trainingCourse) {
      const duplicateCheck = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=${viewType}&filters[training_course][$eq]=${encodeURIComponent(formData.trainingCourse)}`);
      const isDuplicate = duplicateCheck && duplicateCheck.some((d: any) => String(d.documentId || d.id) !== String(editingId));

      if (isDuplicate) {
        alert(`Lỗi: Đợt/Khóa "${formData.trainingCourse}" đã tồn tại trong hệ thống quyết định ${viewType === 'OPENING' ? 'mở lớp' : 'công nhận'}. Vui lòng kiểm tra lại.`);
        return;
      }
    }

    // --- Validation: Check Duplicate Decision Number in the same YEAR ---
    if (formData.number && formData.signedDate) {
      const currentYear = new Date(formData.signedDate).getFullYear();
      const duplicateCheck = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[decision_number][$eq]=${encodeURIComponent(formData.number)}`);
      const isDuplicateNumberInYear = duplicateCheck && duplicateCheck.some((d: any) => {
         if (String(d.documentId || d.id) === String(editingId)) return false;
         if (!d.signed_date) return false;
         const decYear = new Date(d.signed_date).getFullYear();
         return decYear === currentYear;
      });

      if (isDuplicateNumberInYear) {
        alert("THÔNG BÁO: Bạn đã có số QĐ này trong năm nay rồi. Vui lòng kiểm tra lại.");
        return;
      }
    }
    // -------------------------------------------------------------------

    try {
      // Strapi v5 requires numeric IDs for relations, not documentId strings
      // Map classId (documentId) -> numeric strapiId
      let classNumericId: number | null = null;
      if (formData.classId) {
        const classObj = availableClasses.find(c =>
          String(c.id) === String(formData.classId) ||
          String(c.documentId) === String(formData.classId) ||
          String(c.strapiId) === String(formData.classId)
        );
        classNumericId = classObj ? Number(classObj.strapiId || classObj.id) : null;
      }

      // Map student documentIds -> numeric strapiIds
      const studentNumericIds = tempStudents.map((s: any) => {
        // If we already have the numeric strapiId, use it directly (Strapi v5 compatible)
        if (s.strapiId && !isNaN(Number(s.strapiId))) {
          return Number(s.strapiId);
        }
        
        // Otherwise, try to find it in the allStudents list
        const stu = allStudents.find((st: any) =>
          String(st.id) === String(s.id) ||
          String(st.documentId) === String(s.id) ||
          String((st as any).strapiId) === String(s.id)
        );
        
        if (stu) return Number((stu as any).strapiId || stu.id);
        
        // Fallback: if the id itself is numeric, it might be the strapiId
        if (s.id && !isNaN(Number(s.id))) return Number(s.id);
        
        return null;
      }).filter(Boolean);
      console.log('DEBUG: tempStudents', tempStudents);
      console.log('DEBUG: mapped studentNumericIds', studentNumericIds);


      const payload: any = {
        decision_number: formData.number,
        type: viewType,
        training_course: formData.trainingCourse,
        signed_date: formData.signedDate,
        signer_name: formData.signer,
        notes: formData.notes,
        school_class: classNumericId,
        students: studentNumericIds
      };

      if (viewType === 'RECOGNITION' && formData.relatedOpeningId) {
        // Map related_decision documentId -> numeric strapiId
        const relDec = decisions.find((d: any) =>
          String(d.id) === String(formData.relatedOpeningId) ||
          String(d.documentId) === String(formData.relatedOpeningId)
        );
        payload.related_decision = relDec ? Number(relDec.strapiId || relDec.id) : formData.relatedOpeningId;
      }

      if (editingId) {
        await updateCategory(COLLECTIONS.CLASS_DECISIONS, editingId, payload);
        await createLog(
          'UPDATE_DECISION',
          currentUser?.name || 'Unknown',
          `Cập nhật Quyết định ${viewType} số ${formData.number}`,
          editingId
        );
      } else {
        const newDec = await createCategory(COLLECTIONS.CLASS_DECISIONS, payload);
        await createLog(
          'CREATE_DECISION',
          currentUser?.name || 'Unknown',
          `Tạo mới Quyết định ${viewType} số ${formData.number}`,
          String(newDec?.id || newDec?.documentId || '')
        );
      }

      await loadDecisions();
      setIsFormOpen(false);
      alert("Đã lưu thành công!");
    } catch (e) {
      console.error("Save failed:", e);
      alert("Lỗi khi lưu dữ liệu. Vui lòng kiểm tra lại.");
    }
  };

  const removeStudentFromTemp = (id: string) => {
    setTempStudents(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, stt: idx + 1 })));
  };

  const handleAddStudentsToTemp = () => {
    const studentsToAdd = allStudents.filter(s => selectedStudentsToAdd.has(s.id));
    const existingIds = new Set(tempStudents.map(ts => ts.id));
    const newDetails = studentsToAdd.filter(s => !existingIds.has(s.id)).map((s, idx) => ({
      id: s.id,
      stt: tempStudents.length + idx + 1,
      fullName: s.fullName,
      dob: s.dob,
      cardNumber: s.cardNumber || s.idNumber,
      studentCode: s.studentCode,
      years: '',
      hometown: s.pob,
      address: (s as any).address || '',
      phone: (s as any).phone || '',
      notes: '',
      photo: s.photo,
    } as DecisionDetail));
    setTempStudents([...tempStudents, ...newDetails]);
    setIsAddStudentModalOpen(false);
    setSelectedStudentsToAdd(new Set());
  };

  const handleOpenEditStudent = (student: DecisionDetail, index: number) => {
    setEditingStudentIndex(index);
    setEditingStudentData({ ...student });
    setIsEditCameraLive(false);
    setIsEditStudentModalOpen(true);
  };

  const startEditCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      if (editVideoRef.current) {
        editVideoRef.current.srcObject = stream;
        setIsEditCameraLive(true);
      }
    } catch {
      alert('Không thể truy cập Camera. Vui lòng kiểm tra quyền trình duyệt.');
    }
  };

  const stopEditCamera = () => {
    if (editVideoRef.current?.srcObject) {
      (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      editVideoRef.current.srcObject = null;
    }
    setIsEditCameraLive(false);
  };

  const captureEditPhoto = () => {
    if (editVideoRef.current && editCanvasRef.current && editingStudentData) {
      const canvas = editCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 600;
        canvas.height = 800;
        const video = editVideoRef.current;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const ratio = 3 / 4;
        let sX = 0, sY = 0, sW = vw, sH = vh;
        if (vw / vh > ratio) { sW = vh * ratio; sX = (vw - sW) / 2; }
        else { sH = vw / ratio; sY = (vh - sH) / 2; }
        ctx.drawImage(video, sX, sY, sW, sH, 0, 0, 600, 800);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setEditingStudentData({ ...editingStudentData, photo: dataUrl });
        stopEditCamera();
      }
    }
  };

  const handleUpdateStudentInfo = async () => {
    if (editingStudentIndex === null || !editingStudentData) return;
    stopEditCamera();
    
    const newList = [...tempStudents];
    newList[editingStudentIndex] = { ...editingStudentData };
    setTempStudents(newList);
    setIsEditStudentModalOpen(false);

    // Ghi ngược vào Hồ sơ gốc (Quản lý học viên)
    if (window.confirm("Bạn có muốn cập nhật thông tin (bao gồm ảnh, SĐT, địa chỉ) vào Hồ sơ gốc (Quản lý học viên) không?")) {
      try {
        const studentId = editingStudentData.id;
        
        let finalPhotoUrl = editingStudentData.photo;
        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image/')) {
           const uploadedInfo = await uploadFile(finalPhotoUrl, `avatar_edit_${editingStudentData.studentCode || Date.now()}.jpg`);
           if (uploadedInfo && uploadedInfo.length > 0) {
              finalPhotoUrl = uploadedInfo[0].url;
           }
        }

        if (studentId) {
          await updateCategory('students', studentId, {
            full_name: editingStudentData.fullName.toUpperCase(),
            dob: editingStudentData.dob,
            card_number: editingStudentData.cardNumber,
            id_number: editingStudentData.cardNumber,
            pob: editingStudentData.hometown,
            phone: editingStudentData.phone || '',
            address: editingStudentData.address || '',
            photo: finalPhotoUrl || null,
            notes: editingStudentData.notes || ''
          });
          
          // Local sync
          setAllStudents(prev => prev.map(s => s.id === studentId ? { 
            ...s, 
            fullName: editingStudentData.fullName.toUpperCase(),
            dob: editingStudentData.dob,
            cardNumber: editingStudentData.cardNumber,
            idNumber: editingStudentData.cardNumber,
            pob: editingStudentData.hometown,
            phone: editingStudentData.phone || '',
            address: editingStudentData.address || '',
            photo: finalPhotoUrl || null
          } : s));
          
          // Also update the temp list with the uploaded URL so we don't hold base64 in RAM
          newList[editingStudentIndex].photo = finalPhotoUrl || null;
          setTempStudents([...newList]);
          
          console.log('Updated source student record successfully.');
        }
      } catch (err) {
        console.error('Failed to update source student record:', err);
        alert('Thông tin quyết định đã đổi nhưng không thể cập nhật Hồ sơ gốc.');
      }
    }
    
    setEditingStudentIndex(null);
    setEditingStudentData(null);
  };

  const toggleStudentSelection = (id: string) => {
    const newSelection = new Set(selectedStudentsToAdd);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedStudentsToAdd(newSelection);
  };

  const handleDeleteDecision = async (id: string, e: React.MouseEvent) => {
    if (checkIfLocked(id)) {
      alert("KHÔNG THỂ XÓA: Quyết định mở lớp này đã có Quyết định công nhận tương ứng. Vui lòng xóa Quyết định công nhận trước nếu cần thay đổi.");
      return;
    }
    e.stopPropagation();
    if (window.confirm("Bạn có chắc chắn muốn xóa?")) {
      try {
        await deleteCategory(COLLECTIONS.CLASS_DECISIONS, id);

        // Find the decision to log its number
        const deletedDec = decisions.find(d => d.id === id);
        await createLog(
          'DELETE_DECISION',
          currentUser?.name || 'Unknown',
          `Xóa Quyết định ${deletedDec?.type || ''} số ${deletedDec?.number || 'Unknown'}`,
          id
        );

        loadDecisions();
      } catch (e) { alert("Xóa thất bại."); }
    }
  };

  const handleUnlockDecision = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Tìm quyết định CÔNG NHẬN đang khóa quyết định MỞ LỚP này trên server
    const blockCheck = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=RECOGNITION&filters[related_decision][documentId][$eq]=${id}&fields[0]=decision_number`);
    if (!blockCheck || blockCheck.length === 0) return;
    const blockingDecision = blockCheck[0];

    if (window.confirm(`Quyết định này đang bị khóa bởi Quyết định công nhận số: ${blockingDecision.decision_number || 'Không rõ'}.\n\nBạn có muốn XÓA Quyết định công nhận này để mở khóa và chỉnh sửa thông tin không?`)) {
      try {
        await deleteCategory(COLLECTIONS.CLASS_DECISIONS, String(blockingDecision.documentId || blockingDecision.id));
        
        await createLog(
          'UNLOCK_DECISION',
          currentUser?.name || 'Unknown',
          `Mở khóa QĐ Mở lớp bằng cách xóa QĐ Công nhận số ${blockingDecision.decision_number}`,
          id
        );

        loadDecisions();
      } catch (e) {
        alert("Mở khóa thất bại.");
      }
    }
  };

  const handleOpenEditDecision = async (d: DecisionRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (checkIfLocked(d.id) && !e) {
      alert("LƯU Ý: Quyết định này đã có QĐ Công nhận. Hệ thống khuyến cáo không nên sửa. Nếu bạn vẫn muốn sửa, hãy cẩn thận vì nó ảnh hưởng đến QĐ Công nhận liên quan.");
    }
    
    setEditingId(d.id);
    setFormData({
      number: d.number, signedDate: d.signedDate, signer: d.signer,
      location: d.location, company: d.company, classType: d.classType,
      classCode: d.classCode, className: d.className, trainingCourse: d.trainingCourse, notes: d.notes, classId: d.classId || '', relatedOpeningId: d.relatedOpeningId || '', startIndex: '1'
    });
    
    // Clear tempStudents initially while fetching full data
    setTempStudents([]);
    if (d.type === 'RECOGNITION') {
      loadAvailableOpeningDecisions(d.id);
    }
    setIsFormOpen(true);
    setLoading(true);

    try {
      if (d.type === 'OPENING') {
        // Lazy load full details for this OPENING decision
        const raw = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${d.id}&${DEEP_POPULATE_STUDENTS}`);
        if (raw && raw.length > 0) {
          const fetchedD = raw[0];
          const studentsData = fetchedD.students?.data || fetchedD.students || [];
          const mappedStudents = Array.isArray(studentsData) ? studentsData.map((s: any, sIdx: number) => {
            const item = s.attributes || s;
            return {
              id: String(s.documentId || s.id),
              strapiId: s.strapiId || s.id,
              stt: sIdx + 1,
              fullName: item.full_name || item.fullName || '',
              gender: item.gender || 'Nam',
              dob: item.dob || '',
              studentCode: item.student_code || item.studentCode || item.code || '',
              hometown: item.pob || '',
              address: item.address || '',
              phone: item.phone || '',
              cardNumber: item.card_number || item.id_number || '',
              years: '',
              notes: item.notes || '',
              documents: (Array.isArray(item.documents) ? item.documents : item.documents?.data || []).map((doc: any) => ({
                id: doc.documentId || doc.id,
                name: doc.attributes?.name || doc.name,
                url: doc.attributes?.url || doc.url,
                type: doc.attributes?.mime || doc.type || 'application/pdf'
              })),
              photo: item.photo || null
            };
          }) : [];
          setTempStudents(mappedStudents);
        } else {
          setTempStudents(d.students || []);
        }
      } else {
        // For RECOGNITION decisions, students are dynamically calculated based on the related OPENING decision and grades
        if (d.relatedOpeningId) {
          const raw = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${d.relatedOpeningId}&${DEEP_POPULATE_STUDENTS}`);
          if (raw && raw.length > 0) {
            const fullOpeningDecision = raw[0];
            const studentsData = fullOpeningDecision.students?.data || fullOpeningDecision.students || [];
            const mappedFullStudents = Array.isArray(studentsData) ? studentsData.map((s: any, sIdx: number) => {
              const item = s.attributes || s;
              return {
                id: String(s.documentId || s.id),
                strapiId: s.strapiId || s.id,
                stt: sIdx + 1,
                fullName: item.full_name || item.fullName || '',
                gender: item.gender || 'Nam',
                dob: item.dob || '',
                studentCode: item.student_code || item.studentCode || item.code || '',
                hometown: item.pob || '',
                address: item.address || '',
                phone: item.phone || '',
                cardNumber: item.card_number || item.id_number || '',
                years: '',
                notes: item.notes || '',
                documents: (Array.isArray(item.documents) ? item.documents : item.documents?.data || []).map((doc: any) => ({
                  id: doc.documentId || doc.id,
                  name: doc.attributes?.name || doc.name,
                  url: doc.attributes?.url || doc.url,
                  type: doc.attributes?.mime || doc.type || 'application/pdf'
                })),
                photo: item.photo || null
              };
            }) : [];

            const gradeRecord = examGrades.find(eg => {
              const did = eg.decision?.documentId || eg.decision?.id;
              return String(did) === String(d.relatedOpeningId);
            });

            if (gradeRecord && gradeRecord.grades) {
              const passingStudents: DecisionDetail[] = [];
              const subjectGrades = gradeRecord.grades;

              const classObj = availableClasses.find(c => String(c.id) === String(fullOpeningDecision.school_class?.data?.documentId || fullOpeningDecision.school_class?.documentId || d.classId));
              const requiredSubjects = classObj?.subjects || [];

              mappedFullStudents.forEach(s => {
                let hasAllGrades = true;

                if (requiredSubjects.length === 0) {
                  hasAllGrades = true;
                } else {
                  if (subjectGrades && typeof subjectGrades === 'object') {
                    for (const subj of requiredSubjects) {
                      const subId = String(subj.strapiId || subj.id);
                      const sGrades = subjectGrades[subId]?.[s.studentCode];
                      if (sGrades === undefined || sGrades === null || sGrades === '') {
                        hasAllGrades = false;
                        break;
                      }
                    }
                  } else {
                    hasAllGrades = false;
                  }
                }

                if (hasAllGrades) passingStudents.push(s);
              });
              
              setTempStudents(passingStudents.map((ps, idx) => ({ ...ps, stt: idx + 1 })));
            } else {
              setTempStudents([]);
            }
          } else {
             setTempStudents(d.students || []);
          }
        } else {
          setTempStudents(d.students || []);
        }
      }
    } catch (err) {
      console.error("Failed to load full decision details", err);
      setTempStudents(d.students || []); // Fallback
    }

    // After setting tempStudents, we need to fetch shared documents by id_number for all loaded students
    setTempStudents(prev => {
      // Create a local copy to work with asynchronously
      const finalStudents = [...prev];
      if (finalStudents.length > 0) {
        // Run async without blocking UI initially, update when done
        const idNumbers = finalStudents.map(s => s.cardNumber || (s as any).idNumber || s.studentCode).filter(Boolean);
        if (idNumbers.length > 0) {
          try {
            // Group into chunks of 50 to avoid URL too long
            const chunkSize = 50;
            const promises = [];
            for (let i = 0; i < idNumbers.length; i += chunkSize) {
              const chunk = idNumbers.slice(i, i + chunkSize);
              const idQueries = chunk.map((id, idx) => `filters[id_number][$in][${idx}]=${encodeURIComponent(id)}`).join('&');
              promises.push(fetchCategory(`${COLLECTIONS.STUDENT_DOCUMENTS}?${idQueries}&pagination[pageSize]=1000`));
            }

            Promise.all(promises).then(results => {
              const allSharedDocs = results.flat();
              if (allSharedDocs.length > 0) {
                setTempStudents(currentStudents => currentStudents.map(s => {
                  const sId = s.cardNumber || (s as any).idNumber || s.studentCode;
                  const shared = allSharedDocs.filter((doc: any) => doc.id_number === sId).map((doc: any) => ({
                    id: String(doc.documentId || doc.id),
                    name: doc.name || doc.attributes?.name,
                    url: doc.url || doc.attributes?.url,
                    type: doc.type || doc.attributes?.type
                  }));

                  // Merge and deduplicate by URL
                  const allDocs = [...(s.documents || []), ...shared];
                  const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.url, doc])).values());
                  return { ...s, documents: uniqueDocs };
                }));
              }
            });
          } catch (e) {
            console.error("Failed to fetch shared documents", e);
          }
        }
      }
      return finalStudents;
    });

    // Load students for the class (even for recognition, we might want to manually add more students)
    if (d.classId) {
      loadStudentsByClass(d.classId).then(classStudents => {
        const approvedStudents = classStudents.filter(s => (s as any).isApproved === true);
        setAllStudents(approvedStudents);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  const handleOpenAddStudentModal = async () => {
    if (formData.classId) {
      setLoading(true);
      const assignedData = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=OPENING&populate[students][fields][0]=id`);
      const serverAssignedIds = new Set<string>();
      if (assignedData) {
        assignedData.forEach((d: any) => {
          const studs = d.students?.data || d.students || [];
          studs.forEach((s: any) => {
            serverAssignedIds.add(String(s.documentId || s.id));
            if (s.strapiId) serverAssignedIds.add(String(s.strapiId));
          });
        });
      }

      loadStudentsByClass(formData.classId).then(classStudents => {
        // filter out unapproved AND currently assigned students to OTHER opening decisions
        const approvedStudents = classStudents.filter(s => {
          const isApproved = (s as any).isApproved === true;
          const isAlreadyAssigned = serverAssignedIds.has(String(s.id)) || serverAssignedIds.has(String((s as any).strapiId));
          const isAlreadyInThisDecision = tempStudents.some(ts => String(ts.id) === String(s.id) || String(ts.id) === String((s as any).strapiId));
          return isApproved && (!isAlreadyAssigned || isAlreadyInThisDecision);
        });
        setAllStudents(approvedStudents);
        setLoading(false);
        setIsAddStudentModalOpen(true);
      });
    } else {
      setIsAddStudentModalOpen(true);
    }
  };

  // --- Printing Logic ---
  const DECISION_DEFAULTS = {
    headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
    headerLine2: 'TRƯỜNG CAO ĐẲNG',
    headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    nation: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'QUYẾT ĐỊNH',
    subtitle: 'Về việc Mở lớp {{CLASS_NAME}}',
    subtext: '',
    course: '',
    authority: 'HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    preamble: `Căn cứ Quyết định số 1275/QĐ-BGDĐT ngày 12/5/2025 của Bộ trưởng Bộ Giáo dục và Đào tạo về việc sáp nhập Trường Cao đẳng Giao thông vận tải Đường thủy I vào Trường Cao đẳng Hàng hải I và đổi tên thành Trường Cao đẳng Hàng hải và Đường thủy I;\nCăn cứ Quyết định số 1878/QĐ-CĐHHĐTI ngày 31/12/2025 của Hiệu trưởng trường Cao đẳng Hàng hải và Đường thủy I về việc ban hành Quy chế Tổ chức, hoạt động của Trường Cao đẳng Hàng hải và Đường thủy I;\nCăn cứ Thông tư số 20/2023/TT-BGTVT ngày 30/06/2023 của Bộ trưởng Bộ GTVT về tiêu chuẩn chuyên môn, chứng chỉ chuyên môn của thuyền viên và định biên an toàn tối thiểu của tàu biển Việt Nam;\nCăn cứ Thông tư số 57/2023/TT-BGTVT ngày 31/12/2023 của Bộ trưởng Bộ GTVT về Chương trình đào tạo, huấn luyện thuyền viên, hoa tiêu hàng hải;\nCăn cứ Giấy chứng nhận số 03/GCN-CHHĐTVN ngày 12/09/2025 của Cục Hàng hải và Đường thủy Việt Nam về việc chứng nhận Trường Cao đẳng Hàng hải và Đường thủy I đủ điều kiện tổ chức các khóa đào tạo, huấn luyện thuyền viên hàng hải và cấp chứng chỉ huấn luyện;\nTheo đề nghị của Giám đốc Trung tâm Đào tạo Phát triển nguồn lực.`,
    article1: 'Mở lớp {{CLASS_NAME}}; Khóa: {{TRAINING_COURSE}} Theo Nghị quyết MSC.560(108) của IMO (U.BTC-K18/2026, có danh sách kèm theo) tại Trung tâm Đào tạo Phát triển nguồn lực, Trường Cao đẳng Hàng hải và Đường thủy I.',
    article2: 'Giao cho Trung tâm Đào tạo Phát triển nguồn lực chịu trách nhiệm tổ chức lớp huấn luyện; bố trí giảng viên, huấn luyện viên giảng dạy theo nội dung chương trình huấn luyện, đào tạo đã được phê duyệt.',
    article3: 'Giám đốc Trung tâm Đào tạo Phát triển nguồn lực, Trưởng các đơn vị có liên quan trong trường chịu trách nhiệm thi hành quyết định này.',
    signerTitle: 'KT. HIỆU TRƯỞNG\nPHÓ HIỆU TRƯỞNG',
    signerName: ' ĐỖ HỒNG HẢI',
    recipients: '- Báo cáo Hiệu trưởng;\n- Như điều 3;\n- Lưu: VT, TTĐT&PTNL.'
  };

  const RECOGNITION_DEFAULTS = {
    headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
    headerLine2: 'TRƯỜNG CAO ĐẲNG',
    headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    nation: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'QUYẾT ĐỊNH',
    subtitle: 'Về việc Công nhận tốt nghiệp {{CLASS_NAME}}',
    subtext: '',
    course: '',
    authority: 'HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    preamble: `Căn cứ Quyết định số 1275/QĐ-BGDĐT ngày 12/5/2025...;\nCăn cứ Quy chế đào tạo...;\nTheo đề nghị của Hội đồng xét tốt nghiệp.`,
    article1: 'Công nhận {{STUDENT_COUNT}} học viên lớp {{CLASS_NAME}} đã hoàn thành khóa học...',
    article2: 'Các học viên có tên trong danh sách được cấp chứng chỉ theo quy định...',
    article3: 'Giám đốc Trung tâm Đào tạo Phát triển nguồn lực, Trưởng các đơn vị có liên quan và các học viên có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.',
    signerTitle: 'KT. HIỆU TRƯỞNG\nPHÓ HIỆU TRƯỞNG',
    signerName: 'ĐỖ HỒNG HẢI',
    recipients: '- Báo cáo Hiệu trưởng;\n- Như điều 3;\n- Lưu: VT, TTĐT&PTNL.'
  };

  const CERTIFICATE_LIST_DEFAULTS = {
    headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
    headerLine2: 'TRƯỜNG CAO ĐẲNG',
    headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    nation: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'DANH SÁCH',
    subtitle: 'Đề nghị cấp giấy chứng nhận huấn luyện nghiệp vụ',
    preamble: 'Lớp {{CLASS_NAME}}\nKhóa: {{TRAINING_COURSE}}\nTừ {{START_DATE}} đến {{END_DATE}}',
    signerTitle: 'GIÁM ĐỐC TRUNG TÂM DT&PTNL',
    signerName: 'LÊ THẾ SƠN',
    signerTitle2: 'PHỤ TRÁCH LẬP BẢNG',
    signerName2: '...',
  };

  const handlePrintRequestList = () => {
    // 1. Get Template
    let template = CERTIFICATE_LIST_DEFAULTS;
    const serverTemplate = printTemplates.find(t => t.type === 'certificate_list');
    if (serverTemplate && serverTemplate.content) {
      template = { ...template, ...serverTemplate.content };
    }

    const matchingAssignment = assignments.find(a => {
      // Find the decision relation from various possible Strapi structures
      let decRel = null;
      if (typeof a.decision === 'object' && a.decision !== null) {
          decRel = a.decision.data || a.decision;
      } else if (a.related_decision) { // Fallback in case the field was renamed
          decRel = a.related_decision.data || a.related_decision;
      }
      
      if (!decRel) return false;
      
      // Extract possible IDs from the relation object
      const decDocId = String(decRel.documentId || decRel.id || '');
      const decNumId = String(decRel.id || decRel.strapiId || '');
      const targetId = String(formData.relatedOpeningId);
      
      // Log for debugging (visible in user browser)
      console.log('Comparing Assignment', a.id, 'with target', targetId, '-> doc:', decDocId, 'num:', decNumId);
      
      return decDocId === targetId || decNumId === targetId;
    });

    let startDateText = '(Chưa xếp lịch học)';
    let endDateText = '(Chưa xếp lịch học)';

    if (matchingAssignment && matchingAssignment.schedule && matchingAssignment.schedule.length > 0) {
      const dates = matchingAssignment.schedule
        .map((r: any) => r.date)
        .filter(Boolean)
        .sort();

      if (dates.length > 0) {
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];

        const [y1, m1, d1] = firstDate.split('-').map(Number);
        const [y2, m2, d2] = lastDate.split('-').map(Number);

        startDateText = `ngày ${String(d1).padStart(2,'0')} tháng ${String(m1).padStart(2,'0')} năm ${y1}`;
        endDateText = `ngày ${String(d2).padStart(2,'0')} tháng ${String(m2).padStart(2,'0')} năm ${y2}`;
      }
    }

    // 3. Replace Placeholders
    const replaceMap: Record<string, string> = {
      '{{CLASS_NAME}}': formData.className || '...',
      '{{TRAINING_COURSE}}': formData.trainingCourse || '...',
      '{{DATE}}': formData.signedDate ? `ngày ${new Date(formData.signedDate).getDate()} tháng ${new Date(formData.signedDate).getMonth() + 1} năm ${new Date(formData.signedDate).getFullYear()}` : '...',
      '{{START_DATE}}': startDateText,
      '{{END_DATE}}': endDateText,
    };

    let content: any = { ...template };
    Object.keys(content).forEach((k) => {
      if (typeof content[k] === 'string') {
        let text = content[k] as string;
        Object.keys(replaceMap).forEach(ph => {
          text = text.split(ph).join(replaceMap[ph]);
        });
        content[k] = text;
      }
    });

    // 3. Get Subjects and Grades
    const classObj = availableClasses.find(c => String(c.id) === String(formData.classId) || String(c.documentId) === String(formData.classId));
    const subjects = classObj?.subjects || [];

    const gradeRecord = examGrades.find(eg => {
      const did = eg.decision?.documentId || eg.decision?.id;
      return String(did) === String(formData.relatedOpeningId);
    });
    const subjectGrades = gradeRecord?.grades || {};

    // 4. Build Table content
    const subjectHeaders = subjects.map((subj: any) => `
      <th style="border:1px solid black;padding:4px;text-align:center;font-size:9pt;">${subj.name}</th>
    `).join('');

    const sortedStudents = [...tempStudents].sort((a, b) => {
      const aName = a.fullName.trim().split(' ');
      const bName = b.fullName.trim().split(' ');
      const aTen = aName[aName.length - 1] || '';
      const bTen = bName[bName.length - 1] || '';
      const cmp = aTen.localeCompare(bTen, 'vi', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      // Secondary sort by full name if same last name
      return a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' });
    });

    const studentRows = sortedStudents.map((s, i) => {
      const nameParts = s.fullName.trim().split(' ');
      const ten = nameParts.pop() || '';
      const ho = nameParts.join(' ');

      const subjectCells = subjects.map((subj: any) => {
        const subId = String(subj.strapiId || subj.id);
        const gradeObj = subjectGrades[subId]?.[s.studentCode];
        let displayGrade = '';

        if (gradeObj) {
          if (typeof gradeObj === 'object') {
            displayGrade = (gradeObj.theory !== undefined && gradeObj.theory !== null && gradeObj.theory !== '') ? String(gradeObj.theory) : (gradeObj.practice !== undefined && gradeObj.practice !== null ? String(gradeObj.practice) : '');
          } else {
            displayGrade = String(gradeObj);
          }
        }

        return `<td style="border:1px solid black;padding:4px;text-align:center;">${displayGrade}</td>`;
      }).join('');

      return `
        <tr>
          <td style="border:1px solid black;padding:4px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid black;padding:4px;" class="uppercase bold">${ho}</td>
          <td style="border:1px solid black;padding:4px;" class="uppercase bold">${ten}</td>
          <td style="border:1px solid black;padding:4px;text-align:center;">${formatDate(s.dob)}</td>
          <td style="border:1px solid black;padding:4px;text-align:center;mso-number-format:'\\@';">${s.cardNumber || ''}</td>

          <td style="border:1px solid black;padding:4px;">${s.hometown || ''}</td>
          ${subjectCells}
          <td style="border:1px solid black;padding:4px;">${s.notes || ''}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Danh sách đề nghị cấp GCN</title>
          <style>
             body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; }
             table.layout-grid { width: 100%; border: none; margin-bottom: 20px; }
             td.layout-cell { vertical-align: top; }
             .uppercase { text-transform: uppercase; }
             .bold { font-weight: bold; }
             .italic { font-style: italic; }
             .title { text-align: center; margin: 10px 0; }
             
             table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
             table.data-table td, table.data-table th { border: 1px solid black; padding: 4px; }
             @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm; }
             div.Section1 { page: Section1; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <table class="layout-grid">
              <tr>
                <td class="layout-cell" style="text-align: center; width: 45%;">
                  <div class="uppercase">${content.headerLine1}</div>
                  <div class="bold uppercase">${content.headerLine2}</div>
                  <div class="bold uppercase">${content.headerLine3}</div>
                </td>
                <td class="layout-cell" style="text-align: center; width: 55%;">
                  <div class="uppercase bold">${content.nation}</div>
                  <div class="bold">${content.motto}</div>
                  <div class="italic" style="margin-top:5px;">Hải Phòng, ${replaceMap['{{DATE}}']}</div>
                </td>
              </tr>
            </table>

            <div class="title">
              <div class="uppercase bold" style="font-size: 14pt;">${content.title}</div>
              <div class="uppercase bold" style="font-size: 12pt;">${content.subtitle}</div>
              <div class="bold" style="white-space: pre-line; margin-top: 5px;">${content.preamble}</div>
            </div>

            <table class="data-table">
              <thead>
                <tr style="background-color: #f2f2f2;">
                  <th style="width:30px;">STT</th>
                  <th colspan="2">HỌ VÀ TÊN</th>
                  <th style="width:80px;">NGÀY SINH</th>
                  <th style="width:100px;">SỐ CCCD</th>
                  <th>NƠI SINH</th>
                  ${subjectHeaders}
                  <th style="width:80px;">GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                ${studentRows}
              </tbody>
            </table>

            <table class="layout-grid" style="margin-top: 30px;">
              <tr>
                <td class="layout-cell" style="text-align: center; width: 50%;">
                  <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 60px;">${content.signerTitle2}</div>
                  <div class="uppercase bold">${content.signerName2}</div>
                </td>
                <td class="layout-cell" style="text-align: center; width: 50%;">
                  <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 60px;">${content.signerTitle}</div>
                  <div class="uppercase bold">${content.signerName}</div>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DS_DeNghi_${formData.number ? formData.number.replace(/\//g, '_') : 'Draft'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintDecision = () => {
    // 1. Get Template
    let template = DECISION_DEFAULTS;
    let key = 'edumaster_decision_template';
    if (viewType === 'RECOGNITION') {
      template = RECOGNITION_DEFAULTS;
      key = 'edumaster_recognition_template';
    }

    const type = viewType === 'OPENING' ? 'decision' : 'recognition';
    const serverTemplate = printTemplates.find(t => t.type === type);
    if (serverTemplate && serverTemplate.content) {
      template = { ...template, ...serverTemplate.content };
    }

    // 2. Replace Placeholders
    const replaceMap: Record<string, string> = {
      '{{CLASS_NAME}}': formData.className || '...',
      '{{TRAINING_COURSE}}': formData.trainingCourse ? `Khóa: ${formData.trainingCourse}` : '',
      '{{STUDENT_COUNT}}': String(tempStudents.length),
      '{{DECISION_NUMBER}}': formData.number || '...',
      '{{DATE}}': formData.signedDate ? `ngày ${new Date(formData.signedDate).getDate()} tháng ${new Date(formData.signedDate).getMonth() + 1} năm ${new Date(formData.signedDate).getFullYear()}` : '...',
    };

    let content = { ...template };
    Object.keys(content).forEach((k) => {
      const fieldKey = k as keyof typeof template;
      if (typeof content[fieldKey] === 'string') {
        let text = content[fieldKey] as string;
        Object.keys(replaceMap).forEach(ph => {
          text = text.split(ph).join(replaceMap[ph]);
        });
        (content as any)[fieldKey] = text;
      }
    });

    // 3. Build HTML for Word Export
    const studentRows = tempStudents.map((s, i) => `
      <tr>
        <td style="border:1px solid black;padding:4px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid black;padding:4px;" class="uppercase bold">${s.fullName}</td>
        <td style="border:1px solid black;padding:4px;text-align:center;">${formatDate(s.dob)}</td>
        <td style="border:1px solid black;padding:4px;text-align:center;mso-number-format:'\\@';">${s.cardNumber || ''}</td>

        <td style="border:1px solid black;padding:4px;">${s.hometown || ''}</td>
        <td style="border:1px solid black;padding:4px;">${s.notes || ''}</td>
      </tr>
    `).join('');

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${viewType === 'OPENING' ? 'Quyết định Mở lớp' : 'Quyết định Công nhận'}</title>
          <style>
             body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.3; }
             .header { display: flex; justify-content: space-between; margin-bottom: 5px; }
             /* Tables for layout in Word since flexbox support is limited */
             table.layout-grid { width: 100%; border: none; }
             td.layout-cell { vertical-align: top; }
             
             .uppercase { text-transform: uppercase; }
             .bold { font-weight: bold; }
             .italic { font-style: italic; }
             .title { text-align: center; margin: 10px 0; }
             .content-block { text-align: justify; margin-bottom: 10px;} 
             .indent { text-indent: 25px; margin-bottom: 2px; }
             .footer { margin-top: 20px; }
             
             table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
             table.data-table td, table.data-table th { border: 1px solid black; padding: 2px 4px; }
             
             @page { size: A4; margin: 2.0cm 2.0cm 2.0cm 2.5cm; }
          </style>
        </head>
        <body>
          <!-- Header Table for Layout -->
          <table class="layout-grid">
            <tr>
              <td class="layout-cell" style="text-align: center; width: 50%;">
                <div class="uppercase">${content.headerLine1}</div>
                <div class="uppercase bold">${content.headerLine2}</div>
                <div class="uppercase bold">${content.headerLine3}</div>
                <div style="margin-top:5px;">Số: ${formData.number || '...'}</div>
              </td>
              <td class="layout-cell" style="text-align: center; width: 50%;">
                <div class="uppercase bold">${content.nation}</div>
                <div class="bold">${content.motto}</div>
                <div class="italic" style="margin-top:5px;">Hải Phòng, ${replaceMap['{{DATE}}']}</div>
              </td>
            </tr>
          </table>

          <div class="title">
            <div class="uppercase bold" style="font-size: 14pt; margin-bottom: 2px;">${content.title}</div>
            <div class="bold" style="font-size: 13pt; margin-bottom: 2px;">${content.subtitle}</div>
            ${content.subtext ? `<div style="font-size: 11pt; margin-bottom: 2px;">${content.subtext}</div>` : ''}
            ${content.course ? `<div class="bold" style="font-size: 12pt;">${content.course}</div>` : ''}
          </div>

          ${content.authority ? `<div class="uppercase bold" style="text-align:center; margin-bottom:15px; font-size:13pt;">${content.authority}</div>` : ''}

          <div class="content-block">
             ${content.preamble.split('\n').map((l: string) => `<div class="indent" style="font-size:11pt; margin-bottom: 4px;">${l}</div>`).join('')}
             
             <div style="text-align:center; font-weight:bold; font-size:13pt; margin: 15px 0;">QUYẾT ĐỊNH:</div>

             <div class="indent"><span class="bold">Điều 1.</span> ${content.article1?.replace(/\n/g, '<br/>')}</div>
             <div class="indent"><span class="bold">Điều 2.</span> ${content.article2}</div>
             <div class="indent"><span class="bold">Điều 3.</span> ${content.article3}</div>
          </div>

          <!-- Footer Table for Layout -->
           <table class="layout-grid" style="margin-top: 20px;">
            <tr>
              <td class="layout-cell" style="text-align: left; width: 45%; padding-left: 10px; font-size: 10pt;">
                 <div class="bold italic">Nơi nhận:</div>
                 <div class="italic" style="white-space: pre-line;">${content.recipients}</div>
              </td>
              <td class="layout-cell" style="text-align: center; width: 55%;">
                <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 50px;">${content.signerTitle}</div>
                <div class="uppercase bold">${content.signerName}</div>
              </td>
            </tr>
          </table>

          <br clear="all" style="page-break-before:always" />
          
          <div style="text-align: center; margin-bottom: 10px;">
            <div class="uppercase bold" style="font-size: 11pt;">DANH SÁCH HỌC VIÊN</div>
            <div class="bold" style="font-size: 10pt;">${formData.className}</div>
            <div style="font-size: 9pt;">(Kèm theo Quyết định số ${formData.number} ngày ${replaceMap['{{DATE}}']})</div>
          </div>

          <table class="data-table">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="width:50px;">STT</th>
                <th>Họ và tên</th>
                <th style="width:100px;">Ngày sinh</th>
                <th style="width:120px;">Số CCCD</th>
                <th>Quê quán</th>
                <th style="width:100px;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${studentRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Create Blob and Download
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QuyetDinh_${formData.number || 'Draft'}.doc`; // .doc extension for Word
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintStudentCards = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cardsHtml = tempStudents.map((s) => `
      <div class="card">
        <div class="card-header">
          <div class="school-name">TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I</div>
          <div class="center-name">TRUNG TÂM ĐÀO TẠO VÀ PHÁT TRIỂN NGUỒN LỰC</div>
        </div>
        <div class="card-body">
           <div class="photo-box">
             <img src="${s.photo || 'https://via.placeholder.com/100x120?text=Photo'}" alt="Photo" />
           </div>
           <div class="info-section">
             <div class="card-type">THẺ HỌC VIÊN</div>
             <div class="student-name">${s.fullName}</div>
             <div class="separator"></div>
             
             <div class="info-grid">
                <div class="info-row">
                     <span class="label">Ngày sinh:</span>
                     <span class="value">${formatDate(s.dob)}</span>
                </div>
                <div class="info-row">
                    <span class="label">Lớp:</span>
                    <span class="value class-name">${formData.trainingCourse || '...'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Mã HV:</span>
                    <span class="value">${s.studentCode || s.cardNumber || '...'}</span>
                </div>
             </div>
           </div>
        </div>
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <title>In Thẻ Học Viên</title>
          <style>
             body { font-family: 'Arial', sans-serif; padding: 0; background: #fff; margin: 0; }
             
             .card-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 15px; 
                padding: 15px;
                max-width: 210mm; 
             }
             
             .card { 
                width: 340px; 
                height: 220px; 
                border: 1px solid #ccc; 
                border-radius: 12px;
                overflow: hidden;
                background: white;
                box-sizing: border-box;
                position: relative; 
                page-break-inside: avoid;
                margin: 0 auto;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
             }
             
             .card-header { 
                background-color: #15469e; 
                color: white; 
                text-align: center; 
                padding: 5px 4px;
                height: 40px;
                display: flex;
                flex-direction: column;
                justify-content: center;
             }
             
             .school-name { font-size: 9pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
             .center-name { font-size: 7.5pt; font-weight: normal; text-transform: uppercase; }
             
             .card-body { padding: 17px 12px 10px 12px; display: flex; gap: 12px; height: calc(100% - 40px); align-items: flex-start; }
             
             .photo-box { 
                width: 90px; 
                height: 110px; 
                border: 1px solid #e0e0e0; 
                background: #f8f9fa;
                flex-shrink: 0;
                margin-top: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
             }
             .photo-box img { width: 100%; height: 100%; object-fit: cover; }
             
             .info-section { flex: 1; display: flex; flex-direction: column; }
             
             .card-type { 
                color: #d32f2f; 
                font-weight: bold; 
                font-size: 13pt; 
                text-transform: uppercase; 
                margin-bottom: 2px;
             }
             
             .student-name { 
                color: #15469e; 
                font-weight: bold; 
                font-size: 12pt; 
                text-transform: uppercase; 
                line-height: 1.2;
                margin-bottom: 5px;
             }
             
             .separator { height: 1px; background-color: #a0c4ff; width: 100%; margin-bottom: 8px; }
             
             .info-grid { display: flex; flex-direction: column; gap: 4px; }
             
             .info-row { display: flex; font-size: 9pt; line-height: 1.3; }
             .label { color: #666; width: 65px; flex-shrink: 0; font-weight: normal; }
             .value { color: #000; font-weight: bold; flex: 1; }
             .class-name { 
                 display: -webkit-box;
                 -webkit-line-clamp: 3;
                 -webkit-box-orient: vertical;
                 overflow: hidden;
                 font-size: 9pt;
             }

             @media print {
               @page { size: A4 portrait; margin: 1cm; }
               body { margin: 0; -webkit-print-color-adjust: exact; }
               .card { border: 1px solid #ccc; box-shadow: none; break-inside: avoid; }
               .card-header { -webkit-print-color-adjust: exact; background-color: #15469e !important; color: white !important; }
               .student-name { color: #15469e !important; }
               .card-type { color: #d32f2f !important; }
             }
          </style>
        </head>
        <body>
          <div class="card-grid">
            ${cardsHtml}
          </div>
          <script>
             window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // In DS Bàn giao trực tiếp (RECOGNITION mode) - sort alpha, loại dòng trống
  const handlePrintHandover = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }

    // Loại bỏ dòng trống (không có tên), sắp xếp theo Tên (vần alpha tiếng Việt)
    const validStudents = tempStudents.filter(s => s.fullName && s.fullName.trim() !== '');
    const sortedStudents = [...validStudents].sort((a, b) => {
      const getParts = (name: string) => {
        const parts = (name || '').trim().split(/\s+/);
        const first = parts.length > 1 ? (parts.pop() || '') : (parts[0] || '');
        const last = parts.join(' ');
        return { first: first.toLowerCase(), last: last.toLowerCase() };
      };
      const nameA = getParts(a.fullName);
      const nameB = getParts(b.fullName);
      return (
        nameA.first.localeCompare(nameB.first, 'vi', { sensitivity: 'base' }) ||
        nameA.last.localeCompare(nameB.last, 'vi', { sensitivity: 'base' })
      );
    });

    const dateNow = new Date();
    const dateStr = `Ngày ${dateNow.getDate().toString().padStart(2, '0')} tháng ${(dateNow.getMonth() + 1).toString().padStart(2, '0')} năm ${dateNow.getFullYear()}`;

    let rows = '';
    sortedStudents.forEach((s, i) => {
      rows += `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="left uppercase bold">${s.fullName || ''}</td>
          <td class="center">${s.dob ? formatDate(s.dob) : ''}</td>
          <td class="center">${s.hometown || ''}</td>
          <td class="center"></td>
          <td class="center"></td>
        </tr>`;
    });

    const html = `<html>
      <head>
        <title>Danh Sách Bàn Giao Giấy Chứng Nhận</title>
        <style>
          @media print { @page { size: A4 landscape; margin: 15mm; } body { margin:0; } }
          body { font-family: 'Times New Roman', serif; background: #fff; }
          .title { text-align:center; font-size:15pt; font-weight:bold; margin:8px 0 4px; }
          .subtitle { text-align:center; font-size:13pt; font-weight:bold; margin-bottom:12px; }
          .header-table { width:100%; border-collapse:collapse; border:none; margin-bottom:8px; }
          .header-table td { border:none; padding:0; vertical-align:top; font-size:13pt; line-height:1.4; }
          table.data { width:100%; border-collapse:collapse; margin-top:8px; }
          table.data th, table.data td { border:1px solid #000; padding:6px 4px; font-size:11pt; height:34px; }
          table.data th { font-weight:bold; text-align:center; background:#fff; }
          .center { text-align:center; }
          .left { text-align:left; padding-left:10px !important; }
          .bold { font-weight:bold; }
          .uppercase { text-transform: uppercase; }
          .footer { width:100%; border-collapse:collapse; border:none; margin-top:24px; }
          .footer td { border:none; font-size:13pt; padding:4px; vertical-align: top; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width:40%">
              <div>TRƯỜNG CAO ĐẲNG HÀNG HẢI &amp; ĐT1</div>
              <div style="font-weight:bold">TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</div>
            </td>
            <td style="width:60%; text-align:center">
              <div style="font-weight:bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div style="font-weight:bold">Độc lập - Tự do - Hạnh phúc</div>
            </td>
          </tr>
        </table>
        <div class="title">DANH SÁCH BÀN GIAO GIẤY CHỨNG NHẬN</div>
        <div class="subtitle">LỚP: ${(formData.className || '').toUpperCase()} ${formData.trainingCourse ? '– KHÓA ' + formData.trainingCourse : ''}</div>
        <table class="data">
          <thead>
            <tr>
              <th style="width:45px">STT</th>
              <th style="width:200px">HỌ VÀ TÊN</th>
              <th style="width:100px">NGÀY SINH</th>
              <th style="width:140px">NƠI SINH</th>
              <th style="width:250px">KÝ VÀ GHI RÕ HỌ VÀ TÊN</th>
              <th style="width:100px">GHI CHÚ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <table class="footer">
          <tr>
            <td style="width:40%; text-align:center; font-weight:bold; padding-top: 10px;">BÊN NHẬN</td>
            <td style="width:60%; text-align:center; font-weight:bold;">
              <div style="font-style:italic; font-weight:normal; margin-bottom: 5px;">Hải Phòng, ${dateStr}</div>
              TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC
            </td>
          </tr>
        </table>
        <script>window.onload = function() { setTimeout(function(){ window.print(); }, 400); };<\/script>
      </body>
    </html>`;


    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách học viên');

      const exportSortedStudents = [...tempStudents].filter(s => s.fullName && s.fullName.trim() !== '').sort((a, b) => {
        const getParts = (name: string) => {
          const parts = (name || '').trim().split(/\s+/);
          const first = parts.length > 1 ? (parts.pop() || '') : (parts[0] || '');
          const last = parts.join(' ');
          return { first: first.toLowerCase(), last: last.toLowerCase() };
        };
        const nameA = getParts(a.fullName);
        const nameB = getParts(b.fullName);
        return (
          nameA.first.localeCompare(nameB.first, 'vi', { sensitivity: 'base' }) ||
          nameA.last.localeCompare(nameB.last, 'vi', { sensitivity: 'base' })
        );
      });

      if (viewType === 'RECOGNITION') {
        worksheet.mergeCells('A1:C1');
        worksheet.getCell('A1').value = 'TRƯỜNG CAO ĐẲNG';
        worksheet.getCell('A1').font = { name: 'Times New Roman', size: 11 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('D1:F1');
        worksheet.getCell('D1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT\nNAM';
        worksheet.getCell('D1').font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell('D1').alignment = { horizontal: 'center', wrapText: true };

        worksheet.mergeCells('A2:C2');
        worksheet.getCell('A2').value = 'HÀNG HẢI VÀ ĐƯỜNG THỦY I';
        worksheet.getCell('A2').font = { name: 'Times New Roman', size: 11 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('D2:F2');
        worksheet.getCell('D2').value = 'Độc lập – Tự do – Hạnh phúc';
        worksheet.getCell('D2').font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell('D2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:C3');
        worksheet.getCell('A3').value = 'TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
        worksheet.getCell('A3').font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.getRow(5).height = 20;
        worksheet.mergeCells('A5:F5');
        worksheet.getCell('A5').value = 'DANH SÁCH BÀN GIAO GIẤY CHỨNG NHẬN';
        worksheet.getCell('A5').font = { name: 'Times New Roman', size: 14, bold: true };
        worksheet.getCell('A5').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A6:F6');
        const className = formData.className || '';
        const course = formData.trainingCourse || '';
        worksheet.getCell('A6').value = `LỚP: ${className.toUpperCase()} ${course ? `– KHÓA: ${course.toUpperCase()}` : ''}`.trim();
        worksheet.getCell('A6').font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell('A6').alignment = { horizontal: 'center' };

        worksheet.getRow(8).height = 30;
        worksheet.columns = [
          { key: 'stt', width: 5 },
          { key: 'hoten', width: 25 },
          { key: 'ngaysinh', width: 12 },
          { key: 'noisinh', width: 15 },
          { key: 'kynhan', width: 30 },
          { key: 'ghichu', width: 10 },
        ];

        const headerRow = worksheet.getRow(8);
        headerRow.getCell(1).value = 'STT';
        headerRow.getCell(2).value = 'HỌ VÀ TÊN';
        headerRow.getCell(3).value = 'NGÀY\nSINH';
        headerRow.getCell(4).value = 'NƠI SINH';
        headerRow.getCell(5).value = 'KÝ VÀ GHI RÕ HỌ VÀ TÊN';
        headerRow.getCell(6).value = 'GHI CHÚ';

        headerRow.eachCell((cell, colNum) => {
           if (colNum <= 6) {
              cell.font = { name: 'Times New Roman', size: 11, bold: true };
              cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
              cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
           }
        });

        let currentRow = 9;
        for (let i = 0; i < exportSortedStudents.length; i++) {
          const s = exportSortedStudents[i];
          
          const row = worksheet.getRow(currentRow);
          row.height = 18;
          row.getCell(1).value = i + 1;
          row.getCell(2).value = s.fullName;
          row.getCell(3).value = formatDate(s.dob);
          row.getCell(4).value = s.hometown || s.pob || '';
          row.getCell(5).value = ''; 
          row.getCell(6).value = s.notes || '';

          for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11 };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            if (c === 1 || c >= 3) {
               cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
               cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            }
          }
          currentRow++;
        }

        // Add 3 empty rows
        for (let i = 0; i < 3; i++) {
          const row = worksheet.getRow(currentRow);
          row.height = 18;
          row.getCell(1).value = exportSortedStudents.length + i + 1;
          for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11 };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          currentRow++;
        }

        // Footer signature row
        currentRow++;
        worksheet.getCell(currentRow, 1).value = 'BÊN NHẬN';
        worksheet.getCell(currentRow, 1).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };

        worksheet.mergeCells(currentRow, 3, currentRow, 6);
        worksheet.getCell(currentRow, 3).value = 'TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
        worksheet.getCell(currentRow, 3).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 3).alignment = { horizontal: 'center' };


      } else {
        // OPENING Mode Logic
        worksheet.mergeCells('A1:B1');
        worksheet.getCell('A1').value = {
          richText: [
            { font: { size: 11, name: 'Times New Roman' }, text: 'TRƯỜNG CAO ĐẲNG\n' },
            { font: { size: 11, name: 'Times New Roman' }, text: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I\n' },
            { font: { bold: true, size: 11, name: 'Times New Roman' }, text: 'TT ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC' }
          ]
        };
        worksheet.getCell('A1').alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };
        worksheet.getRow(1).height = 45;

        worksheet.mergeCells('D1:F1');
        worksheet.getCell('D1').value = {
          richText: [
            { font: { bold: true, size: 11, name: 'Times New Roman' }, text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n' },
            { font: { bold: true, size: 11, name: 'Times New Roman' }, text: 'Độc lập – Tự do – Hạnh phúc' }
          ]
        };
        worksheet.getCell('D1').alignment = { horizontal: 'center', wrapText: true, vertical: 'top' };

        worksheet.mergeCells('A3:F3');
        worksheet.getCell('A3').value = `DANH SÁCH HỌC LỚP ${formData.className || '...'}`.toUpperCase();
        worksheet.getCell('A3').font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A4:F4');
        worksheet.getCell('A4').value = `KHOÁ ${formData.trainingCourse || '...'}`.toUpperCase();
        worksheet.getCell('A4').font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell('A4').alignment = { horizontal: 'center' };

        worksheet.getRow(5).height = 20;

        worksheet.columns = [
          { key: 'stt', width: 5 },
          { key: 'ho', width: 16 },
          { key: 'ten', width: 9 },
          { key: 'ngaysinh', width: 14 },
          { key: 'noisinh', width: 15 },
          { key: 'ghichu', width: 12 },
        ];

        const headerRow = worksheet.getRow(5);
        headerRow.getCell(1).value = 'STT';
        worksheet.mergeCells('B5:C5');
        headerRow.getCell(2).value = 'HỌ VÀ TÊN';
        headerRow.getCell(4).value = 'NGÀY SINH';
        headerRow.getCell(5).value = 'NƠI SINH';
        headerRow.getCell(6).value = 'GHI CHÚ';

        headerRow.eachCell((cell, colNum) => {
           if (colNum <= 6) {
              cell.font = { name: 'Times New Roman', size: 11, bold: true };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
           }
        });

        // HỌ VÀ TÊN merged header requires explicit borders to look solid
        worksheet.getCell('B5').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        worksheet.getCell('C5').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        let currentRow = 6;
        for (let i = 0; i < exportSortedStudents.length; i++) {
          const s = exportSortedStudents[i];
          const parts = s.fullName.trim().split(' ');
          const ten = parts.pop() || '';
          const ho = parts.join(' ');
          
          const row = worksheet.getRow(currentRow);
          row.height = 18;
          row.getCell(1).value = i + 1;
          row.getCell(2).value = ho;
          row.getCell(3).value = ten;
          row.getCell(4).value = formatDate(s.dob);
          row.getCell(5).value = s.hometown || s.pob || '';
          row.getCell(6).value = s.notes || '';

          for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11 };
            
            if (c === 2) {
               cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
               cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'} };
            } else if (c === 3) {
               cell.alignment = { horizontal: 'left', vertical: 'middle' };
               cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            } else {
               cell.alignment = { horizontal: 'center', vertical: 'middle' };
               cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            }
          }
          currentRow++;
        }

        currentRow++;
        worksheet.mergeCells(currentRow, 4, currentRow, 6);
        const dateObj = new Date(formData.signedDate || new Date());
        worksheet.getCell(currentRow, 4).value = `Ngày ${dateObj.getDate().toString().padStart(2, '0')} tháng ${(dateObj.getMonth() + 1).toString().padStart(2, '0')} năm ${dateObj.getFullYear()}`;
        worksheet.getCell(currentRow, 4).font = { name: 'Times New Roman', size: 11, italic: false };
        worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center' };

        currentRow++;
        worksheet.mergeCells(currentRow, 4, currentRow, 6);
        worksheet.getCell(currentRow, 4).value = 'TRUNG TÂM ĐÀO TẠO PHÁT TRIỂN NGUỒN LỰC';
        worksheet.getCell(currentRow, 4).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center' };

        currentRow += 5;
        worksheet.mergeCells(currentRow, 4, currentRow, 6);
        worksheet.getCell(currentRow, 4).value = 'Nguyễn Tất Quyền';
        worksheet.getCell(currentRow, 4).font = { name: 'Times New Roman', size: 11, bold: true };
        worksheet.getCell(currentRow, 4).alignment = { horizontal: 'center' };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DanhSachHocVien_${formData.number ? formData.number.replace(/\//g, '_') : 'Export'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error('Export failed:', e);
      alert('Có lỗi khi xuất Excel. Vui lòng thử lại. Chi tiết lỗi xem console.');
    }
  };

  const handleExportTuitionExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bảng kê Học phí', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      // Headers
      worksheet.mergeCells('A1:C1');
      worksheet.getCell('A1').value = 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM';
      worksheet.getCell('A1').font = { name: 'Times New Roman', size: 11 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:C2');
      worksheet.getCell('A2').value = 'TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I';
      worksheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('D1:G1');
      worksheet.getCell('D1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      worksheet.getCell('D1').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('D1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('D2:G2');
      worksheet.getCell('D2').value = 'Độc lập - Tự do - Hạnh phúc';
      worksheet.getCell('D2').font = { name: 'Times New Roman', size: 11, bold: true };
      worksheet.getCell('D2').alignment = { horizontal: 'center' };

      // Title
      worksheet.mergeCells('A4:G4');
      const classNameUpper = (formData.className || '..................').toUpperCase();
      worksheet.getCell('A4').value = `BẢNG KÊ NỘP KINH PHÍ ĐÀO TẠO\nLỚP: ${classNameUpper} - KHOÁ: ${formData.trainingCourse || '..................'}`;
      worksheet.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
      worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      worksheet.getRow(4).height = 45;

      // Columns Config
      worksheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'ho_ten', width: 28 },
        { key: 'so_tien', width: 14 },
        { key: 'dia_chi', width: 30 },
        { key: 'cccd', width: 18 },
        { key: 'ky_ten', width: 18 },
        { key: 'ghi_chu', width: 15 },
      ];

      // Table Header Row
      const headerRow = worksheet.getRow(5);
      headerRow.height = 30;
      headerRow.values = ['STT', 'Họ và tên', 'Số tiền', 'Địa chỉ', 'Số CCCD', 'Ký (ghi rõ họ tên)', 'Ghi chú'];
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 12, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Data Rows
      const sortedStudents = [...tempStudents].filter(s => s.fullName && s.fullName.trim() !== '').sort((a, b) => {
        const getParts = (name: string) => {
          const parts = (name || '').trim().split(/\s+/);
          const first = parts.length > 1 ? (parts.pop() || '') : (parts[0] || '');
          const last = parts.join(' ');
          return { first: first.toLowerCase(), last: last.toLowerCase() };
        };
        const nameA = getParts(a.fullName);
        const nameB = getParts(b.fullName);
        return (
          nameA.first.localeCompare(nameB.first, 'vi', { sensitivity: 'base' }) ||
          nameA.last.localeCompare(nameB.last, 'vi', { sensitivity: 'base' })
        );
      });

      let currentRow = 6;
      for (let i = 0; i < sortedStudents.length; i++) {
        const s = sortedStudents[i];
        const row = worksheet.getRow(currentRow);
        row.height = 25;
        row.getCell(1).value = i + 1;
        row.getCell(2).value = s.fullName;
        row.getCell(3).value = ''; // Số tiền để trống
        row.getCell(4).value = s.address || '';
        row.getCell(5).value = s.cardNumber || '';
        row.getCell(6).value = ''; // Ký tên để trống
        row.getCell(7).value = (s as any).notes || ''; // Ghi chú

        for (let col = 1; col <= 7; col++) {
          const cell = row.getCell(col);
          cell.font = { name: 'Times New Roman', size: 12 };
          cell.alignment = { vertical: 'middle' };
          
          if (col === 1 || col === 3 || col === 5) {
             cell.alignment.horizontal = 'center';
          } else if (col === 2) {
             cell.alignment.horizontal = 'left';
             cell.alignment.indent = 1;
          } else {
             cell.alignment.horizontal = 'left';
          }
          
          cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
          };
        }
        currentRow++;
      }

      // Footer - Tổng cộng
      const summaryRow = worksheet.getRow(currentRow);
      summaryRow.height = 25;
      summaryRow.getCell(1).value = 'Tổng cộng';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      summaryRow.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true };
      summaryRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      summaryRow.getCell(3).value = '0';
      summaryRow.getCell(3).font = { name: 'Times New Roman', size: 12, bold: true };
      summaryRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

      for (let col = 1; col <= 7; col++) {
        if (col === 2) continue; // merged cell handle
        const cell = summaryRow.getCell(col);
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      }

      // Số tiền bằng chữ
      currentRow += 1;
      const textSumRow = worksheet.getRow(currentRow);
      textSumRow.height = 25;
      textSumRow.getCell(1).value = 'Số tiền bằng chữ:';
      textSumRow.getCell(1).font = { name: 'Times New Roman', size: 12, italic: true, bold: true };
      textSumRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);

      // Ngay thang
      currentRow += 1;
      const dateRow = worksheet.getRow(currentRow);
      dateRow.height = 20;
      worksheet.mergeCells(`D${currentRow}:G${currentRow}`);
      
      let docDateStr = formData.signedDate ? formData.signedDate : new Date().toISOString();
      const dt = new Date(docDateStr);
      let day = String(dt.getDate()).padStart(2, '0');
      let month = String(dt.getMonth() + 1).padStart(2, '0');
      let year = dt.getFullYear();

      dateRow.getCell(4).value = `Hải Phòng, ngày ${day} tháng ${month} năm ${year}`;
      dateRow.getCell(4).font = { name: 'Times New Roman', size: 12, italic: true };
      dateRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      // Chữ ký Headers
      currentRow += 1;
      const signRoleRow = worksheet.getRow(currentRow);
      signRoleRow.height = 20;
      signRoleRow.getCell(1).value = 'NGƯỜI LẬP';
      signRoleRow.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true };
      signRoleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);

      signRoleRow.getCell(3).value = 'TT. PHÁT TRIỂN NGUỒN LỰC';
      signRoleRow.getCell(3).font = { name: 'Times New Roman', size: 12, bold: true };
      signRoleRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

      signRoleRow.getCell(4).value = 'PHỤ TRÁCH KẾ TOÁN';
      signRoleRow.getCell(4).font = { name: 'Times New Roman', size: 12, bold: true };
      signRoleRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`D${currentRow}:G${currentRow}`);

      // Ký tên cụ thể (sau khoảng trống)
      currentRow += 5;
      const signNameRow = worksheet.getRow(currentRow);
      signNameRow.height = 20;
      signNameRow.getCell(3).value = 'Nguyễn Tất Quyền';
      signNameRow.getCell(3).font = { name: 'Times New Roman', size: 12, bold: true };
      signNameRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

      signNameRow.getCell(4).value = 'Nguyễn Thanh Huyền';
      signNameRow.getCell(4).font = { name: 'Times New Roman', size: 12, bold: true };
      signNameRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`D${currentRow}:G${currentRow}`);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BangKeHocPhi_${formData.className ? formData.className.replace(/[/\\?%*:|"<>]/g, '_') : 'Lop'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error('Export failed:', e);
      alert('Có lỗi khi xuất Excel. Vui lòng thử lại. Chi tiết lỗi xem console.');
    }
  };

  const handleExportDocHandover = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }

    const classData = availableClasses.find(c => String(c.id) === String(formData.classId) || String(c.documentId) === String(formData.classId));
    const classNotes = classData?.notes || classData?.attributes?.notes || '';

    // Sắp xếp học viên theo Tên (vần alpha), cùng tên thì theo Họ Đệm
    const sortedStudents = [...tempStudents].sort((a, b) => {
      const getParts = (name) => {
        const parts = (name || '').trim().split(/\s+/);
        if (parts.length === 1) return { first: parts[0]?.toLowerCase() || '', lastObj: '' };
        const first = parts.pop() || '';
        const lastObj = parts.join(' ');
        return { first: first.toLowerCase(), lastObj: lastObj.toLowerCase() };
      };
      
      const nameA = getParts(a.fullName);
      const nameB = getParts(b.fullName);
      
      return nameA.first.localeCompare(nameB.first, 'vi', { sensitivity: 'base' }) || 
             nameA.lastObj.localeCompare(nameB.lastObj, 'vi', { sensitivity: 'base' });
    });


    // Tạo các dòng dữ liệu 
    let studentRows = '<tbody>';
    sortedStudents.forEach((s, i) => {
      let first = '', last = '';
      if (s.fullName) {
        const parts = s.fullName.trim().split(/\s+/);
        if (parts.length === 1) {
          last = parts[0];
        } else {
          last = parts.pop() || '';
          first = parts.join(' ');
        }
      }

      studentRows += `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="left no-border-right w-first-name">${first}</td>
          <td class="center no-border-left w-last-name">${last}</td>
          <td class="center"></td>
          <td class="center"></td>
          <td class="left">${s.address || s.hometown || ''}</td>
        </tr>
      `;

      // Nếu là học viên cuối cùng, in ra dòng Tổng cộng
      if (i === sortedStudents.length - 1) {
        studentRows += `
          <tr>
            <td colspan="3" class="bold center" style="border-right: 1px solid #000 !important;">Tổng cộng:</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      }
    });
    studentRows += '</tbody>';

    const html = `
      <html>
        <head>
          <title>Biên Bản Bàn Giao Tài Liệu</title>
          <style>
            @media print {
              @page { size: A4 landscape; margin: 15mm; }
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              .page-break { page-break-before: always; break-before: page; }
            }
            body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; background: #fff; }
            .container { 
               width: 100%; 
               box-sizing: border-box; 
            }
            .header-table { width: 100%; text-align: center; margin-bottom: 10px; border-collapse: collapse; border: none; }
            .header-table td { border: none; padding: 0; vertical-align: top; line-height: 1.3; }
            .bold { font-weight: bold; }
            .italic { font-style: italic; }
            .uppercase { text-transform: uppercase; }
            .title { text-align: center; font-size: 15pt; font-weight: bold; margin-bottom: 5px; line-height: 1.2; }
            
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .data-table th, .data-table td { border: 1px solid #000; padding: 6px 4px; font-size: 13pt; line-height: 1.2; height: 35px; }
            .data-table th { font-weight: bold; text-align: center; vertical-align: middle; padding: 8px 4px; background: #fff; }
            
            .center { text-align: center; }
            .left { text-align: left; padding-left: 10px !important; }
            .right { text-align: right; }
            
            .no-border-right { border-right: none !important; }
            .no-border-left { border-left: none !important; }
            
            .w-stt { width: 45px; }
            .w-first-name { width: 180px; }
            .w-last-name { width: 90px; }
            .w-sl { width: 110px; }
            .w-ky { width: 240px; }
            
            .footer-table { width: 100%; text-align: center; margin-top: 15px; border-collapse: collapse; border: none; page-break-inside: avoid; }
            .footer-table td { border: none; padding: 5px; vertical-align: top; }
          </style>
        </head>
        <body>
          <div class="container">
            <table class="header-table">
              <tr>
                <td style="width: 40%; font-size: 13pt;">
                  <div>TRƯỜNG CAO ĐẲNG HÀNG HẢI & ĐT1</div>
                  <div class="bold">TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</div>
                </td>
                <td style="width: 60%; font-size: 13pt;">
                  <div class="bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div class="bold">Độc lập - Tự do - Hạnh phúc</div>
                </td>
              </tr>
            </table>

            <div class="title" style="margin-top: 10px;">BIÊN BẢN BÀN GIAO TÀI LIỆU</div>
            <div class="title uppercase">LỚP ${formData.className || ''}</div>
            <div class="title uppercase" style="margin-bottom: 20px;">KHÓA : ${formData.trainingCourse || ''}</div>

            <div style="font-size: 13pt; margin-bottom: 2px; line-height: 1.4;">
                 <span class="bold">1- Tài liệu </span>
                 <span>${classNotes}</span>
            </div>
            <div class="italic" style="text-align: right; font-size: 13pt; margin-bottom: 2px; white-space: nowrap;">
                 ĐVT: Quyển
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th rowspan="1" class="w-stt">STT</th>
                  <th colspan="2">HỌ VÀ TÊN</th>
                  <th class="w-sl">SỐ LƯỢNG</th>
                  <th class="w-ky">KÝ VÀ GHI HỌ VÀ TÊN</th>
                  <th>ĐỊA CHỈ LIÊN HỆ</th>
                </tr>
              </thead>
              ${studentRows}
            </table>
            
            <table class="footer-table">
              <tr>
                <td style="width: 50%;"></td>
                <td style="width: 50%;">
                  <div class="italic" style="font-size: 13pt; margin-bottom: 5px;">Hải Phòng, ngày ...... tháng ...... năm 20...</div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%;">
                  <div class="bold uppercase" style="font-size: 13pt;">TRUNG TÂM ĐÀO TẠO PT NGUỒN LỰC</div>
                </td>
                <td style="width: 50%;">
                  <div class="bold uppercase" style="font-size: 13pt;">GIÁO VIÊN QUẢN LÝ LỚP</div>
                </td>
              </tr>
            </table>
          </div>
          
          <script>
            window.onload = function() {
               setTimeout(function() { window.print(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintRegistrationForms = () => {
    if (tempStudents.length === 0) {
      alert("Không có học viên nào để in phiếu!");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Vui lòng cho phép Pop-ups trên trình duyệt để in phiếu.");
      return;
    }

    const group = formData.trainingCourse || formData.className;
    const formsHtml = tempStudents.map(student => {
      let formattedDob = student.dob;
      if (student.dob && student.dob.includes('-')) {
        const parts = student.dob.split('-');
        if (parts.length === 3) formattedDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (student.dob && student.dob.includes(',')) {
        formattedDob = student.dob.replace(/,/g, '/');
      }

      return `
        <div class="page-break">
          <div class="header-right">
            ${student.photo ? '<img src="' + student.photo + '" alt="Ảnh 3x4" />' : 'Ảnh 3x4'}
          </div>
          
          <div class="header-left">
            <div class="agency">CỤC HÀNG HẢI VÀ ĐƯỜNG THUỶ VIỆT NAM</div>
            <div class="school">TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THUỶ I</div>
          </div>

          <div class="title">PHIẾU ĐĂNG KÝ HỌC</div>

          <div class="content">
            <div class="info-row">
              <span class="label">Họ và tên:</span>
              <span class="value"><b>${(student.fullName || '').toUpperCase()}</b></span>
            </div>
            <div class="info-row" style="margin-bottom: -8px;">
              <span class="label">Ngày, tháng, năm sinh:</span>
              <span class="value">${formattedDob || ''}</span>
            </div>

            <div style="line-height: 1.1; margin-top: 0px;">
              <div class="row-group-flex" style="margin-bottom: 0px;">
                <span class="label">Nơi sinh:</span>
                <span class="value" style="flex: 1.5">${student.hometown || ''}</span>
                <span class="label" style="margin-left: 10px;">Số CCCD:</span>
                <span class="value" style="flex: 1.5">${student.cardNumber || student.studentCode || ''}</span>
              </div>
              <div class="row-group-flex" style="margin-bottom: 0px;">
                <span class="label">Dân tộc:</span>
                <span class="value" style="flex: 1.5"></span>
                <span class="label" style="margin-left: 10px;">Quốc tịch:</span>
                <span class="value" style="flex: 1.5">Việt Nam</span>
              </div>
              <div class="info-row" style="margin-bottom: 0px;">
                <span class="label">Số điện thoại liên lạc:</span>
                <span class="value">${student.phone || ''}</span>
              </div>
              <div class="info-row" style="margin-bottom: 0px;">
                <span class="label">Đơn vị công tác:</span>
                <span class="value"></span>
              </div>
              <div class="info-row" style="margin-bottom: 0px;">
                <span class="label">Địa chỉ thường trú:</span>
                <span class="value">${student.address || ''}</span>
              </div>
              <div class="info-row" style="margin-bottom: 0px;">
                <span class="label">Đăng ký học:</span>
                <span class="value">${group || ''}</span>
              </div>
            </div>
          </div>

          <div class="signature-section" style="margin-right: 15mm; margin-top: 10px;">
            <div class="signature-box">
              <div class="role">Học viên (ký và ghi rõ họ tên)</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>In Phiếu Đăng Ký Học - Khóa ${formData.trainingCourse}</title>
      <style>
        @page {
            size: A5 landscape;
            margin: 0;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.25;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          background-color: #fff;
          color: #000;
        }
        .page-break {
          page-break-after: always;
          padding: 1.5cm 1.5cm 1.5cm 2cm;
          box-sizing: border-box;
          height: 100vh;
          position: relative;
        }
        .page-break:last-child {
          page-break-after: auto;
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
                padding: 0;
            }
            .page-break {
                padding-top: 1.5cm;
                padding-left: 2cm;
                padding-right: 1.5cm;
                height: 148mm; /* A5 landscape height */
                width: 210mm;  /* A5 landscape width */
            }
        }
      </style>
    </head>
    <body onload="setTimeout(() => window.print(), 500)">
      ${formsHtml}
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderDecisionForm = () => (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-7xl rounded-xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col h-[92vh]">
        {/* Header - slate-800 giống Duyệt thi */}
        <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-700 rounded-md">
              <FileText size={16} className={viewType === 'OPENING' ? 'text-blue-400' : 'text-emerald-400'} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">
                {viewType === 'OPENING' ? 'Lập Quyết định Mở lớp' : 'Lập Quyết định Công nhận'}
              </h2>
              {editingId && (
                <p className="text-[11px] text-slate-400 mt-0.5">Chỉnh sửa • {formData.number || '---'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {viewType === 'OPENING' && (
              <>
                <button onClick={handleExportTuitionExcel} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                  <FileSpreadsheet size={13} /> Bảng kê
                </button>
                <button onClick={handleExportDocHandover} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                  <FileText size={13} /> BG Tài Liệu
                </button>
              </>
            )}
            {viewType === 'RECOGNITION' ? (
              <button onClick={handlePrintHandover} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                <Printer size={13} /> DS Bàn giao
              </button>
            ) : (
              <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                <FileSpreadsheet size={13} /> Xuất Excel
              </button>
            )}
            <button onClick={handlePrintDecision} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-[12px] font-semibold transition-colors">
              <Printer size={13} /> Xuất QĐ
            </button>
            {viewType === 'RECOGNITION' ? (
              <button onClick={handlePrintRequestList} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                <ScrollText size={13} /> DS Đề nghị
              </button>
            ) : (
              <>
                <button onClick={handlePrintRegistrationForms} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                  <Printer size={13} /> In Phiếu ĐK
                </button>
                <button onClick={handlePrintStudentCards} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-md text-[12px] font-semibold transition-colors">
                  <IdCard size={13} /> In thẻ
                </button>
              </>
            )}
            {viewType === 'RECOGNITION' && (
              <button
                onClick={handleDownloadStudentPhotos}
                disabled={isDownloadingPhotos}
                title="Tải ảnh 3x4 của tất cả học viên về dưới dạng file ZIP"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-md text-[12px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloadingPhotos ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Tải ảnh 3x4
              </button>
            )}
            <div className="w-px h-5 bg-slate-600 mx-0.5"></div>
            <button onClick={handleSaveDecision} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md text-[12px] font-semibold shadow-sm shadow-green-900/50 transition-colors">
              <Save size={13} /> Lưu
            </button>
            <button onClick={() => setIsFormOpen(false)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-white space-y-4">
          <div className="border border-slate-200 rounded p-4 relative pt-6 bg-slate-50/50 mt-2">
            <span className="absolute -top-3 left-4 bg-white px-2 text-[12px] font-bold text-blue-600 border border-blue-100 rounded shadow-sm">
              1. Thông tin chung
            </span>
            <div className="grid grid-cols-4 gap-x-6 gap-y-3">
              <div className="flex items-center gap-2 col-span-2">
                <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap uppercase">Số Quyết Định<span className="text-red-500">*</span>:</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={e => setFormData({ ...formData, number: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Nhập số QĐ"
                />
              </div>

              <div className="flex items-center gap-2 col-span-2">
                <label className="w-40 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap uppercase">Người Ký:</label>
                <input
                  type="text"
                  value={formData.signer}
                  onChange={e => setFormData({ ...formData, signer: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Họ tên người ký"
                />
              </div>

              <div className="flex items-center gap-2 col-span-2">
                <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap uppercase">Đợt/Khóa:</label>
                <input
                  type="text"
                  value={formData.trainingCourse}
                  onChange={e => setFormData({ ...formData, trainingCourse: e.target.value })}
                  onBlur={async (e) => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    
                    const duplicateCheck = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[type][$eq]=${viewType}&filters[training_course][$eq]=${encodeURIComponent(val)}`);
                    const isDuplicate = duplicateCheck && duplicateCheck.some((d: any) => String(d.documentId || d.id) !== String(editingId));
                    
                    if (isDuplicate) {
                      alert(`CẢNH BÁO: Đợt/Khóa "${val}" đã tồn tại trong hệ thống. Vui lòng kiểm tra lại để tránh trùng lặp.`);
                    }
                  }}
                  className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Đợt/Khóa"
                />
              </div>

              <div className="flex items-center gap-2 col-span-2">
                <label className="w-40 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap uppercase">Ngày Ký:</label>
                <input
                  type="date"
                  value={formData.signedDate}
                  onChange={e => setFormData({ ...formData, signedDate: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex items-center gap-2 col-span-4">
                <label className="w-32 flex-shrink-0 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap uppercase">
                  {viewType === 'OPENING' ? 'Lớp Đào Tạo' : 'Theo QĐ Mở lớp'}<span className="text-red-500">*</span>:
                </label>
                {viewType === 'OPENING' ? (
                  <div className="flex-1">
                    <SearchableSelect
                      value={formData.classId || ''}
                      onChange={(val, opt) => handleTypeLinkSelect(val, opt?.data)}
                      fetchOptions={fetchClassesForDropdown}
                      placeholder="-- Chọn --"
                      defaultLabel={formData.className || ''}
                    />
                  </div>
                ) : (
                  <select
                    value={formData.relatedOpeningId || ''}
                    onChange={e => handleTypeLinkSelect(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] bg-white font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn --</option>
                    {availableOpeningDecisions.map(d => <option key={d.id} value={d.id}>{d.className} ({d.number})</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded p-4 relative pt-10 bg-white min-h-[400px] flex flex-col">
            <span className="absolute -top-3 left-4 bg-white px-2 text-[12px] font-bold text-blue-600 border border-blue-100 rounded shadow-sm">
              2. Danh sách học viên ({tempStudents.length})
            </span>

            <div className="flex justify-between items-center mb-3">
              <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest pl-2">Danh sách chính thức</div>
              {currentUser?.role === UserRole.ADMIN && (
                <button
                  onClick={handleOpenAddStudentModal}
                  className="bg-slate-800 text-white px-4 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <Plus size={14} /> Thêm thủ công
                </button>
              )}
            </div>

            <div className="overflow-hidden border border-slate-100 rounded flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f8fafc] border-b text-slate-500 font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2 w-16 text-center">STT</th>
                    <th className="px-4 py-2 min-w-[150px]">Họ tên học viên</th>
                    <th className="px-4 py-2 text-center">Số CCCD/CMND</th>
                    <th className="px-4 py-2 text-center">Ngày sinh</th>
                    <th className="px-4 py-2">Nơi sinh</th>
                    <th className="px-4 py-2 text-center">Điểm thi</th>
                    <th className="px-4 py-2 text-center w-24">Hồ sơ</th>
                    <th className="px-4 py-2 w-20 text-center">Sửa</th>
                    <th className="px-4 py-2 w-20 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic font-medium">
                  {tempStudents.map((s, idx) => (
                    <tr key={s.id || `temp-${idx}`} className="hover:bg-blue-50/50 group transition-colors">
                      <td className="px-4 py-2.5 text-center text-slate-400 not-italic font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-700 uppercase leading-none hover:underline cursor-pointer not-italic text-[12px]"
                        onClick={() => setViewingGradeStudentId(s.id)}
                      >
                        {s.fullName}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500 font-mono not-italic">{s.cardNumber || '--'}</td>
                      <td className="px-4 py-2.5 text-center text-slate-500 font-mono not-italic">{formatDate(s.dob)}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-[11px] uppercase truncate max-w-[200px]">{s.hometown}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => setViewingGradeStudentId(s.id)}
                          className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <FileText size={10} /> XEM ĐIỂM
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex justify-center gap-1">
                          {s.documents && s.documents.length > 0 ? (
                            <button
                              onClick={() => setViewingDocsStudentId(s.id)}
                              className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-1.5 py-0.5 rounded text-[10px] font-black border border-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                            >
                              <Paperclip size={10} /> {s.documents.length} FILE
                            </button>
                          ) : (
                            <span className="text-slate-300">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditStudent(s, idx)}
                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                            title="Sửa thông tin cá nhân"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => removeStudentFromTemp(s.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {tempStudents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center text-slate-400 italic">Chưa có học viên nào trong danh sách.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditStudentModal = () => {
    if (!editingStudentData) return null;
    return (
      <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden border border-slate-300">
          <div className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center">
            <h3 className="text-[14px] font-bold uppercase tracking-tight">Sửa thông tin học viên trong QĐ</h3>
            <button onClick={() => { stopEditCamera(); setIsEditStudentModalOpen(false); }}><X size={18} /></button>
          </div>

          <div className="p-5 bg-slate-50 space-y-4">
            {/* ---- PHOTO SECTION ---- */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-3">Ảnh học viên (3×4)</label>
              <div className="flex items-start gap-4">
                {/* Preview / Camera */}
                <div className="relative shrink-0 w-[90px] h-[120px] rounded-lg border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                  {isEditCameraLive ? (
                    <video ref={editVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  ) : editingStudentData.photo ? (
                    <img src={editingStudentData.photo} alt="Ảnh học viên" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <ImageIcon size={28} />
                      <span className="text-[10px] text-center leading-tight">Chưa
có ảnh</span>
                    </div>
                  )}
                </div>

                {/* Canvas hidden – dùng để capture */}
                <canvas ref={editCanvasRef} className="hidden" />

                {/* Action buttons */}
                <div className="flex flex-col gap-2 flex-1">
                  {isEditCameraLive ? (
                    <>
                      <button
                        onClick={captureEditPhoto}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        <Camera size={14} /> Chụp ảnh
                      </button>
                      <button
                        onClick={stopEditCamera}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        <X size={14} /> Hủy camera
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Upload from file */}
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file && editingStudentData) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setEditingStudentData({ ...editingStudentData, photo: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}
                      />
                      <button
                        onClick={() => editFileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        <Upload size={14} /> Tải ảnh lên
                      </button>
                      <button
                        onClick={startEditCamera}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        <Camera size={14} /> Chụp qua Webcam
                      </button>
                      {editingStudentData.photo && (
                        <button
                          onClick={() => setEditingStudentData({ ...editingStudentData, photo: undefined })}
                          className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200 transition-all"
                        >
                          <Trash2 size={14} /> Xóa ảnh
                        </button>
                      )}
                    </>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Hỗ trợ JPG, PNG. Ảnh sẽ được tự động cắt theo tỉ lệ 3×4.</p>
                </div>
              </div>
            </div>

            {/* ---- TEXT FIELDS ---- */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Họ và Tên:</label>
              <input
                type="text"
                value={editingStudentData.fullName}
                onChange={e => setEditingStudentData({ ...editingStudentData, fullName: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Ngày sinh:</label>
                <input
                  type="date"
                  value={editingStudentData.dob}
                  onChange={e => setEditingStudentData({ ...editingStudentData, dob: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Số CCCD/CMND:</label>
                <input
                  type="text"
                  value={editingStudentData.cardNumber}
                  onChange={e => setEditingStudentData({ ...editingStudentData, cardNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Nơi sinh:</label>
              <input
                type="text"
                value={editingStudentData.hometown}
                onChange={e => setEditingStudentData({ ...editingStudentData, hometown: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Số điện thoại:</label>
                <input
                  type="tel"
                  value={editingStudentData.phone || ''}
                  onChange={e => setEditingStudentData({ ...editingStudentData, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0901..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Địa chỉ thường trú:</label>
                <input
                  type="text"
                  value={editingStudentData.address || ''}
                  onChange={e => setEditingStudentData({ ...editingStudentData, address: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Ghi chú:</label>
              <textarea
                rows={3}
                placeholder="Nhập ghi chú cho học viên (nếu có)..."
                value={editingStudentData.notes || ''}
                onChange={e => setEditingStudentData({ ...editingStudentData, notes: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="p-4 bg-white border-t flex justify-end gap-3">
            <button
              onClick={() => { stopEditCamera(); setIsEditStudentModalOpen(false); }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleUpdateStudentInfo}
              className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 shadow-md shadow-blue-100 flex items-center gap-2 tracking-wide uppercase"
            >
              <Save size={14} /> Cập nhật
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAddStudentModal = () => (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col max-h-[90vh]">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold">Chọn học viên thêm vào quyết định</h2>
          <button onClick={() => setIsAddStudentModalOpen(false)} className="hover:bg-slate-700 p-1 rounded-full"><X /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Tìm tên, mã học viên..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 border-b font-bold text-slate-600">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input type="checkbox" onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = allStudents.map(s => s.id);
                        setSelectedStudentsToAdd(new Set(allIds));
                      } else {
                        setSelectedStudentsToAdd(new Set());
                      }
                    }} />
                  </th>
                  <th className="p-3">Họ tên</th>
                  <th className="p-3">Mã HV</th>
                  <th className="p-3">Ngày sinh</th>
                  <th className="p-3">Lớp hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allStudents.filter(s => {
                  const isAlreadyAssigned = tempStudents.some(ts => String(ts.id) === String(s.id));
                  if (isAlreadyAssigned) return false;

                  const matchSearch = s.fullName.toLowerCase().includes(searchStudent.toLowerCase()) ||
                    s.studentCode.toLowerCase().includes(searchStudent.toLowerCase());
                    
                  const matchClass = viewType === 'OPENING'
                    ? (
                        (s as any).classId === formData.classId &&
                        (s as any).isApproved === true
                      )
                    : true;
                  return matchSearch && matchClass;
                }).map(s => (
                  <tr key={s.id} onClick={() => toggleStudentSelection(s.id)} className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedStudentsToAdd.has(s.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedStudentsToAdd.has(s.id)} onChange={() => toggleStudentSelection(s.id)} />
                    </td>
                    <td className="p-3 font-bold text-slate-700 uppercase">{s.fullName}</td>
                    <td className="p-3 font-mono text-blue-600 font-medium">{s.studentCode}</td>
                    <td className="p-3 text-slate-500">{s.dob || '--'}</td>
                    <td className="p-3 text-slate-400">{s.className}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t bg-white flex justify-between items-center">
          <div className="text-sm font-medium text-slate-500">Đã chọn: <span className="text-blue-600 font-bold">{selectedStudentsToAdd.size}</span> học viên</div>
          <div className="flex gap-3">
            <button onClick={() => setIsAddStudentModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Hủy</button>
            <button onClick={handleAddStudentsToTemp} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">Thêm vào danh sách</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocsModal = () => {
    const student = tempStudents.find(s => s.id === viewingDocsStudentId);
    if (!student || !student.documents) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">Hồ sơ đính kèm ({student.documents.length})</h3>
            <button onClick={() => setViewingDocsStudentId(null)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            <div className="space-y-2">
              {student.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-md hover:border-blue-200 hover:shadow-sm group transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-slate-700 truncate" title={doc.name}>{doc.name}</span>
                      <span className="text-[10px] text-slate-400">{doc.date} • {doc.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
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
          </div>
        </div>
      </div>
    );
  };

  const renderGradeModal = () => {
    if (!viewingGradeStudentId) return null;
    const student = tempStudents.find(s => s.id === viewingGradeStudentId);
    if (!student) return null;
    const openingId = formData.relatedOpeningId;
    const gradeRecord = examGrades.find(eg => {
      const did = eg.decision?.documentId || eg.decision?.id;
      return String(did) === String(openingId);
    });
    const classObj = availableClasses.find(c =>
      String(c.id) === String(formData.classId) || String(c.documentId) === String(formData.classId)
    );
    const subjects = classObj?.subjects || [];
    const subjectGrades = gradeRecord?.grades || {};
    const gradeRows = subjects.map((subj: any) => {
      const subId = String(subj.strapiId || subj.id);
      const gradeVal = subjectGrades[subId]?.[student.studentCode];
      let theory = '--', practice = '--', overall = '--';
      if (gradeVal !== undefined && gradeVal !== null && gradeVal !== '') {
        if (typeof gradeVal === 'object') {
          theory = (gradeVal.theory !== undefined && gradeVal.theory !== '') ? String(gradeVal.theory) : '--';
          practice = (gradeVal.practice !== undefined && gradeVal.practice !== '') ? String(gradeVal.practice) : '--';
          overall = (gradeVal.overall !== undefined && gradeVal.overall !== '') ? String(gradeVal.overall) : '--';
        } else { overall = String(gradeVal); }
      }
      return { name: subj.name || subj.attributes?.name || 'Môn học', theory, practice, overall };
    });
    const hasGrades = gradeRecord && subjects.length > 0;
    return (
      <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">{student.fullName?.charAt(0)}</div>
              <div>
                <div className="font-black text-lg uppercase tracking-wide">{student.fullName}</div>
                <div className="text-blue-200 text-xs">Mã HV: {student.studentCode || '--'}  •  CCCD: {student.cardNumber || '--'}</div>
              </div>
            </div>
            <button onClick={() => setViewingGradeStudentId(null)} className="hover:bg-blue-600 p-1.5 rounded-full transition-colors"><X size={20} /></button>
          </div>
          <div className="bg-blue-50 px-6 py-2 flex flex-wrap gap-4 text-xs text-blue-700 font-medium border-b border-blue-100 shrink-0">
            <span>📅 Ngày sinh: <strong>{student.dob ? new Date(student.dob).toLocaleDateString('vi-VN') : '--'}</strong></span>
            <span>🏨 Quê quán: <strong>{student.hometown || '--'}</strong></span>
            <span>👤 Giới tính: <strong>{student.gender || '--'}</strong></span>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {!hasGrades ? (
              <div className="py-16 text-center">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-slate-500 font-semibold">{openingId ? 'Chưa có dữ liệu điểm cho học viên này.' : 'Quyết định chưa liên kết QD mở lớp.'}</p>
                <p className="text-slate-400 text-xs mt-1">Dữ liệu điểm được nhập ở mục Nhập điểm thi.</p>
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Kết quả học tập — {formData.className || formData.trainingCourse}</div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-bold text-xs uppercase tracking-wide">Môn học</th>
                      <th className="px-4 py-3 text-center font-bold text-xs uppercase tracking-wide w-28">Lý thuyết</th>
                      <th className="px-4 py-3 text-center font-bold text-xs uppercase tracking-wide w-28">Thực hành</th>
                      <th className="px-4 py-3 text-center font-bold text-xs uppercase tracking-wide w-28">Tổng/ĐG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gradeRows.map((row, i) => (
                      <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-blue-50/40 transition-colors`}>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.name}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-sm font-black ${row.theory !== '--' ? 'bg-blue-100 text-blue-700' : 'text-slate-300'}`}>{row.theory}</span></td>
                        <td className="px-4 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-sm font-black ${row.practice !== '--' ? 'bg-purple-100 text-purple-700' : 'text-slate-300'}`}>{row.practice}</span></td>
                        <td className="px-4 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-sm font-black ${row.overall !== '--' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300'}`}>{row.overall}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end shrink-0">
            <button onClick={() => setViewingGradeStudentId(null)} className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors">Dóng</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-5">

          {/* Left: Icon + Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
              <FileText size={22} className={viewType === 'OPENING' ? "text-blue-600" : "text-emerald-600"} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">
                {viewType === 'OPENING' ? "Quản lý Quyết định Mở lớp" : "Quản lý Quyết định Công nhận"}
              </h1>
              <p className="text-xs text-slate-400">
                {viewType === 'OPENING' ? "Quản lý các quyết định mở lớp đào tạo" : "Quản lý các quyết định công nhận tốt nghiệp và cấp chứng chỉ"}
              </p>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 relative group">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Tìm theo số QĐ, tên lớp, khóa đào tạo..."
              value={mainSearchTerm}
              onChange={e => setMainSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
            />
          </div>

          {/* Right: Buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { setIsAuditModalOpen(true); loadAuditLogs(); }}
              className="bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <History size={15} /> Lịch sử
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  number: '', signedDate: new Date().toISOString().split('T')[0], signer: 'HIỆU TRƯỞNG',
                  location: FIXED_LOCATION, company: '', classType: '', classCode: '', className: '', trainingCourse: '', notes: '', classId: '', relatedOpeningId: '', startIndex: '1'
                });
                setTempStudents([]);
                if (viewType === 'RECOGNITION') {
                  loadAvailableOpeningDecisions();
                }
                setIsFormOpen(true);
              }}
              className={`${viewType === 'OPENING' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all`}
            >
              <Plus size={15} /> Tạo mới
            </button>
          </div>

        </div>
      </div>

      {/* Tabs Control */}
      {
        !mode && (
          <div className="bg-white p-1.5 rounded-xl inline-flex mb-8 border border-slate-200 shadow-sm">
            <button
              onClick={() => setViewType('OPENING')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewType === 'OPENING' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <School size={18} /> Quyết định Mở lớp
            </button>
            <button
              onClick={() => setViewType('RECOGNITION')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewType === 'RECOGNITION' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <GraduationCap size={18} /> Quyết định Công nhận
            </button>
          </div>
        )
      }

      {
        error && (
          <div className="px-6 mb-4 bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm mx-6">
            <Search size={15} />
            <span className="font-medium">{error}</span>
          </div>
        )
      }

      {
        loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium tracking-wide">Đang tải dữ liệu...</p>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Không tìm thấy quyết định nào.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden shadow-slate-200/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-10 text-center">STT</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-24">Số QĐ</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lớp Đào Tạo</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-28">Đợt/Khóa</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-28">Ngày Ký</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-20 text-center">Học Viên</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-28">Người Ký</th>
                    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-24 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDecisions.map((d, index) => (
                    <tr
                      key={d.id}
                      className={`transition-all cursor-pointer group ${checkIfLocked(d.id) ? 'bg-slate-50/50 grayscale-[0.3]' : 'hover:bg-blue-50/40'}`}
                      onClick={() => {
                        if (checkIfLocked(d.id)) {
                          alert("Quyết định này đã bị khóa (Đã có QĐ Công nhận). Bạn chỉ có thể xem, không thể sửa.");
                        }
                        setEditingId(d.id);
                        setFormData({
                          number: d.number, signedDate: d.signedDate, signer: d.signer,
                          location: d.location, company: d.company, classType: d.classType,
                          classCode: d.classCode, className: d.className, trainingCourse: d.trainingCourse, notes: d.notes, classId: d.classId || '', relatedOpeningId: d.relatedOpeningId || '', startIndex: '1'
                        });
                        setTempStudents(d.students || []);
                        setIsFormOpen(true);
                      }}
                    >
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-400 text-center">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {d.number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] font-medium text-slate-700 group-hover:text-blue-600 transition-colors leading-snug">
                        {d.className}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {d.trainingCourse || '---'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar size={12} className="text-slate-300" />
                          {d.signedDate ? new Date(d.signedDate).toLocaleDateString('vi-VN') : '--'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                          <Users size={10} />
                          {d.students ? d.students.length : 0}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {d.signer}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {!checkIfLocked(d.id) && (
                            <>
                              <button
                                onClick={(e) => handleOpenEditDecision(d, e)}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                title="Sửa quyết định"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteDecision(d.id, e)}
                                className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                                title="Xóa quyết định"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {checkIfLocked(d.id) && (
                            <button
                              onClick={(e) => handleUnlockDecision(d.id, e)}
                              className="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all text-[10px] font-semibold rounded border border-amber-100 flex items-center gap-1"
                              title="Bấm để mở khóa"
                            >
                              <ShieldCheck size={11} /> Đã khóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-widest">
              <span>Tổng cộng: {totalItems} quyết định</span>
              <div className="flex items-center gap-4 lowercase font-medium tracking-normal">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  &laquo; Trước
                </button>
                <span className="text-slate-500">
                  Trang <span className="text-blue-600 font-black">{currentPage}</span> / {Math.ceil(totalItems / ITEMS_PER_PAGE) || 1}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE) || 1, p + 1))}
                  disabled={currentPage === Math.ceil(totalItems / ITEMS_PER_PAGE) || totalItems === 0}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Sau &raquo;
                </button>
              </div>
            </div>
          </div>
        )
      }
      {isFormOpen && renderDecisionForm()}

      {isAddStudentModalOpen && renderAddStudentModal()}
      {isEditStudentModalOpen && renderEditStudentModal()}
      {renderDocsModal()}
      {renderGradeModal()}

      {/* Audit Log Modal */}
      {
        isAuditModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
              <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <History className="text-blue-400" />
                  <h2 className="text-lg font-bold">Lịch sử hoạt động</h2>
                </div>
                <button onClick={() => setIsAuditModalOpen(false)} className="hover:bg-slate-700 p-1 rounded-full"><X /></button>
              </div>

              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b text-slate-500 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="px-6 py-3 w-40">Thời gian</th>
                      <th className="px-6 py-3 w-40">Người thực hiện</th>
                      <th className="px-6 py-3 w-32">Hành động</th>
                      <th className="px-6 py-3">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-500 font-medium">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            {new Date(log.createdAt || log.publishedAt).toLocaleString('vi-VN')}
                          </div>
                        </td>
                        <td className="px-6 py-3 font-bold text-slate-700">{log.actor}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase ${(log.action || '').includes('CREATE') ? 'bg-green-100 text-green-700' :
                            (log.action || '').includes('UPDATE') ? 'bg-blue-100 text-blue-700' :
                              (log.action || '').includes('DELETE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{log.details}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400">Chưa có lịch sử hoạt động nào.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }

      {/* Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="bg-emerald-700 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-emerald-300" />
                <div>
                  <h2 className="text-lg font-bold">Xem trước dữ liệu Import</h2>
                  <p className="text-emerald-200 text-xs">{importRows.length} quyết định sẽ được tạo mới (loại: Công nhận)</p>
                </div>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setImportRows([]); }} className="hover:bg-emerald-600 p-1 rounded-full"><X /></button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-500 uppercase text-[11px] font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-3 w-8">#</th>
                    <th className="px-3 py-3">Số QĐ</th>
                    <th className="px-3 py-3">Tên lớp</th>
                    <th className="px-3 py-3">Đợt/Khóa</th>
                    <th className="px-3 py-3">Ngày ký</th>
                    <th className="px-3 py-3">Họ và tên HV</th>
                    <th className="px-3 py-3">Ngày sinh</th>
                    <th className="px-3 py-3">Giới tính</th>
                    <th className="px-3 py-3">Số CMND</th>
                    <th className="px-3 py-3">Mã HV</th>
                    <th className="px-3 py-3">Quê quán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importRows.map((row, i) => {
                    // Check if same so_qd as previous row (visually group)
                    const isSameQD = i > 0 && importRows[i - 1].so_qd === row.so_qd;
                    return (
                      <tr key={i} className={`hover:bg-blue-50 ${isSameQD ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2">
                          {!isSameQD && <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-black text-xs border border-blue-100">{row.so_qd}</span>}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700 text-xs uppercase">{!isSameQD && row.ten_lop}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{!isSameQD && row.dot_khoa}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{!isSameQD && row.ngay_ky}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800 text-xs">{row.ho_ten}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{row.ngay_sinh}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{row.gioi_tinh}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{row.so_cmnd}</td>
                        <td className="px-3 py-2 text-emerald-600 font-mono text-xs">{row.ma_hv}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{row.que_quan}</td>
                      </tr>
                    );
                  })}
                  {importRows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400">Không có dữ liệu để import.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
              <div className="text-sm text-slate-500">
                <span className="font-bold text-slate-700">{new Set(importRows.map(r => r.so_qd)).size}</span> quyết định •{' '}
                <span className="font-bold text-slate-700">{importRows.filter(r => r.ho_ten).length}</span> học viên
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsImportModalOpen(false); setImportRows([]); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importLoading || importRows.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
                >
                  {importLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang import...</>
                  ) : (
                    <><Upload size={18} /> Xác nhận Import ({new Set(importRows.map(r => r.so_qd)).size} QĐ)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionsView;
