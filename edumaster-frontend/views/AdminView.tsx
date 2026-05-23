
import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Key, Mail, X, Check, Loader2, RefreshCcw, ServerCrash, Plus, Trash2 } from 'lucide-react';
import { fetchUsers, updateUser, checkBackendConnection, createUser, fetchRoles, deleteUser } from '../services/api';
import { UserRole } from '../types';

const PERMISSIONS_LIST = [
  { id: 'view_dashboard', label: 'Xem Thống kê' },
  { id: 'manage_users', label: 'Quản lý Người dùng' },
  { id: 'manage_students', label: 'Quản lý Học viên' },
  { id: 'manage_classes', label: 'Quản lý Lớp học' },
  { id: 'manage_decisions', label: 'Quản lý Quyết định' },
  { id: 'manage_grades', label: 'Quản lý Điểm số' },
  { id: 'exam_approval', label: 'Duyệt thi & In ấn' },
];

const DEFAULT_PERMISSIONS = {
  [UserRole.ADMIN]: PERMISSIONS_LIST.map(p => p.id),
  [UserRole.MANAGER]: ['view_dashboard', 'manage_students', 'manage_classes', 'manage_decisions', 'manage_grades', 'exam_approval'],
  [UserRole.TEACHER]: ['view_dashboard', 'manage_grades']
};

