
import React, { useState, useEffect, useRef } from 'react';
import { LogOut, User as UserIcon, Bell, ChevronDown, Sparkles, HardDriveDownload, CheckCircle2, XCircle } from 'lucide-react';
import { NAVIGATION_ITEMS } from '../constants';
import { User, UserRole, NavItem } from '../types';
import { triggerBackup } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  currentUser: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePath, onNavigate, currentUser, onLogout }) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupToast, setBackupToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    setBackupToast(null);
    try {
      const result = await triggerBackup();
      if (result?.success) {
        setBackupToast({ type: 'success', message: result.message || `Backup thành công: ${result.filename}` });
      } else {
        setBackupToast({ type: 'error', message: result?.error || 'Backup thất bại. Vui lòng thử lại.' });
      }
    } catch (err: any) {
      setBackupToast({ type: 'error', message: err?.message || 'Lỗi kết nối khi thực hiện backup.' });
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupToast(null), 5000);
    }
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filteredNav = NAVIGATION_ITEMS.filter(item => item.roles.includes(currentUser.role));

  const isChildActive = (item: NavItem) => {
    return item.children?.some(child => child.path === activePath);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white h-16 shrink-0 flex items-center px-6 shadow-2xl z-[100] no-print border-b border-white/5">
        {/* Logo Section */}
        <div
          className="flex items-center gap-3 cursor-pointer mr-10 group"
          onClick={() => { setOpenDropdown(null); onNavigate('dashboard'); }}
        >
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-black text-xl shadow-lg group-hover:scale-105 transition-transform">E</div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight hidden lg:block leading-none">EduMaster</span>
            <span className="text-[10px] text-blue-400 font-black tracking-[0.2em] hidden lg:block uppercase">Professional</span>
          </div>
        </div>

        {/* Main Navigation - Horizontal */}
        <nav ref={dropdownRef} className="flex-1 flex items-center h-full gap-2">
          {filteredNav.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isActive = activePath === item.path || isChildActive(item);
            const isIconOnly = ['dashboard', 'admin'].includes(item.path);
            const isOpen = openDropdown === item.path;

            return (
              <div key={item.path} className="relative h-full flex items-center">
                <button
                  onClick={(e) => {
                    if (hasChildren) {
                      setOpenDropdown(isOpen ? null : item.path);
                    } else {
                      setOpenDropdown(null);
                      onNavigate(item.path);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 text-sm font-semibold whitespace-nowrap border ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-blue-500'
                    : isOpen
                      ? 'bg-slate-800 text-white border-slate-700 shadow-inner'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent'
                    }`}
                  title={isIconOnly ? item.label : undefined}
                >
                  <span className={`${isActive || isOpen ? 'text-white' : 'text-slate-500'}`}>
                    {React.cloneElement(item.icon, { size: 18 })}
                  </span>
                  {!isIconOnly && <span>{item.label}</span>}
                  {hasChildren && (
                    <ChevronDown
                      size={14}
                      className={`ml-1 transition-transform duration-500 ${isOpen ? 'rotate-180 text-blue-400' : 'text-slate-500'}`}
                    />
                  )}
                </button>

                {/* POPUP MENU - Styled as a floating panel */}
                {hasChildren && isOpen && (
                  <>
                    {/* Tiny arrow pointing up */}
                    <div className="absolute top-[calc(100%-10px)] left-6 w-4 h-4 bg-white rotate-45 z-[110] border-l border-t border-slate-200"></div>

                    <div className="absolute top-[calc(100%-2px)] left-0 min-w-[320px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 p-3 animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 z-[120]">
                      <div className="px-3 pt-2 pb-4 mb-2 border-b border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={12} className="text-blue-500" />
                          {item.label}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1">Vui lòng chọn nghiệp vụ để tiếp tục quản lý.</p>
                      </div>

                      <div className="grid gap-1">
                        {item.children?.map(child => (
                          <button
                            key={child.path}
                            onClick={() => {
                              onNavigate(child.path);
                              setOpenDropdown(null);
                            }}
                            className={`w-full group flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activePath === child.path
                              ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                              }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activePath === child.path
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                              }`}>
                              {React.cloneElement(child.icon, { size: 20 })}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className={`text-sm font-bold ${activePath === child.path ? 'text-blue-700' : 'text-slate-700 group-hover:text-blue-600'}`}>
                                {child.label}
                              </span>
                              <div className="text-[11px] text-slate-400 cursor-pointer hover:text-white transition-colors" title="Phiếu đăng ký" onClick={() => onNavigate('public-register')}>EduMaster Pro v1.0</div>
                              <span className="text-[10px] text-slate-400 font-medium">Truy cập phân hệ {child.label.toLowerCase()}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-50 px-3 flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 italic">Hỗ trợ bởi EduMaster AI</span>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-100"></div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Backup Button — only for ADMIN/MANAGER */}
          {[UserRole.ADMIN, UserRole.MANAGER].includes(currentUser.role) && (
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              title="Backup cơ sở dữ liệu"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 text-sm font-semibold whitespace-nowrap border ml-2 ${
                isBackingUp
                  ? 'bg-emerald-700 text-emerald-200 border-emerald-600 cursor-not-allowed'
                  : 'text-emerald-400 hover:text-white hover:bg-emerald-600 border-emerald-800 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20'
              }`}
            >
              {isBackingUp ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Đang backup...</span>
                </>
              ) : (
                <>
                  <HardDriveDownload size={16} />
                  <span>Backup DB</span>
                </>
              )}
            </button>
          )}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4 ml-6">
          <button className="p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl relative transition-all active:scale-95 shadow-inner">
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
          </button>

          <div className="h-8 w-[1px] bg-white/10 mx-1 hidden sm:block"></div>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-2 group relative">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-black text-white leading-none">{currentUser.username || currentUser.name || 'User'}</span>
              <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest mt-1 opacity-80">{currentUser.role || 'Guest'}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white flex items-center justify-center font-black text-sm border border-white/10 shadow-xl group-hover:border-blue-500 transition-all cursor-pointer">
              {(currentUser.username || currentUser.name || 'U').substring(0, 1)}
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all active:scale-90"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Backup Toast Notification */}
      {backupToast && (
        <div
          className={`fixed top-20 right-6 z-[200] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm no-print ${
            backupToast.type === 'success'
              ? 'bg-emerald-900/95 border-emerald-600 text-emerald-100'
              : 'bg-red-900/95 border-red-600 text-red-100'
          }`}
        >
          {backupToast.type === 'success'
            ? <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            : <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />}
          <div>
            <p className="font-black text-xs uppercase tracking-widest mb-1 opacity-70">
              {backupToast.type === 'success' ? '✓ Backup thành công' : '✗ Backup thất bại'}
            </p>
            <p className="leading-snug">{backupToast.message}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50 relative">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-8 py-3 text-[10px] text-slate-400 flex justify-between items-center no-print shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <p className="font-bold">© 2026 EduMaster Pro</p>
          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
          <p>Phiên bản 4.0.2</p>
        </div>
        <div className="flex gap-6 font-bold uppercase tracking-tighter">
          <span onClick={() => alert('Nguyễn Thành Dương\nĐiện thoại: 0916.883.118')} className="hover:text-blue-500 cursor-pointer transition-colors">Hỗ trợ kỹ thuật</span>
          <span className="hover:text-blue-500 cursor-pointer transition-colors">Hướng dẫn sử dụng</span>
          <span className="hover:text-blue-500 cursor-pointer transition-colors text-slate-300">Điều khoản</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
