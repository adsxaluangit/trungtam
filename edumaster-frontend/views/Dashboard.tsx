
import React, { useEffect, useState } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle,
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchCategory, COLLECTIONS } from '../services/api';

interface DashboardStats {
  totalStudents: number;
  openClasses: number;
  totalTeachers: number;
  graduatedStudents: number;
}

interface ChartData {
  name: string;
  hv: number;
}

interface Activity {
  id: string;
  text: string;
  time: string;
  type: 'OPENING' | 'RECOGNITION';
}

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      {trend && (
        <span className="flex items-center gap-1 text-green-600 text-sm font-bold bg-green-50 px-2 py-1 rounded-lg">
          <TrendingUp size={14} /> +12%
        </span>
      )}
    </div>
    <p className="text-slate-500 text-sm font-medium">{title}</p>
    <h3 className="text-2xl font-bold mt-1 text-slate-900">{value}</h3>
  </div>
);

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    openClasses: 0,
    totalTeachers: 0,
    graduatedStudents: 0
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Parallel data fetching
      const [studentsData, teachersData, decisionsData] = await Promise.all([
        fetchCategory(COLLECTIONS.STUDENTS),
        fetchCategory(COLLECTIONS.TEACHERS),
        fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?populate[students]=true&populate[school_class]=true&populate[related_decision]=true`)
      ]);

      // 1. Basic Counts
      const totalStudents = studentsData ? studentsData.length : 0;
      const totalTeachers = teachersData ? teachersData.length : 0;

      // 2. Process Decisions
      let openClasses = 0;
      let graduatedStudents = 0;
      const chartMap = new Map<number, number>(); // Month (0-11) -> Student Count

      // Initialize chart for all 12 months
      for (let i = 0; i < 12; i++) chartMap.set(i, 0);

      const decisionList = decisionsData || [];

      // Identify completed classes
      const recognitionDecisions = decisionList.filter((d: any) => d.type === 'RECOGNITION');
      const completedDecisionIds = new Set(
        recognitionDecisions.map((d: any) => {
          // Handle both possible relation structures just in case
          const rel = d.related_decision?.data || d.related_decision;
          return String(rel?.documentId || rel?.id || '');
        })
      );

      // Process main list
      decisionList.forEach((d: any) => {
        // Count Graduated: Sum from all RECOGNITION decisions
        if (d.type === 'RECOGNITION') {
          graduatedStudents += (d.students?.length || d.students?.data?.length || 0);
        }

        // Count Open Classes: OPENING decisions not in completed list
        if (d.type === 'OPENING') {
          const id = String(d.documentId || d.id);
          if (!completedDecisionIds.has(id)) {
            openClasses++;
          }

          // Chart Data: Students per month based on Signed Date
          // Only count students from OPENING decisions to show "New Enrollments" or "Growth"
          const date = new Date(d.signed_date || d.created_at);
          const month = date.getMonth(); // 0-11
          const currentStudentCount = d.students?.length || d.students?.data?.length || 0;
          // Only add to chart if it's the current year? Or just show whatever year is in data?
          // Let's filter for current year for the chart to make it "This Year Growth"
          if (date.getFullYear() === new Date().getFullYear()) {
            chartMap.set(month, (chartMap.get(month) || 0) + currentStudentCount);
          }
        }
      });

      // 3. Format Chart Data
      const formattedChartData = Array.from(chartMap.entries())
        .map(([monthIndex, hv]) => ({
          name: `Tháng ${monthIndex + 1}`,
          hv
        }));

      // 4. Recent Activity
      // Sort by updated_at desc
      const sortedDecisions = [...decisionList].sort((a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ).slice(0, 5);

      const formattedActivities = sortedDecisions.map((d: any) => {
        const timeDiff = Math.floor((new Date().getTime() - new Date(d.updatedAt).getTime()) / 60000); // minutes
        let timeString = `${timeDiff} phút trước`;
        if (timeDiff > 60) timeString = `${Math.floor(timeDiff / 60)} giờ trước`;
        if (timeDiff > 1440) timeString = `${Math.floor(timeDiff / 1440)} ngày trước`;

        const typeText = d.type === 'OPENING' ? 'mở lớp' : 'công nhận tốt nghiệp';
        const code = d.decision_number || '---';
        const className = d.school_class?.data?.attributes?.name || d.school_class?.name || '...';

        return {
          id: String(d.id),
          text: `Quyết định #${code} ${typeText} ${className} đã được cập nhật.`,
          time: timeString,
          type: d.type
        };
      });

      setStats({
        totalStudents,
        totalTeachers,
        openClasses,
        graduatedStudents
      });
      setChartData(formattedChartData);
      setActivities(formattedActivities);

    } catch (error) {
      console.error("Dashboard data load failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <span className="ml-3 text-slate-500 font-medium">Đang tải dữ liệu tổng quan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h1>
        <p className="text-slate-500">Chào mừng trở lại, đây là những gì đang diễn ra hôm nay.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Tổng học viên" value={stats.totalStudents.toLocaleString()} icon={Users} color="bg-blue-600" trend={true} />
        <StatCard title="Lớp đang mở" value={stats.openClasses.toLocaleString()} icon={BookOpen} color="bg-indigo-600" />
        <StatCard title="Giảng viên" value={stats.totalTeachers.toLocaleString()} icon={GraduationCap} color="bg-purple-600" />
        <StatCard title="Đã tốt nghiệp" value={stats.graduatedStudents.toLocaleString()} icon={CheckCircle} color="bg-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" /> Biểu đồ tăng trưởng học viên (Năm {new Date().getFullYear()})
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="hv" name="Học viên" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock size={20} className="text-orange-600" /> Hoạt động gần đây
          </h3>
          <div className="space-y-6">
            {activities.length === 0 ? (
              <p className="text-slate-400 italic text-sm">Chưa có hoạt động nào.</p>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="flex gap-4 items-start group">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${act.type === 'OPENING' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 leading-tight">
                      {act.text}
                    </p>
                    <span className="text-xs text-slate-400 mt-1 block">{act.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="w-full mt-8 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            Xem tất cả hoạt động
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