const AdminView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check connection first
      const isConnected = await checkBackendConnection();
      if (!isConnected) {
        throw new Error('CONNECTION_REFUSED');
      }

      const data = await fetchUsers();

      // Transform Strapi data to match our frontend interface
      const formattedUsers = Array.isArray(data) ? data.map((u: any) => ({
        id: u.id,
        name: u.username || u.email,
        email: u.email,
        role: mapStrapiRoleToUserRole(u.role?.name),
        permissions: u.permissions || [], // Lấy quyền từ backend
        status: u.blocked ? 'Inactive' : 'Active',
        originalRole: u.role // Keep original role object for updates if needed
      })) : [];

      setUsers(formattedUsers);
    } catch (err: any) {
      console.error('Failed to load users', err);

      let errorMsg = 'Đã xảy ra lỗi khi tải dữ liệu.';
      if (err.message === 'CONNECTION_REFUSED' || err.message?.includes('Failed to fetch')) {
        errorMsg = 'Không thể kết nối đến Server Backend (Port 1337). Vui lòng kiểm tra server đã chạy chưa.';
      } else if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        errorMsg = 'Lỗi quyền truy cập (403): Vui lòng kiểm tra quyền "Public" trong Strapi Admin.';
      } else {
        errorMsg = `Lỗi: ${err.message || 'Không xác định'}`;
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    fetchRoles().then(roles => {
      if (roles && Array.isArray(roles)) {
        setAvailableRoles(roles);
      } else if (roles?.roles) {
        setAvailableRoles(roles.roles);
      }
    });
  }, []);

  const mapStrapiRoleToUserRole = (roleName: string): UserRole => {
    const normalized = roleName?.toUpperCase() || '';
    if (normalized.includes('ADMIN')) return UserRole.ADMIN;
    if (normalized.includes('MANAGER') || normalized.includes('ĐÀO TẠO')) return UserRole.MANAGER;
    return UserRole.TEACHER;
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    username: '',
    email: '',
    password: '',
    role: UserRole.TEACHER
  });

  const handleEditPermissions = (user: any) => {
    // Initialize permissions based on role if not present (simulated)
    const currentPermissions = user.permissions || DEFAULT_PERMISSIONS[user.role as UserRole] || [];
    setEditingUser({ ...user, permissions: currentPermissions });
    setIsModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (editingUser) {
      try {
        // Tìm Role ID tương ứng
        const targetRoleName = editingUser.role;
        const foundRole = availableRoles.find(r =>
          r.name?.toLowerCase() === targetRoleName.toLowerCase() ||
          r.type?.toLowerCase() === targetRoleName.toLowerCase()
        );

        const updatePayload: any = {
          blocked: editingUser.status === 'Inactive',
          permissions: editingUser.permissions // Bây giờ đã có thể lưu được vì schema đã có trường này
        };

        if (foundRole) {
          updatePayload.role = foundRole.id;
        }

        await updateUser(editingUser.id, updatePayload);

        // Optimistic update
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
        setIsModalOpen(false);
        setEditingUser(null);
        alert('Cập nhật quyền và vai trò thành công!');
      } catch (err: any) {
        alert('Cập nhật thất bại: ' + (err.message || err));
      }
    }
  };

  const handleInviteUser = async () => {
    try {
      if (!inviteForm.username || !inviteForm.email || !inviteForm.password) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
      }

      // Find Role ID
      let roleId = null;
      // Try to find matching role
      const targetRoleName = inviteForm.role;
      const foundRole = availableRoles.find(r =>
        r.name?.toLowerCase() === targetRoleName.toLowerCase() ||
        r.type?.toLowerCase() === targetRoleName.toLowerCase()
      );

      if (foundRole) {
        roleId = foundRole.id;
      } else {
        // Fallback to "Authenticated"
        const authRole = availableRoles.find(r => r.type === 'authenticated');
        roleId = authRole ? authRole.id : 1;
      }

      await createUser({
        username: inviteForm.username,
        email: inviteForm.email,
        password: inviteForm.password,
        confirmed: true, // Auto confirm
        blocked: false,
        role: roleId
      });

      alert('Đã tạo thành viên mới thành công!');
      setIsInviteModalOpen(false);
      setInviteForm({ username: '', email: '', password: '', role: UserRole.TEACHER });
      loadUsers();
    } catch (err: any) {
      alert('Tạo thất bại: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  const handleDeleteUser = async (userId: string | number, userName: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thành viên "${userName}" không? Hành động này không thể hoàn tác.`)) {
      try {
        await deleteUser(userId);
        setUsers(prev => prev.filter(u => u.id !== userId));
        alert('Đã xóa thành viên thành công!');
      } catch (err: any) {
        alert('Xóa thất bại: ' + (err.message || 'Lỗi không xác định'));
      }
    }
  };

  const togglePermission = (permId: string) => {
    if (!editingUser) return;
    const currentPerms = editingUser.permissions || [];
    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter((p: string) => p !== permId)
      : [...currentPerms, permId];
    setEditingUser({ ...editingUser, permissions: newPerms });
  };



  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản trị Hệ thống</h1>
        <p className="text-slate-500">Quản lý người dùng, phân cấp và phân quyền truy cập.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Shield size={24} /></div>
          <div>
            <h4 className="font-bold">Quản trị viên</h4>
            <p className="text-sm text-slate-500">2 người dùng</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Key size={24} /></div>
          <div>
            <h4 className="font-bold">Quản lý đào tạo</h4>
            <p className="text-sm text-slate-500">12 người dùng</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Mail size={24} /></div>
          <div>
            <h4 className="font-bold">Giảng viên</h4>
            <p className="text-sm text-slate-500">86 người dùng</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800">Danh sách Người dùng & Quyền</h3>
          <button onClick={() => setIsInviteModalOpen(true)} className="flex items-center gap-2 text-blue-600 font-bold hover:underline">
            <UserPlus size={18} /> Mời thành viên mới
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center items-center text-slate-500">
              <Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...
            </div>
          ) : error ? (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <div className="text-red-500 bg-red-50 p-4 rounded-full">
                <ServerCrash size={32} />
              </div>
              <h3 className="font-bold text-red-600">Đã xảy ra lỗi kết nối</h3>
              <p className="text-slate-500 max-w-md text-sm">{error}</p>
              <button
                onClick={loadUsers}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all shadow-sm shadow-blue-200"
              >
                <RefreshCcw size={16} /> Thử lại
              </button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Thành viên</th>
                  <th className="px-6 py-4">Vai trò</th>
                  <th className="px-6 py-4">Phạm vi quyền</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">{user.name.substring(0, 1)}</div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${user.role === UserRole.ADMIN ? 'bg-red-50 text-red-600' :
                        user.role === UserRole.MANAGER ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.role === UserRole.ADMIN ? 'Toàn quyền' : 'Quản lý nghiệp vụ'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                        <span className="text-sm text-slate-600">{user.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleEditPermissions(user)}
                          className="text-slate-400 hover:text-blue-600 font-medium text-sm transition-colors"
                        >
                          Sửa quyền
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="text-slate-400 hover:text-red-500 font-medium text-sm transition-colors p-1"
                          title="Xóa người dùng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>



      {/* Permission Modal */}
      {
        isModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-800">Phân quyền người dùng</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-red-500 transition-colors bg-white p-2 rounded-full hover:bg-red-50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-lg">
                    {editingUser.name.substring(0, 1)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{editingUser.name}</h4>
                    <p className="text-sm text-slate-500">{editingUser.email}</p>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 block">Vai trò hệ thống</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { role: UserRole.ADMIN, label: 'Quản trị viên', desc: 'Toàn quyền hệ thống', color: 'border-red-200 bg-red-50 text-red-700' },
                      { role: UserRole.MANAGER, label: 'Quản lý đào tạo', desc: 'Quản lý lớp học, học viên', color: 'border-blue-200 bg-blue-50 text-blue-700' },
                      { role: UserRole.TEACHER, label: 'Giảng viên', desc: 'Xem lịch dạy, chấm điểm', color: 'border-slate-200 bg-slate-50 text-slate-700' }
                    ].map((option) => (
                      <label
                        key={option.role}
                        className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${editingUser.role === option.role
                          ? `ring-2 ring-offset-1 ring-blue-500 ${option.color}`
                          : 'border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          className="sr-only"
                          checked={editingUser.role === option.role}
                          onChange={() => setEditingUser({ ...editingUser, role: option.role })}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-sm">{option.label}</div>
                          <div className="text-xs opacity-80">{option.desc}</div>
                        </div>
                        {editingUser.role === option.role && (
                          <div className="bg-blue-600 text-white p-1 rounded-full">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 block">Quyền hạn chi tiết</label>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {PERMISSIONS_LIST.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                          checked={editingUser.permissions?.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                        />
                        <span className="text-sm text-slate-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status Toggle (Existing code kept below) */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 block">Trạng thái hoạt động</label>
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    {['Active', 'Inactive'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setEditingUser({ ...editingUser, status })}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${editingUser.status === status
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <Shield size={18} />
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">Mời thành viên mới</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white p-2 rounded-full hover:bg-red-50">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={inviteForm.username}
                  onChange={e => setInviteForm({ ...inviteForm, username: e.target.value })}
                  placeholder="user123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={inviteForm.password}
                  onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="******"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò khởi tạo</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                >
                  <option value={UserRole.ADMIN}>Quản trị viên</option>
                  <option value={UserRole.MANAGER}>Quản lý đào tạo</option>
                  <option value={UserRole.TEACHER}>Giảng viên</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-white rounded-lg">Hủy</button>
              <button onClick={handleInviteUser} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-2">
                <UserPlus size={18} /> Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
