
import React from 'react';
import {
  Users,
  Globe,
  Building2,
  PieChart,
  GraduationCap,
  LayoutDashboard,
  Settings,
  FileText,
  BookOpen,
  CalendarCheck,
  Printer,
  UserRound,
  BookMarked,
  Home,
  School,
  Award,
  ClipboardCheck,
  FilePenLine,
  Search
} from 'lucide-react';
import { UserRole, NavItem } from './types';

export const NAVIGATION_ITEMS: NavItem[] = [
  { label: 'Bảng điều khiển', path: 'dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER] },
  { label: 'Quản trị hệ thống', path: 'admin', icon: <Settings size={20} />, roles: [UserRole.ADMIN] },

  { label: 'Danh mục', path: 'categories', icon: <BookOpen size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { label: 'Quản lý học viên', path: 'students', icon: <UserRound size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER] },

  {
    label: 'Mở lớp',
    path: 'decisions_group',
    icon: <FileText size={20} />,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    children: [
      { label: 'Quyết định mở lớp', path: 'decisions', icon: <FileText size={18} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { label: 'Phân công giảng dạy', path: 'assignments', icon: <CalendarCheck size={18} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { label: 'Duyệt thi', path: 'exam-approval', icon: <ClipboardCheck size={18} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { label: 'Nhập điểm', path: 'grade-entry', icon: <FilePenLine size={18} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { label: 'Quyết định công nhận', path: 'recognition-decisions', icon: <Award size={18} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    ]
  },
  { label: 'Thống kê', path: 'statistics', icon: <PieChart size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { label: 'Tra cứu', path: 'lookup', icon: <Search size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER] },
];

export const CATEGORY_TYPES = [
  { id: 'users', label: 'Người dùng', icon: <Users size={18} /> },
  { id: 'nations', label: 'Quốc gia', icon: <Globe size={18} /> },

  { id: 'suppliers', label: 'Dãy Nhà', icon: <Home size={18} /> },
  { id: 'classrooms', label: 'Phòng học', icon: <School size={18} /> },
  { id: 'subjects', label: 'Môn học', icon: <BookMarked size={18} /> },

  { id: 'teachers', label: 'Giảng viên', icon: <GraduationCap size={18} /> },
  { id: 'classes', label: 'Lớp học', icon: <BookOpen size={18} /> },
  { id: 'print_templates', label: 'Mẫu In', icon: <Printer size={18} /> },
];
