
import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Award, ScrollText, Loader2 } from 'lucide-react';
import { fetchCategory, updateCategory, COLLECTIONS } from '../services/api';

const PrintTemplatesView: React.FC = () => {
    const [editingTemplate, setEditingTemplate] = useState<'decision' | 'recognition' | 'certificate_list' | null>(null);
    const [templateData, setTemplateData] = useState<any>({});
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const data = await fetchCategory(COLLECTIONS.PRINT_TEMPLATES);
            setTemplates(data || []);
        } catch (err) {
            console.error("Failed to load templates:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const startEditing = (type: 'decision' | 'recognition' | 'certificate_list') => {
        const found = templates.find(t => t.type === type);
        if (found) {
            setTemplateData(found.content || {});
            setEditingTemplate(type);
        } else {
            alert("Không tìm thấy mẫu trong hệ thống. Vui lòng liên hệ quản trị viên.");
        }
    };

    const handleSave = async () => {
        if (!editingTemplate) return;

        const found = templates.find(t => t.type === editingTemplate);
        if (!found) return;

        try {
            setLoading(true);
            await updateCategory(COLLECTIONS.PRINT_TEMPLATES, found.id, {
                content: templateData,
                name: found.name // Keep existing name
            });

            await loadTemplates(); // Refresh local state
            setEditingTemplate(null);
            alert('Đã lưu mẫu in lên Server thành công!');
        } catch (err) {
            console.error("Failed to save template:", err);
            alert("Lưu thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const renderEditor = () => (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setEditingTemplate(null)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                    <h2 className="font-bold text-slate-800">
                        Chỉnh sửa mẫu: {
                            editingTemplate === 'decision' ? 'Quyết định mở lớp' :
                                editingTemplate === 'recognition' ? 'Quyết định Công nhận' :
                                    'DS đề nghị Cấp GCN'
                        }
                    </h2>
                </div>
                <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-blue-700 flex items-center gap-2">
                    <FileText size={18} /> Lưu mẫu
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Editor Panel */}
                <div className="w-1/3 bg-white border-r border-slate-200 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-500">Tiêu đề & Quốc hiệu</label>
                        <input value={templateData.headerLine1} onChange={e => setTemplateData({ ...templateData, headerLine1: e.target.value })} className="w-full border p-2 rounded text-sm" />
                        <input value={templateData.headerLine2} onChange={e => setTemplateData({ ...templateData, headerLine2: e.target.value })} className="w-full border p-2 rounded text-sm" />
                        <input value={templateData.motto} onChange={e => setTemplateData({ ...templateData, motto: e.target.value })} className="w-full border p-2 rounded text-sm" />
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-500">Nội dung chính</label>
                        <input value={templateData.title} onChange={e => setTemplateData({ ...templateData, title: e.target.value })} className="w-full border p-2 rounded text-sm font-bold" placeholder="QUYẾT ĐỊNH" />
                        <input value={templateData.subtitle} onChange={e => setTemplateData({ ...templateData, subtitle: e.target.value })} className="w-full border p-2 rounded text-sm" placeholder="Trích yếu..." />
                        <textarea value={templateData.preamble} onChange={e => setTemplateData({ ...templateData, preamble: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[150px]" placeholder="Các căn cứ..." />
                        <p className="text-[10px] text-slate-400">Xuống dòng để tạo đoạn mới</p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-500">Người ký</label>
                        <textarea value={templateData.authority} onChange={e => setTemplateData({ ...templateData, authority: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[60px]" placeholder="Thẩm quyền..." />
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-500">Các Điều khoản / Nội dung</label>
                        {editingTemplate !== 'certificate_list' ? (
                            <>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold">Điều 1:</span>
                                    <textarea value={templateData.article1} onChange={e => setTemplateData({ ...templateData, article1: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[80px]" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold">Điều 2:</span>
                                    <textarea value={templateData.article2} onChange={e => setTemplateData({ ...templateData, article2: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[80px]" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold">Điều 3:</span>
                                    <textarea value={templateData.article3} onChange={e => setTemplateData({ ...templateData, article3: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[80px]" />
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500 italic">Mẫu danh sách sử dụng dữ liệu từ bảng, không có các điều khoản tùy chỉnh.</p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-500">Người ký</label>
                        {editingTemplate === 'certificate_list' && (
                            <div className="space-y-3 mb-4 border-b pb-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold">Chức danh (Trái):</span>
                                    <textarea value={templateData.signerTitle2 || ''} onChange={e => setTemplateData({ ...templateData, signerTitle2: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[60px]" placeholder="KT. HIỆU TRƯỞNG..." />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold">Họ tên (Trái):</span>
                                    <input value={templateData.signerName2 || ''} onChange={e => setTemplateData({ ...templateData, signerName2: e.target.value })} className="w-full border p-2 rounded text-sm" />
                                </div>
                            </div>
                        )}
                        <div className="space-y-1">
                            <span className="text-xs font-bold">Chức danh {editingTemplate === 'certificate_list' ? '(Phải)' : ''}:</span>
                            <textarea value={templateData.signerTitle} onChange={e => setTemplateData({ ...templateData, signerTitle: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[60px]" placeholder="HIỆU TRƯỞNG..." />
                        </div>
                        {editingTemplate !== 'certificate_list' && (
                            <div className="space-y-1">
                                <span className="text-xs font-bold">Nơi nhận:</span>
                                <textarea value={templateData.recipients || '- Như Điều 3;\n- Lưu: VT, ĐT.'} onChange={e => setTemplateData({ ...templateData, recipients: e.target.value })} className="w-full border p-2 rounded text-sm min-h-[60px]" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <span className="text-xs font-bold">Họ tên {editingTemplate === 'certificate_list' ? '(Phải)' : ''}:</span>
                            <input value={templateData.signerName} onChange={e => setTemplateData({ ...templateData, signerName: e.target.value })} className="w-full border p-2 rounded text-sm" />
                        </div>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="flex-1 bg-slate-100 overflow-y-auto p-8 flex justify-center">
                    <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] p-[2cm_1.5cm_2cm_2cm] text-black font-serif text-[13pt] leading-relaxed relative selection:bg-blue-100">
                        <style>{`
                            .preview-content { font-family: 'Times New Roman', serif; line-height: 1.5; }
                        `}</style>
                        <div className="preview-content">
                            {/* HEADER */}
                            <div className="flex justify-between mb-6">
                                <div className={`text-center w-[50%] ${editingTemplate === 'certificate_list' ? 'flex flex-col items-center' : ''}`}>
                                    <p className={`text-[11pt] uppercase ${editingTemplate === 'certificate_list' ? 'font-bold' : ''}`}>{templateData.headerLine1}</p>
                                    <p className="font-bold text-[11pt] uppercase">{templateData.headerLine2}</p>
                                    {templateData.headerLine3 && <p className="font-bold text-[11pt] border-b border-black inline-block pb-1 mb-1 uppercase">{templateData.headerLine3}</p>}
                                    {editingTemplate !== 'certificate_list' && <p className="mt-1">Số: .../QĐ-...</p>}
                                </div>
                                <div className="text-center w-[50%]">
                                    <p className="font-bold text-[11pt] uppercase">{templateData.nation}</p>
                                    <p className="font-bold text-[12pt] border-b border-black inline-block pb-1 mb-1">{templateData.motto}</p>
                                    <p className="italic mt-1">Hải Phòng, ngày ... tháng ... năm ...</p>
                                </div>
                            </div>

                            {/* TITLE */}
                            <div className="text-center mb-6">
                                <h1 className="font-bold text-[16pt] uppercase mb-1">{templateData.title}</h1>
                                <p className="font-bold text-[13pt] uppercase">{templateData.subtitle}</p>
                                {editingTemplate === 'certificate_list' && (
                                    <div className="mt-2 text-[12pt] font-bold whitespace-pre-line">
                                        {templateData.preamble}
                                    </div>
                                )}
                            </div>

                            {/* AUTHORITY */}
                            {templateData.authority && (
                                <div className="text-center mb-4">
                                    <h2 className="font-bold text-[14pt] uppercase">{templateData.authority}</h2>
                                </div>
                            )}

                            {/* BODY CONTENT - Articles or Table */}
                            {editingTemplate !== 'certificate_list' ? (
                                <>
                                    {/* PREAMBLE */}
                                    <div className="text-justify mb-4 space-y-1 indent-8">
                                        {templateData.preamble?.split('\n').map((line: string, i: number) => (
                                            <p key={i}><i>{line}</i></p>
                                        ))}
                                    </div>

                                    {/* ARTICLES */}
                                    <div className="mb-8">
                                        <h3 className="text-center font-bold text-[14pt] uppercase mb-4">QUYẾT ĐỊNH:</h3>
                                        <p className="text-justify mb-2 indent-8">
                                            <span className="font-bold">Điều 1.</span> {templateData.article1}
                                        </p>
                                        <p className="text-justify mb-2 indent-8">
                                            <span className="font-bold">Điều 2.</span> {templateData.article2}
                                        </p>
                                        <p className="text-justify mb-2 indent-8">
                                            <span className="font-bold">Điều 3.</span> {templateData.article3}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="mb-8 overflow-x-auto">
                                    <table className="w-full border-collapse border border-black text-[10pt]">
                                        <thead>
                                            <tr>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[40px]">STT</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle">HỌ VÀ TÊN</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[90px]">NGÀY SINH</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[100px]">SỐ CMND / CCCD</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle">NƠI SINH</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[45px]">Điểm ATSM</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[45px]">Điểm PCCC</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[45px]">Điểm KT Cứu sinh</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[50px]">Điểm Sơ cứu y tế cơ bản</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[45px]">Điểm NTAN TB</th>
                                                <th className="border border-black p-1 text-center font-bold align-middle w-[60px]">GHI CHÚ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({ length: 12 }).map((_, i) => (
                                                <tr key={i}>
                                                    <td className="border border-black p-1 text-center align-middle">{i + 1}</td>
                                                    <td className="border border-black p-1 align-middle">
                                                        {['Nguyễn Văn Điển', 'Nguyễn Văn Đức', 'Nguyễn Nhuận Dụng', 'Trần Văn Giáp', 'Vũ Việt Hoàng'][i % 5]}
                                                    </td>
                                                    <td className="border border-black p-1 text-center align-middle">
                                                        {['03/03/1975', '02/10/2006', '13/11/2005'][i % 3]}
                                                    </td>
                                                    <td className="border border-black p-1 text-center align-middle">
                                                        031075016337
                                                    </td>
                                                    <td className="border border-black p-1 text-center align-middle">
                                                        {['Hải Phòng', 'Hưng Yên', 'Nghệ An', 'Ninh Bình'][i % 4]}
                                                    </td>
                                                    <td className="border border-black p-1 text-center align-middle">{8 - (i % 2)}</td>
                                                    <td className="border border-black p-1 text-center align-middle">{8}</td>
                                                    <td className="border border-black p-1 text-center align-middle">{8}</td>
                                                    <td className="border border-black p-1 text-center align-middle">{8}</td>
                                                    <td className="border border-black p-1 text-center align-middle">{8 - (i % 3 === 0 ? 1 : 0)}</td>
                                                    <td className="border border-black p-1 text-center align-middle"></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* FOOTER */}
                            <div className="flex justify-between items-start mt-8">
                                <div className="w-[50%] text-center">
                                    {editingTemplate === 'certificate_list' ? (
                                        <>
                                            <p className="font-bold text-[12pt] uppercase whitespace-pre-line mb-16 relative top-2">{templateData.signerTitle2}</p>
                                            <p className="font-bold text-[13pt] uppercase">{templateData.signerName2}</p>
                                        </>
                                    ) : (
                                        <div className="text-left pl-8">
                                            <p className="font-bold italic text-[12pt] mb-1">Nơi nhận:</p>
                                            <div className="text-[11pt] italic whitespace-pre-line pl-1">
                                                {templateData.recipients}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="w-[50%] text-center">
                                    <p className="font-bold text-[13pt] uppercase whitespace-pre-line mb-16">{templateData.signerTitle}</p>
                                    <p className="font-bold text-[13pt] uppercase">{templateData.signerName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (editingTemplate) return renderEditor();

    return (
        <div className="flex flex-col h-full bg-white text-slate-700 animate-in fade-in duration-500">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Printer className="text-blue-600" />
                    Quản lý Mẫu In
                </h2>
                <p className="text-sm text-slate-500 mt-1">Chọn mẫu văn bản để xem trước hoặc in ấn</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Button 1: Quyết định mở lớp */}
                <button
                    onClick={() => startEditing('decision')}
                    className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                >
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform">
                        <FileText size={32} />
                    </div>
                    <span className="font-bold text-lg text-slate-700 group-hover:text-blue-700">Quyết định mở lớp</span>
                    <span className="text-xs text-slate-400 mt-2">Mẫu quyết định tổ chức lớp học</span>
                </button>

                {/* Button 2: Quyết định Công nhận */}
                <button
                    onClick={() => startEditing('recognition')}
                    className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-orange-400 hover:bg-orange-50/30 transition-all group"
                >
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600 group-hover:scale-110 transition-transform">
                        <Award size={32} />
                    </div>
                    <span className="font-bold text-lg text-slate-700 group-hover:text-orange-700">Quyết định Công nhận</span>
                    <span className="text-xs text-slate-400 mt-2">Mẫu công nhận tốt nghiệp/hoàn thành</span>
                </button>

                {/* Button 3: DS đề nghị Cấp GCN */}
                <button
                    onClick={() => startEditing('certificate_list')}
                    className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group"
                >
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 group-hover:scale-110 transition-transform">
                        <ScrollText size={32} />
                    </div>
                    <span className="font-bold text-lg text-slate-700 group-hover:text-emerald-700">DS đề nghị Cấp GCN</span>
                    <span className="text-xs text-slate-400 mt-2">Mẫu danh sách đề nghị cấp GCN</span>
                </button>
            </div>
        </div>
    );
};

export default PrintTemplatesView;
