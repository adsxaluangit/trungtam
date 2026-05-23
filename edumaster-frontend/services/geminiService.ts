
import { GoogleGenAI } from "@google/genai";

export const generateClassSummary = async (classData: any, students: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Hãy viết một đoạn tóm tắt chuyên nghiệp về tình hình lớp học sau:
    Tên lớp: ${classData.name}
    Số lượng học viên: ${students.length}
    Trạng thái: ${classData.status}
    Hãy nêu bật sự cần thiết của việc đào tạo và kỳ vọng đầu ra cho doanh nghiệp. Trả lời bằng tiếng Việt.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Không thể khởi tạo tóm tắt AI tại thời điểm này.";
  }
};

export const suggestTeacherAssignments = async (teachers: any[], classes: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Gợi ý phân công giảng dạy tối ưu cho danh sách giảng viên: ${JSON.stringify(teachers.map(t => t.name))} và lớp học: ${JSON.stringify(classes.map(c => c.name))}. Dựa trên các yếu tố phổ biến trong quản lý giáo dục.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Gợi ý AI hiện không khả dụng.";
  }
};
