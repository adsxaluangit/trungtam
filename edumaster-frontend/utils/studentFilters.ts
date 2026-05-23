
import { Student } from '../types';

/**
 * Filter rules for student validity across the system.
 * 
 * Rules:
 * 1. Student must belong to the specific class (group or className matches).
 * 2. Student must NOT be in another Class Opening Decision (concurrent enrollment).
 * 3. Student must NOT be in a Recognition Decision within the last 5 years.
 */

export interface ValidationContext {
    currentDecisionId?: string; // To exclude current decision from "other decisions" check
    currentClassName: string;
    processType: 'DECISION' | 'ASSIGNMENT' | 'APPROVAL' | 'GRADE' | 'RECOGNITION';
}

export interface SystemData {
    allDecisions: any[]; // List of Class Opening Decisions
    allRecognitions: any[]; // List of Recognition Decisions
}

export const isStudentValid = (
    student: Student | { studentCode: string, group?: string, className?: string },
    context: ValidationContext,
    data: SystemData
): boolean => {
    const studentCode = student.studentCode.trim().toLowerCase();
    const targetClass = context.currentClassName.trim().toLowerCase();

    // 1. Class Match Rule
    // For some views, student might generic object, try to match robustly
    const sGroup = (student.group || '').trim().toLowerCase();
    const sClass = (student.className || '').trim().toLowerCase();

    // If we are strictly filtering for a class, they must match
    if (targetClass && sGroup !== targetClass && sClass !== targetClass) {
        return false;
    }

    // 2. Not Recognized Recently (< 5 Years) Rule
    // Check if student exists in any recognition decision from the last 5 years
    // irrespective of class? Or for THIS class type?
    // User said: "nếu học viên đó đã được công nhận trong vòng 5 năm thì cũng không cho vào"
    // Usually implies "recognized for THIS training". But to be safe and strict as requested:
    // We check if they were recognized in *any* class? 
    // "mã HV trùng... lấy từ danh sách...". 
    // Let's assume strict rule: If recognized recently, they shouldn't be studying again.
    const isRecognizedRecently = data.allRecognitions?.some((dec: any) => {
        const signedDate = new Date(dec.signedDate || dec.date); // Handle disparate field names
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - signedDate.getTime());
        const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);

        if (diffYears >= 5) return false;

        // Check if student is in this decision
        const inList = dec.students?.some((ds: any) =>
            (ds.studentCode || '').trim().toLowerCase() === studentCode ||
            (ds.cardNumber || '').trim().toLowerCase() === studentCode // Fallback check
        );
        return inList;
    });

    if (isRecognizedRecently) return false;

    // 3. Not In Other Active Decisions Rule
    // Check if student is in any OTHER Class Opening Decision
    // We must exclude the current decision (decisionId) from this check
    const isInOtherDecision = data.allDecisions?.some((dec: any) => {
        if (context.currentDecisionId && dec.id === context.currentDecisionId) return false;

        // Check if student is in this decision
        // DecisionsView stores students in `students` array
        const inList = dec.students?.some((ds: any) =>
            (ds.studentCode || '').trim().toLowerCase() === studentCode
        );
        return inList;
    });

    if (isInOtherDecision) return false;

    return true;
};

export const filterStrictStudentList = (
    students: any[], // Can be Student[] or DecisionDetail[]
    context: ValidationContext,
    data: SystemData
): any[] => {
    return students.filter(s => isStudentValid(s, context, data));
};
