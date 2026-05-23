
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Edit2, Trash2, Search, X, GraduationCap, Phone, Mail, Book, BookMarked, Check, Clock, FileText, Globe, Layers, Truck, Building, MapPin, Home, School, Users, Download, FileSpreadsheet } from 'lucide-react';

import { CATEGORY_TYPES } from '../constants';
import PrintTemplatesView from './PrintTemplatesView'; // Import the view
// Added Subject to imports
import { Teacher, Subject } from '../types';
import { fetchCategory, createCategory, updateCategory, deleteCategory, publishDocument, COLLECTIONS } from '../services/api';

interface Nation {
  id: string;
  code: string;
  name: string;
  abbr: string;
  status: 'active' | 'inactive';
  createdAt: string;
}



interface Supplier {
  id: string;
  code: string;
  name: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface Classroom {
  id: string;
  code: string;
  name: string;
  capacity: number;
  building: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface ClassRoom {
  id: string;
  code: string;
  name: string;
  notes: string;
  status: 'active' | 'inactive';
  subjectIds: string[];
  startDate?: string;
  endDate?: string;
  studentCount?: number;
  createdAt: string;
}

// Removed local Subject interface as it is now imported from ../types



const CategoriesView: React.FC = () => {
  console.log('CategoriesView mounting');
  const [activeTab, setActiveTab] = useState('classes');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  // Data States
  const [nations, setNations] = useState<Nation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Load Data from API
  const loadData = async () => {
    console.log('loadData');
    try {
      const [nationsData, suppliersData, classroomsData, classesData, subjectsData, teachersData, usersListData] = await Promise.all([
        fetchCategory(COLLECTIONS.NATIONS),
        fetchCategory(COLLECTIONS.SUPPLIERS),
        fetchCategory(COLLECTIONS.CLASSROOMS),
        fetchCategory(COLLECTIONS.CLASSES),
        fetchCategory(COLLECTIONS.SUBJECTS),
        fetchCategory(COLLECTIONS.TEACHERS),
        fetchCategory('users') // or fetchUsers()
      ]);

      setNations(nationsData || []);
      setUsers(usersListData || []);

      if (suppliersData) {
        setSuppliers(suppliersData.map((s: any) => ({
          ...s,
          taxId: s.tax_id || s.taxId
        })));
      } else {
        setSuppliers([]);
      }

      setClassrooms(classroomsData || []);

      // Map classes fields if needed
      if (classesData) {
        setClasses(classesData.map((c: any) => {
          const subjectsArr = c.subjects?.data || (Array.isArray(c.subjects) ? c.subjects : []);
          return {
            ...c,
            startDate: c.start_date || c.startDate,
            endDate: c.end_date || c.endDate,
            studentCount: c.student_count || c.studentCount || 0,
            subjectIds: subjectsArr.map((s: any) => String(s.documentId || s.id))
          };
        }));
      } else {
        setClasses([]);
      }

      if (subjectsData) {
        setSubjects(subjectsData.map((s: any) => ({
          ...s,
          id: s.documentId || s.id, // KEEP Document ID for URLs/Updates
          strapiId: Number(s.strapiId || s.id), // Use numeric ID for relations
          totalHours: s.total_hours || s.totalHours,
          theoryHours: s.theory_hours || s.theoryHours,
          practiceHours: s.practice_hours || s.practiceHours,
          exerciseHours: s.exercise_hours || s.exerciseHours,
          examHours: s.exam_hours || s.examHours,
          hasTheory: s.has_theory ?? s.hasTheory ?? true,
          hasPractice: s.has_practice ?? s.hasPractice ?? false,
        })));
      } else {
        setSubjects([]);
      }

      if (teachersData) {
        setTeachers(teachersData.map((t: any) => {
          const subjectsArr = t.subjects?.data || (Array.isArray(t.subjects) ? t.subjects : []);
          return {
            ...t,
            subjectIds: subjectsArr.map((s: any) => String(s.documentId || s.id))
          };
        }));
      } else {
        setTeachers([]);
      }

    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]); // Refresh on tab switch to be safe and responsive to changes

  // Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nationForm, setNationForm] = useState({ code: '', name: '', abbr: '', status: 'active' as 'active' | 'inactive' });
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ code: '', name: '', taxId: '', phone: '', email: '', address: '', status: 'active' });
  const [classroomForm, setClassroomForm] = useState<Partial<Classroom>>({ code: '', name: '', capacity: 0, building: '', status: 'active' });
  const [classForm, setClassForm] = useState<Partial<ClassRoom>>({ code: '', name: '', notes: '', status: 'active', subjectIds: [] });
  const [subjectForm, setSubjectForm] = useState<Partial<Subject>>({ code: '', name: '', sessions: 0, totalHours: 0, theoryHours: 0, practiceHours: 0, exerciseHours: 0, examHours: 0, hasTheory: true, hasPractice: false, notes: '' });
  const [teacherForm, setTeacherForm] = useState<Partial<Teacher>>({ name: '', code: '', specialization: '', phone: '', email: '', subjectIds: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset selection and search on tab change
  useEffect(() => {
    setSelectedIds([]);
    setSearchTerm('');
  }, [activeTab]);

  // Sync Persistence removed in favor of API

  // --- Excel Import Handlers ---

  const handleImportSubjectsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result;
      if (!arrayBuffer) return;

      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      console.log('Parsed Excel Data:', data);

      let importedCount = 0;
      let errorCount = 0;
      let lastError = '';

      const promises = data.map(async (row: any, index: number) => {
        const name = row['Tên môn học'] || row['Tên môn'] || row['Name'];
        if (!name) return;

        const payload = {
          code: row['Mã môn'] || row['Code'] || `MH_IMP_${Date.now()}_${index}`,
          name: name,
          sessions: Number(row['Số ca'] || row['Sessions'] || 0),
          total_hours: Number(row['Tổng giờ'] || row['Total Hours'] || 0),
          theory_hours: Number(row['Lý thuyết'] || row['LT'] || row['Theory'] || 0),
          practice_hours: Number(row['Thực hành'] || row['TH'] || row['Practice'] || 0),
          exercise_hours: Number(row['Bài tập'] || row['BT'] || row['Exercise'] || 0),
          exam_hours: Number(row['Thi'] || row['Exam'] || 0),
          notes: row['Ghi chú'] || row['Notes'] || ''
        };

        try {
          await createCategory(COLLECTIONS.SUBJECTS, payload);
          importedCount++;
        } catch (err: any) {
          console.error('Error importing subject:', payload.code, err);
          errorCount++;
          lastError = err.message || String(err);
        }
      });

      await Promise.all(promises);

      if (importedCount > 0 || errorCount > 0) {
        alert(`Kết quả nhập môn học:\n- Thành công: ${importedCount}\n- Lỗi: ${errorCount}\n\nChi tiết lỗi cuối cùng: ${lastError}\n(Xem console để biết thêm)`);
        if (importedCount > 0) loadData();
      } else {
        alert('Không tìm thấy dữ liệu hợp lệ. Vui lòng kiểm tra tên cột trong file Excel ("Tên môn học", "Mã môn"...).');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDownloadSubjectsTemplate = () => {
    const headers = ['Mã môn', 'Tên môn học', 'Số ca', 'Tổng giờ', 'Lý thuyết', 'Thực hành', 'Bài tập', 'Thi', 'Ghi chú'];
    const sampleData = [
      ['MH001', 'Mẫu môn học 1', 15, 45, 15, 30, 0, 0, 'Mẫu nhập liệu'],
      ['MH002', 'Mẫu môn học 2', 20, 60, 20, 30, 5, 5, '']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách môn học');
    XLSX.writeFile(wb, 'Mau_Nhap_Mon_Hoc.xlsx');
  };

  const handleImportClassesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result;
      if (!arrayBuffer) return;

      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      let importedCount = 0;
      let errorCount = 0;

      const promises = data.map(async (row: any, index: number) => {
        const name = row['Tên lớp'] || row['Name'];
        if (!name) return;

        const payload = {
          code: row['Mã lớp'] || row['Code'] || `CLS_IMP_${Date.now()}_${index}`,
          name: name,
          notes: row['Ghi chú'] || row['Notes'] || '',
          status: 'active',
          start_date: row['Ngày bắt đầu'] || new Date().toISOString().split('T')[0],
          end_date: row['Ngày kết thúc'] || new Date().toISOString().split('T')[0],
          student_count: 0
        };

        try {
          await createCategory(COLLECTIONS.CLASSES, payload);
          importedCount++;
        } catch (err) {
          console.error('Error importing class:', payload.code, err);
          errorCount++;
        }
      });

      await Promise.all(promises);

      if (importedCount > 0) {
        alert(`Đã nhập thành công ${importedCount} lớp học! ${errorCount > 0 ? `(Lỗi ${errorCount} bản ghi)` : ''}`);
        loadData();
      } else {
        alert('Không tìm thấy dữ liệu hợp lệ.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDownloadClassesTemplate = () => {
    const headers = ['Mã lớp', 'Tên lớp', 'Ghi chú', 'Ngày bắt đầu', 'Ngày kết thúc'];
    const sampleData = [['K25-CN1', 'Lớp K25 - Chuyên ngành 1', 'Lớp Chất lượng cao', '2025-01-01', '2025-06-01']];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách lớp');
    XLSX.writeFile(wb, 'Mau_Nhap_Lop_Hoc.xlsx');
  };

  const handleImportTeachersExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result;
      if (!arrayBuffer) return;

      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      let importedCount = 0;
      let errorCount = 0;

      const promises = data.map(async (row: any, index: number) => {
        const name = row['Họ và tên'] || row['Họ tên'] || row['Name'];
        if (!name) return;

        const payload = {
          code: row['Mã giảng viên'] || row['Mã GV'] || row['Code'] || `GV_IMP_${Date.now()}_${index}`,
          name: name,
          specialization: row['Chuyên môn'] || row['Specialization'] || '',
          phone: row['Điện thoại'] || row['SĐT'] || row['Phone'] || '',
          email: row['Email'] || '',
          subjects: []
        };

        try {
          await createCategory(COLLECTIONS.TEACHERS, payload);
          importedCount++;
        } catch (err) {
          console.error('Error importing teacher:', payload.code, err);
          errorCount++;
        }
      });

      await Promise.all(promises);

      if (importedCount > 0) {
        alert(`Đã nhập thành công ${importedCount} giảng viên! ${errorCount > 0 ? `(Lỗi ${errorCount} bản ghi)` : ''}`);
        loadData();
      } else {
        alert('Không tìm thấy dữ liệu hợp lệ.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDownloadTeachersTemplate = () => {
    const headers = ['Mã giảng viên', 'Họ và tên', 'Chuyên môn', 'Điện thoại', 'Email'];
    const sampleData = [['GV001', 'Nguyễn Văn A', 'Công nghệ thông tin', '0901234567', 'email@example.com']];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách giảng viên');
    XLSX.writeFile(wb, 'Mau_Nhap_Giang_Vien.xlsx');
  };

  const handleAddNew = () => {
    setEditingId(null);
    if (activeTab === 'nations') setNationForm({ code: '', name: '', abbr: '', status: 'active' });
    else if (activeTab === 'suppliers') setSupplierForm({ code: '', name: '', taxId: '', phone: '', email: '', address: '', status: 'active' });
    else if (activeTab === 'classrooms') setClassroomForm({ code: '', name: '', capacity: 0, building: '', status: 'active' });
    else if (activeTab === 'classes') setClassForm({ code: '', name: '', notes: '', status: 'active', subjectIds: [] });
    else if (activeTab === 'subjects') setSubjectForm({ code: '', name: '', sessions: 0, totalHours: 0, theoryHours: 0, practiceHours: 0, exerciseHours: 0, examHours: 0, hasTheory: true, hasPractice: false, notes: '' });
    else if (activeTab === 'teachers') setTeacherForm({ name: '', code: '', specialization: '', phone: '', email: '', subjectIds: [] });
    setIsFormOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    if (activeTab === 'nations') setNationForm(item);
    else if (activeTab === 'suppliers') setSupplierForm(item);
    else if (activeTab === 'classrooms') setClassroomForm(item);
    else if (activeTab === 'classes') setClassForm({ ...item, subjectIds: item.subjectIds || [] });
    else if (activeTab === 'subjects') setSubjectForm({ ...item });
    else if (activeTab === 'teachers') setTeacherForm({ ...item, subjectIds: item.subjectIds || [] });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const timestamp = new Date().toISOString(); // Use ISO for API

    try {
      if (activeTab === 'classes') {
        if (!classForm.name || !classForm.code) return alert('Vui lòng nhập Mã và Tên lớp học!');
        // Map documentIds -> numeric strapiIds for Strapi v5 relation updates
        const classSubjectNumericIds = (classForm.subjectIds || []).map(docId => {
          const found = subjects.find((s: any) => String(s.id) === String(docId) || String(s.documentId) === String(docId));
          return found ? found.strapiId : null;
        }).filter(Boolean);

        const payload = {
          code: classForm.code,
          name: classForm.name,
          notes: classForm.notes,
          status: classForm.status,
          start_date: classForm.startDate || undefined,
          end_date: classForm.endDate || undefined,
          subjects: classSubjectNumericIds
        };

        if (editingId) {
          await updateCategory(COLLECTIONS.CLASSES, editingId, payload);
          await publishDocument(COLLECTIONS.CLASSES, editingId);
        } else {
          await createCategory(COLLECTIONS.CLASSES, payload);
        }
      } else if (activeTab === 'nations') {
        if (!nationForm.name || !nationForm.code) return alert('Vui lòng nhập Mã và Tên quốc gia!');
        const payload = {
          code: nationForm.code,
          name: nationForm.name,
          abbr: nationForm.abbr,
          status: nationForm.status
        };
        if (editingId) await updateCategory(COLLECTIONS.NATIONS, editingId, payload);
        else await createCategory(COLLECTIONS.NATIONS, payload);
      } else if (activeTab === 'suppliers') {
        if (!supplierForm.name || !supplierForm.code) return alert('Vui lòng nhập Mã và Tên dãy nhà!');
        const payload = {
          code: supplierForm.code,
          name: supplierForm.name,
          tax_id: supplierForm.taxId,
          phone: supplierForm.phone,
          email: supplierForm.email,
          address: supplierForm.address,
          status: supplierForm.status
        };
        if (editingId) await updateCategory(COLLECTIONS.SUPPLIERS, editingId, payload);
        else await createCategory(COLLECTIONS.SUPPLIERS, payload);
      } else if (activeTab === 'classrooms') {
        if (!classroomForm.name || !classroomForm.code) return alert('Vui lòng nhập Mã và Tên phòng học!');
        const payload = {
          code: classroomForm.code,
          name: classroomForm.name,
          capacity: classroomForm.capacity,
          building: classroomForm.building,
          status: classroomForm.status
        };
        if (editingId) await updateCategory(COLLECTIONS.CLASSROOMS, editingId, payload);
        else await createCategory(COLLECTIONS.CLASSROOMS, payload);
      } else if (activeTab === 'teachers') {
        // Map documentIds -> numeric strapiIds for Strapi v5 relation updates
        const teacherSubjectNumericIds = (teacherForm.subjectIds || []).map(docId => {
          const found = subjects.find((s: any) => String(s.id) === String(docId) || String(s.documentId) === String(docId));
          return found ? found.strapiId : null;
        }).filter(Boolean);

        const payload = {
          code: teacherForm.code,
          name: teacherForm.name,
          specialization: teacherForm.specialization,
          phone: teacherForm.phone,
          email: teacherForm.email,
          subjects: teacherSubjectNumericIds
        };
        if (editingId) {
          await updateCategory(COLLECTIONS.TEACHERS, editingId, payload);
          await publishDocument(COLLECTIONS.TEACHERS, editingId);
        } else {
          await createCategory(COLLECTIONS.TEACHERS, payload);
        }
      } else if (activeTab === 'subjects') {
        const payload = {
          code: subjectForm.code,
          name: subjectForm.name,
          sessions: subjectForm.sessions,
          total_hours: subjectForm.totalHours,
          theory_hours: subjectForm.theoryHours,
          practice_hours: subjectForm.practiceHours,
          exercise_hours: subjectForm.exerciseHours,
          exam_hours: subjectForm.examHours,
          has_theory: subjectForm.hasTheory,
          has_practice: subjectForm.hasPractice,
          notes: subjectForm.notes
        };
        if (editingId) await updateCategory(COLLECTIONS.SUBJECTS, editingId, payload);
        else await createCategory(COLLECTIONS.SUBJECTS, payload);
      }

      // Reload data to ensure sync
      await loadData();
      setIsFormOpen(false);
      alert('Lưu thành công!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Lưu thất bại: ' + err + '\n(Vui lòng tải lại trang F5 nếu lỗi vẫn tiếp diễn)');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab === 'nations' && id === '1') return alert('Không thể xóa quốc gia mặc định!');

    if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
      try {
        let collection = '';
        if (activeTab === 'classes') collection = COLLECTIONS.CLASSES;
        else if (activeTab === 'nations') collection = COLLECTIONS.NATIONS;
        else if (activeTab === 'suppliers') collection = COLLECTIONS.SUPPLIERS;
        else if (activeTab === 'classrooms') collection = COLLECTIONS.CLASSROOMS;
        else if (activeTab === 'teachers') collection = COLLECTIONS.TEACHERS;
        else if (activeTab === 'subjects') collection = COLLECTIONS.SUBJECTS;

        if (collection) {
          await deleteCategory(collection, id);
          await loadData(); // Reload list
        }
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Xóa thất bại!");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} mục đã chọn?`)) return;

    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    let collection = '';
    if (activeTab === 'classes') collection = COLLECTIONS.CLASSES;
    else if (activeTab === 'teachers') collection = COLLECTIONS.TEACHERS;
    else if (activeTab === 'subjects') collection = COLLECTIONS.SUBJECTS;

    if (!collection) return;

    for (const id of selectedIds) {
      try {
        await deleteCategory(collection, id);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to delete ${id}`, err);
        failCount++;
        lastError = err.message || String(err);
      }
    }

    await loadData();
    setSelectedIds([]);

    if (failCount > 0) {
      alert(`Đã xóa ${successCount} mục. Thất bại ${failCount} mục.\nLỗi: ${lastError}\n\nNguyên nhân thường gặp: Chưa cấp quyền "Delete" trong Strapi (Settings -> Roles -> Public/Authenticated).`);
    } else {
      alert(`Đã xóa thành công ${successCount} mục!`);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = (items: any[]) => {
    if (selectedIds.length === items.length && items.length > 0) setSelectedIds([]);
    else setSelectedIds(items.map(i => i.id));
  };

  const toggleSubjectInClass = (subjectId: string | number) => {
    const currentIds = classForm.subjectIds || [];
    if (currentIds.includes(String(subjectId))) {
      setClassForm({ ...classForm, subjectIds: currentIds.filter(id => id !== String(subjectId)) });
    } else {
      setClassForm({ ...classForm, subjectIds: [...currentIds, String(subjectId)] });
    }
  };

  const toggleSubjectInTeacher = (subjectId: string | number) => {
    const currentIds = teacherForm.subjectIds || [];
    if (currentIds.includes(String(subjectId))) {
      setTeacherForm({ ...teacherForm, subjectIds: currentIds.filter(id => id !== String(subjectId)) });
    } else {
      setTeacherForm({ ...teacherForm, subjectIds: [...currentIds, String(subjectId)] });
    }
  };

  const renderSuppliersForm = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-2 flex justify-between items-center text-sm font-bold uppercase tracking-wide">
          <span>Thông tin Dãy Nhà</span>
          <button onClick={() => setIsFormOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2 text-[11px]">
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] font-bold">Lưu</button>
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-1.5 bg-white text-slate-700 rounded border border-slate-300 font-bold">Đóng</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Mã Dãy<span className="text-red-500">*</span></label>
              <input value={supplierForm.code} onChange={e => setSupplierForm({ ...supplierForm, code: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: DAY-A" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Ghi chú nhanh</label>
              <input value={supplierForm.taxId} onChange={e => setSupplierForm({ ...supplierForm, taxId: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="Thông tin bổ sung..." />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Tên Dãy Nhà<span className="text-red-500">*</span></label>
            <input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="Tên đầy đủ dãy nhà..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Vị trí / Địa chỉ</label>
            <input value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="Vị trí trong khuôn viên..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Trạng thái</label>
            <select value={supplierForm.status} onChange={e => setSupplierForm({ ...supplierForm, status: e.target.value as any })} className="w-full border p-2 rounded outline-none focus:border-blue-500">
              <option value="active">Đang sử dụng</option>
              <option value="inactive">Tạm ngưng / Sửa chữa</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderClassroomsForm = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-2 flex justify-between items-center text-sm font-bold uppercase tracking-wide">
          <span>Thông tin Phòng học</span>
          <button onClick={() => setIsFormOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2 text-[11px]">
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] font-bold">Lưu</button>
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-1.5 bg-white text-slate-700 rounded border border-slate-300 font-bold">Đóng</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Mã Phòng<span className="text-red-500">*</span></label>
              <input value={classroomForm.code} onChange={e => setClassroomForm({ ...classroomForm, code: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: P101" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Sức chứa (Người)</label>
              <input type="number" value={classroomForm.capacity} onChange={e => setClassroomForm({ ...classroomForm, capacity: Number(e.target.value) })} className="w-full border p-2 rounded outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Tên Phòng học<span className="text-red-500">*</span></label>
            <input value={classroomForm.name} onChange={e => setClassroomForm({ ...classroomForm, name: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: Phòng lý thuyết 1" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Thuộc Dãy nhà</label>
            <select value={classroomForm.building} onChange={e => setClassroomForm({ ...classroomForm, building: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500">
              <option value="">--Chọn dãy nhà--</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Trạng thái</label>
            <select value={classroomForm.status} onChange={e => setClassroomForm({ ...classroomForm, status: e.target.value as any })} className="w-full border p-2 rounded outline-none focus:border-blue-500">
              <option value="active">Sẵn sàng</option>
              <option value="inactive">Đang bận / Bảo trì</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderClassesForm = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-2 flex justify-between items-center text-sm font-bold uppercase tracking-wide">
          <span>Thông tin lớp học</span>
          <button onClick={() => setIsFormOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2 text-[11px]">
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] font-bold">Lưu</button>
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-1.5 bg-white text-slate-700 rounded border border-slate-300 font-bold">Đóng</button>
        </div>
        <div className="p-6 grid grid-cols-12 gap-8 text-sm overflow-y-auto max-h-[75vh]">
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-1 text-xs uppercase">Thông tin cơ bản</h3>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Mã lớp học<span className="text-red-500">*</span></label>
              <input value={classForm.code} onChange={e => setClassForm({ ...classForm, code: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: K25-KT" />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Tên lớp học<span className="text-red-500">*</span></label>
              <input value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: Kỹ thuật Cơ bản K25" />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Trạng thái</label>
              <select value={classForm.status} onChange={e => setClassForm({ ...classForm, status: e.target.value as any })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500">
                <option value="active">Đang sử dụng</option>
                <option value="inactive">Tạm ngưng</option>
              </select>
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Ghi chú</label>
              <textarea value={classForm.notes} onChange={e => setClassForm({ ...classForm, notes: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500 min-h-[80px]" placeholder="Nhập ghi chú cho lớp học..." />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 flex flex-col">
            <h3 className="font-bold text-slate-800 border-b pb-1 text-xs uppercase mb-3 flex justify-between items-center">
              Chương trình đào tạo (Môn học)
              <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{classForm.subjectIds?.length || 0} môn</span>
            </h3>
            <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 p-2 overflow-y-auto max-h-[350px] space-y-1 shadow-inner">
              {subjects.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => toggleSubjectInClass(sub.id)}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border ${classForm.subjectIds?.includes(sub.id) ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200'}`}
                >
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold ${classForm.subjectIds?.includes(sub.id) ? 'text-indigo-100' : 'text-slate-400'}`}>{sub.code}</span>
                    <span className="text-xs font-semibold">{sub.name}</span>
                  </div>
                  {classForm.subjectIds?.includes(sub.id) && <Check size={16} />}
                </div>
              ))}
              {subjects.length === 0 && <p className="text-center py-4 text-xs text-slate-400 italic">Chưa có môn học trong danh mục</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNationsForm = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-2 flex justify-between items-center text-sm font-bold uppercase tracking-wide">
          <span>Thông tin quốc gia</span>
          <button onClick={() => setIsFormOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2 text-[11px]">
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] font-bold">Lưu</button>
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-1.5 bg-white text-slate-700 rounded border border-slate-300 font-bold">Đóng</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Mã Quốc gia<span className="text-red-500">*</span></label>
            <input value={nationForm.code} onChange={e => setNationForm({ ...nationForm, code: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: VN" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Tên Quốc gia<span className="text-red-500">*</span></label>
            <input value={nationForm.name} onChange={e => setNationForm({ ...nationForm, name: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: Việt Nam" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Viết tắt</label>
            <input value={nationForm.abbr} onChange={e => setNationForm({ ...nationForm, abbr: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: VN" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Trạng thái</label>
            <select value={nationForm.status} onChange={e => setNationForm({ ...nationForm, status: e.target.value as any })} className="w-full border p-2 rounded outline-none focus:border-blue-500">
              <option value="active">Đang sử dụng</option>
              <option value="inactive">Tạm ngưng</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeachersForm = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-2 flex justify-between items-center text-sm font-bold uppercase tracking-wide">
          <span>Thông tin giảng viên</span>
          <button onClick={() => setIsFormOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2 text-[11px]">
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] font-bold">Lưu</button>
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-1.5 bg-white text-slate-700 rounded border border-slate-300 font-bold">Đóng</button>
        </div>
        <div className="p-6 grid grid-cols-12 gap-8 text-sm overflow-y-auto max-h-[75vh]">
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-1 text-xs uppercase">Thông tin cơ bản</h3>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Mã giảng viên<span className="text-red-500">*</span></label>
              <input value={teacherForm.code} onChange={e => setTeacherForm({ ...teacherForm, code: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: GV001" />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Họ và tên<span className="text-red-500">*</span></label>
              <input value={teacherForm.name} onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: Nguyễn Văn An" />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Điện thoại</label>
              <input value={teacherForm.phone} onChange={e => setTeacherForm({ ...teacherForm, phone: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: 0901..." />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 text-right font-bold text-slate-600">Email</label>
              <input value={teacherForm.email} onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} className="col-span-8 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: an.nv@edumaster.vn" />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 flex flex-col">
            <h3 className="font-bold text-slate-800 border-b pb-1 text-xs uppercase mb-3">Môn học giảng dạy</h3>
            <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 p-2 overflow-y-auto max-h-[300px] space-y-1">
              {subjects.map(sub => (
                <div key={sub.id} onClick={() => toggleSubjectInTeacher(sub.id)} className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${teacherForm.subjectIds?.includes(sub.id) ? 'bg-blue-600 text-white shadow-sm' : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200'}`}>
                  <span className="text-xs font-medium">{sub.name}</span>
                  {teacherForm.subjectIds?.includes(sub.id) && <Check size={16} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubjectsForm = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-2 flex justify-between items-center text-sm font-bold uppercase tracking-wide">
          <span>Thông tin môn học</span>
          <button onClick={() => setIsFormOpen(false)}><X size={18} /></button>
        </div>
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2 text-[11px]">
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] font-bold">Lưu</button>
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-1.5 bg-white text-slate-700 rounded border border-slate-300 font-bold">Đóng</button>
        </div>
        <div className="p-6 space-y-6 text-sm overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-3 text-right font-bold text-slate-600">Mã môn học<span className="text-red-500">*</span></label>
              <input value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} className="col-span-9 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: MH001" />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-3 text-right font-bold text-slate-600">Tên môn học<span className="text-red-500">*</span></label>
              <input value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} className="col-span-9 border p-2 rounded outline-none focus:border-blue-500" placeholder="VD: An toàn vệ sinh lao động" />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2"><Clock size={14} /> Cấu trúc chương trình</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="w-24 text-right text-xs font-semibold text-slate-600">Số ca:</label>
                <input type="number" value={subjectForm.sessions} onChange={e => setSubjectForm({ ...subjectForm, sessions: Number(e.target.value) })} className="flex-1 border p-1.5 rounded outline-none focus:border-blue-400 bg-white" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-24 text-right text-xs font-semibold text-slate-600">Tổng giờ:</label>
                <input type="number" value={subjectForm.totalHours} onChange={e => setSubjectForm({ ...subjectForm, totalHours: Number(e.target.value) })} className="flex-1 border p-1.5 rounded outline-none focus:border-blue-400 bg-white" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-24 text-right text-xs font-semibold text-slate-600">Lý thuyết:</label>
                <input type="number" value={subjectForm.theoryHours} onChange={e => setSubjectForm({ ...subjectForm, theoryHours: Number(e.target.value) })} className="flex-1 border p-1.5 rounded outline-none focus:border-blue-400 bg-white" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-24 text-right text-xs font-semibold text-slate-600">Thực hành:</label>
                <input type="number" value={subjectForm.practiceHours} onChange={e => setSubjectForm({ ...subjectForm, practiceHours: Number(e.target.value) })} className="flex-1 border p-1.5 rounded outline-none focus:border-blue-400 bg-white" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-24 text-right text-xs font-semibold text-slate-600">Bài tập:</label>
                <input type="number" value={subjectForm.exerciseHours} onChange={e => setSubjectForm({ ...subjectForm, exerciseHours: Number(e.target.value) })} className="flex-1 border p-1.5 rounded outline-none focus:border-blue-400 bg-white" />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-24 text-right text-xs font-semibold text-slate-600">Thi:</label>
                <input type="number" value={subjectForm.examHours} onChange={e => setSubjectForm({ ...subjectForm, examHours: Number(e.target.value) })} className="flex-1 border p-1.5 rounded outline-none focus:border-blue-400 bg-white" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 border-y border-slate-200 py-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-10 h-6 rounded-full transition-colors relative ${subjectForm.hasTheory ? 'bg-blue-600' : 'bg-slate-300'}`} onClick={() => setSubjectForm({ ...subjectForm, hasTheory: !subjectForm.hasTheory })}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${subjectForm.hasTheory ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-xs font-bold text-slate-700">Có Lý thuyết</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-10 h-6 rounded-full transition-colors relative ${subjectForm.hasPractice ? 'bg-orange-600' : 'bg-slate-300'}`} onClick={() => setSubjectForm({ ...subjectForm, hasPractice: !subjectForm.hasPractice })}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${subjectForm.hasPractice ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-xs font-bold text-slate-700">Có Thực hành</span>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Ghi chú:</label>
              <textarea
                value={subjectForm.notes}
                onChange={e => setSubjectForm({ ...subjectForm, notes: e.target.value })}
                className="w-full border p-2 rounded outline-none focus:border-blue-400 min-h-[80px] text-xs bg-white"
                placeholder="Nhập ghi chú chi tiết cho môn học..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Danh mục</h1>
          <p className="text-slate-500">Thiết lập thông tin nền tảng cho hệ thống.</p>
        </div>
        <div className="flex gap-2">
          {/* Import/Template Actions */}
          {['classes', 'subjects', 'teachers'].includes(activeTab) && (
            <>
              <label className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 transition-all cursor-pointer">
                <FileSpreadsheet size={18} />
                <span className="hidden sm:inline">Nhập Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    if (activeTab === 'classes') handleImportClassesExcel(e);
                    else if (activeTab === 'subjects') handleImportSubjectsExcel(e);
                    else if (activeTab === 'teachers') handleImportTeachersExcel(e);
                  }}
                />
              </label>
              <button
                onClick={() => {
                  if (activeTab === 'classes') handleDownloadClassesTemplate();
                  else if (activeTab === 'subjects') handleDownloadSubjectsTemplate();
                  else if (activeTab === 'teachers') handleDownloadTeachersTemplate();
                }}
                className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                title="Tải file mẫu"
              >
                <Download size={18} />
              </button>
            </>
          )}

          {selectedIds.length > 0 && ['classes', 'teachers', 'subjects'].includes(activeTab) && (
            <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-red-900/10 hover:bg-red-700 transition-all animate-in fade-in">
              <Trash2 size={18} /> <span className="hidden sm:inline">Xóa ({selectedIds.length})</span>
            </button>
          )}
          <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-900/10 hover:bg-blue-700 transition-all">
            <Plus size={20} /> <span className="hidden sm:inline">Thêm mới</span>
          </button>

        </div>
      </div>

      {isFormOpen && activeTab === 'classes' && renderClassesForm()}
      {isFormOpen && activeTab === 'nations' && renderNationsForm()}
      {isFormOpen && activeTab === 'suppliers' && renderSuppliersForm()}
      {isFormOpen && activeTab === 'classrooms' && renderClassroomsForm()}
      {isFormOpen && activeTab === 'teachers' && renderTeachersForm()}
      {isFormOpen && activeTab === 'subjects' && renderSubjectsForm()}



      {/* Render Print Templates View directly if active */}
      {activeTab === 'print_templates' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] no-print">
          <div className="w-full md:w-64 border-r border-slate-200 p-4 bg-slate-50/50">
            <div className="space-y-1">
              {CATEGORY_TYPES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === cat.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {cat.icon}
                  <span className="font-medium text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-6">
            <PrintTemplatesView />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] no-print">
          <div className="w-full md:w-64 border-r border-slate-200 p-4 bg-slate-50/50">
            <div className="space-y-1">
              {CATEGORY_TYPES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === cat.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {cat.icon}
                  <span className="font-medium text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-sm:max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={`Tìm kiếm trong ${CATEGORY_TYPES.find(c => c.id === activeTab)?.label}...`} className="w-full bg-slate-100 border-none rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 ring-blue-500/20" />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                  {activeTab === 'classes' ? (
                    <tr>
                      <th className="px-6 py-4 text-center w-12">
                        <input type="checkbox"
                          checked={classes.length > 0 && selectedIds.length === classes.length}
                          onChange={() => toggleSelectAll(classes)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-4">MÃ LỚP</th>
                      <th className="px-6 py-4">TÊN LỚP HỌC</th>
                      <th className="px-6 py-4">CHƯƠNG TRÌNH ĐÀO TẠO</th>
                      <th className="px-6 py-4">TRẠNG THÁI</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : activeTab === 'nations' ? (
                    <tr>
                      <th className="px-6 py-4 w-32">MÃ QG</th>
                      <th className="px-6 py-4">TÊN QUỐC GIA</th>
                      <th className="px-6 py-4 text-center">VIẾT TẮT</th>
                      <th className="px-6 py-4">TRẠNG THÁI</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : activeTab === 'suppliers' ? (
                    <tr>
                      <th className="px-6 py-4 w-32">MÃ DÃY</th>
                      <th className="px-6 py-4">TÊN DÃY NHÀ</th>
                      <th className="px-6 py-4">VỊ TRÍ</th>
                      <th className="px-6 py-4">TRẠNG THÁI</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : activeTab === 'classrooms' ? (
                    <tr>
                      <th className="px-6 py-4 w-32">MÃ PHÒNG</th>
                      <th className="px-6 py-4">TÊN PHÒNG HỌC</th>
                      <th className="px-6 py-4">SỨC CHỨA</th>
                      <th className="px-6 py-4">THUỘC DÃY</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : activeTab === 'teachers' ? (
                    <tr>
                      <th className="px-6 py-4 w-12 text-center">
                        <input type="checkbox"
                          checked={teachers.length > 0 && selectedIds.length === teachers.length}
                          onChange={() => toggleSelectAll(teachers)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-4">MÃ GV</th>
                      <th className="px-6 py-4">HỌ VÀ TÊN</th>
                      <th className="px-6 py-4">MÔN HỌC GIẢNG DẠY</th>
                      <th className="px-6 py-4">LIÊN HỆ</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : activeTab === 'subjects' ? (
                    <tr className="whitespace-nowrap">
                      <th className="px-4 py-4 w-10 text-center">
                        <input type="checkbox"
                          checked={subjects.length > 0 && selectedIds.length === subjects.length}
                          onChange={() => toggleSelectAll(subjects)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-4">MÃ MÔN</th>
                      <th className="px-4 py-4 min-w-[200px]">TÊN MÔN HỌC</th>
                      <th className="px-4 py-4 text-center">SỐ CA</th>
                      <th className="px-4 py-4 text-center font-bold text-blue-700">TỔNG GIỜ</th>
                      <th className="px-4 py-4 text-center">L.THUYẾT</th>
                      <th className="px-4 py-4 text-center">T.HÀNH</th>
                      <th className="px-4 py-4 text-center">B.TẬP</th>
                      <th className="px-4 py-4 text-center">THI</th>
                      <th className="px-4 py-4 min-w-[150px]">GHI CHÚ</th>
                      <th className="px-4 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : activeTab === 'users' ? (
                    <tr>
                      <th className="px-6 py-4">TÊN ĐĂNG NHẬP</th>
                      <th className="px-6 py-4">EMAIL</th>
                      <th className="px-6 py-4">VAI TRÒ</th>
                      <th className="px-6 py-4">TRẠNG THÁI</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-6 py-4">MÃ</th>
                      <th className="px-6 py-4">TÊN / CHI TIẾT</th>
                      <th className="px-6 py-4">NGÀY TẠO</th>
                      <th className="px-6 py-4 text-right">THAO TÁC</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'classes' ? (
                    classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase())).map((cls, idx) => (
                      <tr key={cls.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox"
                            checked={selectedIds.includes(cls.id)}
                            onChange={() => toggleSelection(cls.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-blue-800 text-sm">{cls.code}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Layers size={16} className="text-indigo-500" />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900">{cls.name}</span>
                              {cls.notes && <span className="text-[10px] text-slate-400 italic truncate max-w-[200px]">{cls.notes}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {cls.subjectIds && cls.subjectIds.length > 0 ? (
                              cls.subjectIds.map(sid => {
                                const sub = subjects.find(s => String(s.id) === String(sid) || String(s.documentId) === String(sid) || String(s.strapiId) === String(sid));
                                return (
                                  <span key={sid} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100">
                                    {sub?.name || 'Môn học'}
                                  </span>
                                )
                              })
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Chưa chọn môn học</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${cls.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{cls.status === 'active' ? 'Đang dùng' : 'Tạm ngưng'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(cls)} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={18} /></button>
                            <button onClick={(e) => handleDelete(cls.id, e)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'nations' ? (
                    nations
                      .sort((a, b) => {
                        const aid = String(a.id);
                        const bid = String(b.id);
                        return (aid === '1' ? -1 : bid === '1' ? 1 : 0);
                      })
                      .filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((n) => (
                        <tr key={n.id} className={`hover:bg-slate-50/50 transition-colors group ${String(n.id) === '1' ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-6 py-4 font-bold text-blue-800 text-sm">{n.code}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Globe size={16} className={String(n.id) === '1' ? 'text-red-600' : 'text-slate-400'} />
                              <span className={`text-sm font-bold ${String(n.id) === '1' ? 'text-blue-900' : 'text-slate-900'}`}>{n.name}</span>
                              {String(n.id) === '1' && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">MẶC ĐỊNH</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm font-medium text-slate-600 uppercase">{n.abbr}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${n.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{n.status === 'active' ? 'Đang dùng' : 'Tạm ngưng'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(n)} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={18} /></button>
                              {String(n.id) !== '1' && <button onClick={(e) => handleDelete(n.id, e)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>}
                            </div>
                          </td>
                        </tr>
                      ))
                  ) : activeTab === 'suppliers' ? (
                    suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase())).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-blue-800 text-sm">{s.code}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Home size={16} className="text-orange-500" />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900">{s.name}</span>
                              <span className="text-[10px] text-slate-500">{s.taxId || 'Không có ghi chú'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium truncate max-w-[200px]"><MapPin size={12} className="text-slate-400" /> {s.address}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${s.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{s.status === 'active' ? 'Đang sử dụng' : 'Tạm ngưng'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(s)} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={18} /></button>
                            <button onClick={(e) => handleDelete(s.id, e)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'classrooms' ? (
                    classrooms.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase())).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-blue-800 text-sm">{c.code}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <School size={16} className="text-blue-500" />
                            <span className="text-sm font-bold text-slate-900">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold"><Users size={14} className="text-slate-400" /> {c.capacity}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500"><Home size={12} className="text-slate-400" /> {c.building || '--'}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={18} /></button>
                            <button onClick={(e) => handleDelete(c.id, e)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'teachers' ? (
                    teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox"
                            checked={selectedIds.includes(t.id)}
                            onChange={() => toggleSelection(t.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-blue-800 text-sm">{t.code}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{t.name.substring(0, 1)}</div>
                            <span className="text-sm font-bold text-slate-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-[300px]">
                          <div className="flex flex-wrap gap-1">
                            {t.subjectIds?.map(sid => {
                              const sub = subjects.find(s => String(s.id) === String(sid) || String(s.documentId) === String(sid) || String(s.strapiId) === String(sid));
                              return <span key={sid} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100">{sub?.name}</span>
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500"><Phone size={12} /> {t.phone}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500"><Mail size={12} /> {t.email}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(t)} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={18} /></button>
                            <button onClick={(e) => handleDelete(t.id, e)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'subjects' ? (
                    subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group text-[11px] whitespace-nowrap">
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox"
                            checked={selectedIds.includes(sub.id)}
                            onChange={() => toggleSelection(sub.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-bold text-blue-800">{sub.code}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{sub.name}</td>
                        <td className="px-4 py-3 text-center text-slate-600 font-medium">{sub.sessions || 0}</td>
                        <td className="px-4 py-3 text-center text-blue-700 font-bold">{sub.totalHours || 0}h</td>
                        <td className="px-4 py-3 text-center text-slate-500">{sub.theoryHours || 0}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{sub.practiceHours || 0}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{sub.exerciseHours || 0}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{sub.examHours || 0}</td>
                        <td className="px-4 py-3 text-slate-400 italic max-w-[150px] truncate">{sub.notes || '--'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(sub)} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={16} /></button>
                            <button onClick={(e) => handleDelete(sub.id, e)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'users' ? (
                    users.filter(u => (u.username || u.email || '').toLowerCase().includes(searchTerm.toLowerCase())).map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-900 text-sm">{u.username}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">{u.role?.name || 'Public'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${!u.blocked ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{!u.blocked ? 'Đang hoạt động' : 'Đã khóa'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesView;