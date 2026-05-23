import React, { useState } from 'react';
import { LogIn, User, Lock } from 'lucide-react';

interface LoginViewProps {
    onLoginSuccess: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setLoading(true);

        if (!username || !password) {
            setLoginError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
            return;
        }

        try {
            const response = await fetch(`${process.env.API_URL || '/api'}/auth/login-official`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: username, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData?.error?.message || 'Đăng nhập thất bại!');
            }

            const data = await response.json();
            
            // Store JWT and User Info
            if (data.jwt) {
                localStorage.setItem('jwt_token', data.jwt);
                
                // Map Strapi role name → frontend UserRole
                const strapiRole = (data.user?.role || '').toLowerCase();
                let frontendRole = 'ADMIN'; // Default: grant full access for authenticated users
                if (strapiRole.includes('manager')) frontendRole = 'MANAGER';
                else if (strapiRole.includes('teacher')) frontendRole = 'TEACHER';

                const userToStore = {
                    id: String(data.user?.id || ''),
                    username: data.user?.username || data.user?.name || 'User',
                    name: data.user?.username || data.user?.name || 'User',
                    email: data.user?.email || '',
                    role: frontendRole,
                };
                localStorage.setItem('user', JSON.stringify(userToStore));
                onLoginSuccess();
            } else {
                throw new Error('Không nhận được mã xác thực!');
            }

        } catch (error: any) {
            console.error('Login failed:', error);
            setLoginError(error.message || 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-blue-600 p-6 text-white text-center relative">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <LogIn size={32} />
                    </div>
                    <h2 className="text-2xl font-bold">Đăng Nhập Quản Trị</h2>
                    <p className="text-blue-100 text-sm mt-1">Hệ thống quản lý EduMasterPro</p>
                </div>

                <form onSubmit={handleLogin} className="p-8 space-y-6">
                    {loginError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            {loginError}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Tên đăng nhập</label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="Nhập tên đăng nhập"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Mật khẩu</label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="Nhập mật khẩu"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5'}`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <LogIn size={20} />
                            )}
                            {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <a href="/" className="text-sm text-slate-500 hover:text-blue-600 hover:underline">&larr; Quay lại trang chủ</a>
                    </div>
                </form>
            </div>
            
            <div className="text-center mt-8 text-slate-400 text-sm">
                &copy; 2026 Cao đẳng Hàng hải và Đường thủy I All rights reserved.
            </div>
        </div>
    );
};

export default LoginView;
