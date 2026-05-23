
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEACHER = 'TEACHER',
  GUEST = 'GUEST'
}

export interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface CategoryItem {
  id: string;
  strapiId?: number;
  name: string;
  code?: string;
  description?: string;
}

// Added Subject interface to resolve import error in AssignmentsView.tsx
export interface Subject {
  id: string;
  strapiId?: number;
  code: string;
  name: string;
  sessions?: number;
  totalHours?: number;
  theoryHours?: number;
  practiceHours?: number;
  exerciseHours?: number;
  examHours?: number;
  hasTheory?: boolean;
  hasPractice?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface Teacher extends CategoryItem {
  specialization: string;
  phone: string;
  email: string;
  subjectIds?: (string | number)[]; // Danh sách các ID môn học mà giảng viên có thể dạy (numeric for Strapi v5)
}

export interface ClassRoom extends CategoryItem {
  startDate: string;
  endDate: string;
  status: 'OPENING' | 'CLOSED' | 'PENDING';
  studentCount: number;
  subjectIds?: (string | number)[]; // Danh sách các môn học thuộc chương trình của lớp (numeric for Strapi v5)
  subjects?: any[]; // Raw data from Strapi populate
  notes?: string;
  createdAt?: string;
}

export interface Assignment {
  id: string;
  classId: string;
  teacherId: string;
  subject: string;
  hours: number;
}

export interface Decision {
  id: string;
  type: 'OPEN_CLASS' | 'RECOGNITION';
  number: string;
  date: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'APPROVED';
}

export interface Student {
  id: string;
  strapiId?: number;
  stt: number;
  group: string;
  classCode: string;
  className: string;
  classId?: string;
  cardNumber: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  dob?: string;
  pob?: string;
  ethnicity?: string;
  nationality?: string;
  phone?: string;
  idNumber?: string;
  company?: string;
  address?: string;
  score?: string;
  rank?: string;
  photo?: string | null;
  isApproved?: boolean;
  documents?: { id: string; name: string; url: string; date: string; type: string }[];
  status?: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: any;
  roles: UserRole[];
  children?: NavItem[];
}