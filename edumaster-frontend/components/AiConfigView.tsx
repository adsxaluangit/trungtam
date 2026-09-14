import React, { useState, useEffect } from 'react';
import { Sparkles, Key, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, ExternalLink, ShieldCheck, RefreshCw, Cpu, Server, Globe } from 'lucide-react';

type ProviderType = 'gemini' | 'nano_banana';

const AiConfigView: React.FC = () => {
  const [provider, setProvider] = useState<ProviderType>('gemini');
  
  // Gemini fields
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [geminiMaskedKey, setGeminiMaskedKey] = useState('');
  
  // Nano Banana fields
  const [nanoBananaApiKeyInput, setNanoBananaApiKeyInput] = useState('');
  const [nanoBananaMaskedKey, setNanoBananaMaskedKey] = useState('');
  const [nanoBananaBaseUrl, setNanoBananaBaseUrl] = useState('https://api.nanobananaapi.ai/api/v1');
  const [nanoBananaModel, setNanoBananaModel] = useState('NanoBanana 2');

  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('jwt_token') || '';
      const res = await fetch('/api/system-config/ai-config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider || 'gemini');
        setIsConfigured(data.isConfigured || false);
        setGeminiMaskedKey(data.geminiMaskedKey || '');
        setNanoBananaMaskedKey(data.nanoBananaMaskedKey || '');
        if (data.nanoBananaBaseUrl) setNanoBananaBaseUrl(data.nanoBananaBaseUrl);
        if (data.nanoBananaModel) setNanoBananaModel(data.nanoBananaModel);
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (provider === 'gemini' && !geminiApiKeyInput.trim() && !geminiMaskedKey) {
      alert('Vui lòng nhập Google Gemini API Key!');
      return;
    }
    if (provider === 'nano_banana' && !nanoBananaApiKeyInput.trim() && !nanoBananaMaskedKey) {
      alert('Vui lòng nhập Nano Banana API Key!');
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('jwt_token') || '';
      const res = await fetch('/api/system-config/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          geminiApiKey: geminiApiKeyInput.trim() || undefined,
          nanoBananaApiKey: nanoBananaApiKeyInput.trim() || undefined,
          nanoBananaBaseUrl: nanoBananaBaseUrl.trim(),
          nanoBananaModel: nanoBananaModel.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsConfigured(data.isConfigured);
        setGeminiMaskedKey(data.geminiMaskedKey || '');
        setNanoBananaMaskedKey(data.nanoBananaMaskedKey || '');
        setGeminiApiKeyInput('');
        setNanoBananaApiKeyInput('');
        alert(`Đã lưu cấu hình nhà cung cấp AI (${provider === 'gemini' ? 'Google Gemini' : 'Nano Banana API'}) thành công!`);
      } else {
        alert(data.error?.message || data.message || 'Lỗi khi lưu cấu hình AI');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ khi lưu cấu hình AI');
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('jwt_token') || '';
      const res = await fetch('/api/system-config/test-ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          geminiApiKey: geminiApiKeyInput.trim() || undefined,
          nanoBananaApiKey: nanoBananaApiKeyInput.trim() || undefined,
          nanoBananaBaseUrl: nanoBananaBaseUrl.trim(),
          nanoBananaModel: nanoBananaModel.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message + (data.reply ? ` (${data.reply})` : '')
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Kết nối thất bại'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Lỗi kết nối kiểm tra: ' + (err.message || String(err))
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
            <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Quản lý Cấu hình Nhà cung cấp AI (Multi-AI Provider)</h2>
            <p className="text-blue-200/80 text-sm mt-1 max-w-2xl leading-relaxed">
              Tùy chọn kết nối linh hoạt giữa **Google Gemini AI** và **Nano Banana API** (nanobananaapi.ai) để tự động xử lý trang phục ảnh thẻ, tách nền và chuẩn hóa hồ sơ học viên.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          1. Chọn Nhà cung cấp AI (Provider) <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Provider 1: Google Gemini */}
          <div
            onClick={() => setProvider('gemini')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-4 ${
              provider === 'gemini'
                ? 'bg-blue-50/80 border-blue-600 shadow-md shadow-blue-500/10'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <div className={`p-3 rounded-xl ${provider === 'gemini' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Sparkles size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Google Gemini AI</h4>
                {provider === 'gemini' && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />}
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Sử dụng mô hình `gemini-2.5-flash-image` tốc độ cao, xử lý ảnh sắc nét.
              </p>
              {geminiMaskedKey ? (
                <span className="inline-block mt-2 text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  Key: {geminiMaskedKey}
                </span>
              ) : (
                <span className="inline-block mt-2 text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Chưa cài Key
                </span>
              )}
            </div>
          </div>

          {/* Provider 2: Nano Banana API */}
          <div
            onClick={() => setProvider('nano_banana')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex items-start gap-4 ${
              provider === 'nano_banana'
                ? 'bg-indigo-50/80 border-indigo-600 shadow-md shadow-indigo-500/10'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <div className={`p-3 rounded-xl ${provider === 'nano_banana' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Cpu size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Nano Banana API 🍌</h4>
                {provider === 'nano_banana' && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />}
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Dịch vụ NanoBananaAPI.ai - Tiết kiệm chi phí & xử lý ảnh chất lượng cao.
              </p>
              {nanoBananaMaskedKey ? (
                <span className="inline-block mt-2 text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  Key: {nanoBananaMaskedKey}
                </span>
              ) : (
                <span className="inline-block mt-2 text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Chưa cài Key
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current System Status Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">Trạng thái Cấu hình Đang Sử Dụng</h3>
          </div>
          <button
            onClick={fetchConfig}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition-colors"
            title="Tải lại trạng thái"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 py-4 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Đang kiểm tra cấu hình...</span>
          </div>
        ) : isConfigured ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-900 text-sm">
                  Đang kích hoạt: <span className="uppercase font-extrabold text-emerald-950">{provider === 'gemini' ? 'Google Gemini AI' : 'Nano Banana API'}</span>
                </p>
                <p className="text-emerald-700 text-xs mt-0.5 font-mono">
                  Mã Key: <span className="font-bold bg-white/60 px-2 py-0.5 rounded border border-emerald-200">{provider === 'gemini' ? geminiMaskedKey : nanoBananaMaskedKey}</span>
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-sm">
              Đang hoạt động
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Chưa cấu hình API Key cho nhà cung cấp hiện tại</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Vui lòng nhập API Key bên dưới để sẵn sàng sử dụng tính năng xử lý ảnh thẻ AI.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded-full shadow-sm">
              Cần cấu hình
            </span>
          </div>
        )}
      </div>

      {/* Dynamic Input Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Key className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-base">
            2. Điền Thông số API cho {provider === 'gemini' ? 'Google Gemini' : 'Nano Banana API'}
          </h3>
        </div>

        {/* Gemini Form Controls */}
        {provider === 'gemini' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Google Gemini API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={geminiApiKeyInput}
                  onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                  placeholder={geminiMaskedKey ? `Hiện tại: ${geminiMaskedKey} (Để trống nếu không đổi)` : 'Dán Gemini API Key vào đây (VD: AIzaSyD...)'}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all pr-12 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nano Banana Form Controls */}
        {provider === 'nano_banana' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Nano Banana API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={nanoBananaApiKeyInput}
                  onChange={(e) => setNanoBananaApiKeyInput(e.target.value)}
                  placeholder={nanoBananaMaskedKey ? `Hiện tại: ${nanoBananaMaskedKey} (Để trống nếu không đổi)` : 'Dán Nano Banana API Key từ nanobananaapi.ai/api-key vào đây...'}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all pr-12 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                  <Globe size={14} /> Base Endpoint URL
                </label>
                <input
                  type="text"
                  value={nanoBananaBaseUrl}
                  onChange={(e) => setNanoBananaBaseUrl(e.target.value)}
                  placeholder="https://api.nanobananaapi.ai/api/v1"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-xs font-mono outline-none transition-all text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                  <Server size={14} /> Tên mô hình (Model Name)
                </label>
                <input
                  type="text"
                  value={nanoBananaModel}
                  onChange={(e) => setNanoBananaModel(e.target.value)}
                  placeholder="NanoBanana 2"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-xs font-mono outline-none transition-all text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Test Connection Alert */}
        {testResult && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {testResult.success ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
            <div className="text-sm font-medium">
              {testResult.message}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={testing}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all flex items-center gap-2 border border-slate-200 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
            <span>Kiểm tra kết nối AI</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>Lưu cấu hình ({provider === 'gemini' ? 'Gemini' : 'Nano Banana'})</span>
          </button>
        </div>
      </form>

      {/* Guide Card */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-3">
        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-blue-600" />
          Hướng dẫn tích hợp:
        </h4>
        <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 leading-relaxed pl-1">
          <li><strong>Google Gemini:</strong> Lấy key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">aistudio.google.com</a>. Thích hợp cho xử lý ảnh thẻ mặc định.</li>
          <li><strong>Nano Banana API:</strong> Lấy API Key tại <a href="https://nanobananaapi.ai/api-key" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">nanobananaapi.ai/api-key</a>. Base URL mặc định là <code>https://api.nanobananaapi.ai/api/v1</code>. Hệ thống sẽ tự động khởi tạo tác vụ và tải ảnh kết quả về.</li>
        </ul>
      </div>
    </div>
  );
};

export default AiConfigView;
