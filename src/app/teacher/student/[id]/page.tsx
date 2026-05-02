'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { StudentProgress } from '@/lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import {
  ArrowLeft, Brain, TrendingUp, Calendar, Target, Sparkles,
  MessageSquare, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StudentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = params.id as string;
  const classroomId = searchParams.get('class');

  const [data, setData] = useState<{
    current: StudentProgress | null;
    history: any[];
    quizzes: any[];
  }>({ current: null, history: [], quizzes: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (studentId && classroomId) {
      loadStudentDetail();
    }
  }, [studentId, classroomId]);

  const loadStudentDetail = async () => {
    try {
      const res = await fetch(`/api/teacher/student-detail?studentId=${studentId}&classroomId=${classroomId}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      
      // Auto-fetch AI coaching insight
      if (json.current) {
        generateAiInsight(json.current);
      }
    } catch (err: any) {
      toast.error('Failed to load student data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAiInsight = async (current: StudentProgress) => {
    setIsAiLoading(true);
    try {
      // Basic logic to determine tag for the prompt
      const isDormant = current.last_active && (new Date().getTime() - new Date(current.last_active).getTime() > 3 * 24 * 60 * 60 * 1000);
      const isCramming = (current.lcs || 0) < 30 && (current.avg_quiz_accuracy || 0) > 0.8;
      const isRisingStar = (current.lcs || 0) > 80 && (current.avg_quiz_accuracy || 0) > 0.8;
      const isAtRisk = (current.vms || 0) < 30 && (current.words_reviewed || 0) > 10;
      
      const tag = isDormant ? 'DORMANT' : isRisingStar ? 'RISING STAR' : isCramming ? 'CRAMMING' : isAtRisk ? 'AT RISK' : 'NORMAL';
      const msg = isDormant ? 'Vắng mặt lâu ngày' : isRisingStar ? 'Tiến bộ vượt trội' : isCramming ? 'Học dồn tập trung' : isAtRisk ? 'Đang gặp khó khăn' : 'Bình thường';

      const res = await fetch('/api/teacher/coaching-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          studentName: current.student_name, 
          vms: current.vms, 
          lcs: current.lcs, 
          tag, 
          msg,
          cefr: (current as any).cefr_level || 'A1',
          activeVms: (current as any).active_vms || 0,
          tesolFocus: true // Flag to prompt for pedagogical advice
        }),
      });
      const json = await res.json();
      setAiSuggestion(json.suggestion || 'Không thể tạo gợi ý lúc này.');
    } catch (err) {
      console.error('AI Insight Error:', err);
      setAiSuggestion('Chào bạn! Chúc bạn học tốt!');
    } finally {
      setIsAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { current, history, quizzes } = data;

  if (!current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Student not found</h2>
        <Link href="/teacher" className="text-primary hover:underline mt-4">Back to Dashboard</Link>
      </div>
    );
  }

  // Smart Tag Logic (Duplicate for UI display)
  const isDormant = current.last_active && (new Date().getTime() - new Date(current.last_active).getTime() > 3 * 24 * 60 * 60 * 1000);
  const isCramming = (current.lcs || 0) < 30 && (current.avg_quiz_accuracy || 0) > 0.8 && (current.quizzes_taken || 0) > 2;
  const isRisingStar = (current.lcs || 0) > 80 && (current.avg_quiz_accuracy || 0) > 0.8;
  const isAtRisk = (current.vms || 0) < 30 && (current.words_reviewed || 0) > 10;

  const getStatusInfo = () => {
    if (isDormant) return { label: 'Dormant', color: 'bg-rose-100 text-rose-600 border-rose-200', icon: Calendar, msg: 'Học sinh đã ngừng hoạt động hơn 3 ngày. Cần nhắc nhở quay lại học.' };
    if (isRisingStar) return { label: 'Rising Star', color: 'bg-emerald-100 text-emerald-600 border-emerald-200', icon: Sparkles, msg: 'Học sinh đang tiến bộ rất nhanh và đều đặn. Cần khen ngợi để duy trì động lực.' };
    if (isCramming) return { label: 'Cramming', color: 'bg-amber-100 text-amber-600 border-amber-200', icon: Loader2, msg: 'Học sinh có dấu hiệu học dồn. Cần khuyên học sinh giãn cách thời gian học.' };
    if (isAtRisk) return { label: 'At Risk', color: 'bg-rose-100 text-rose-600 border-rose-200', icon: AlertCircle, msg: 'Học sinh đang gặp khó khăn trong việc ghi nhớ. Cần kiểm tra lại các từ vựng đang học.' };
    return { label: 'Normal', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: Target, msg: 'Tiến độ học tập bình thường.' };
  };

  const status = getStatusInfo();

  // AI Coaching Logic (Phase 2)
  const getAISuggestion = () => {
    if (isDormant) return `Chào ${current.student_name.split(' ')[0]}! Thầy thấy bạn đã lâu chưa quay lại ôn tập. Chỉ cần 5 phút mỗi ngày để giữ vững tiến độ nhé. Cố lên!`;
    if (isRisingStar) return `Chào ${current.student_name.split(' ')[0]}! Kết quả học tập của bạn rất ấn tượng, đặc biệt là tính kỷ luật (LCS ${current.lcs}%). Tiếp tục phát huy nhé!`;
    if (isCramming) return `Chào ${current.student_name.split(' ')[0]}! Bài quiz của bạn điểm rất tốt, nhưng thầy thấy bạn thường học dồn. Hãy thử chia nhỏ thời gian học ra để nhớ lâu hơn nhé.`;
    return `Chào ${current.student_name.split(' ')[0]}! Thầy đang theo dõi tiến độ của bạn. Nếu cần hỗ trợ thêm về phần từ vựng nào thì báo thầy nhé.`;
  };

  const formattedHistory = history.map(h => ({
    ...h,
    date: new Date(h.recorded_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  }));

  const formattedQuizzes = quizzes.map(q => ({
    ...q,
    acc: Math.round(q.accuracy * 100),
    date: new Date(q.completed_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  }));

  return (
    <div className="min-h-screen bg-muted/40 font-sans pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b h-14 px-6 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">{current.student_name}</h1>
          <p className="text-xs text-muted-foreground">{current.email}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border uppercase flex items-center gap-1.5 ${status.color}`}>
          <status.icon className="h-3 w-3" />
          {status.label}
        </div>
        <div className="px-2 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-black tracking-tighter">
          {(current as any).cefr_level || 'A1'}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-background border rounded-2xl p-6 shadow-sm border-emerald-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">
                <Target className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Mastery (TESOL)</p>
            </div>
            <p className="text-4xl font-bold flex items-baseline gap-2">
              {(current as any).active_vms || 0}%
              <span className="text-sm font-normal text-muted-foreground">productive</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-wider">Passive: {current.vms}% | Depth: {(current as any).communicative_depth || 0}%</p>
          </div>

          <div className="bg-background border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-sky-500/10 p-2 rounded-xl text-sky-500">
                <TrendingUp className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Consistency (LCS)</p>
            </div>
            <p className="text-4xl font-bold flex items-baseline gap-2">
              {current.lcs}%
              <span className="text-sm font-normal text-muted-foreground">activity</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">Days active in the last 14 days.</p>
          </div>

          <div className="bg-background border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quiz Performance</p>
            </div>
            <p className="text-4xl font-bold flex items-baseline gap-2">
              {Math.round((current.avg_quiz_accuracy || 0) * 100)}%
              <span className="text-sm font-normal text-muted-foreground">accuracy</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">{current.quizzes_taken} sessions completed.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trend Charts */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-background border rounded-3xl p-8 shadow-md">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold">Learning Velocity</h3>
                  <p className="text-sm text-muted-foreground">Mastery (VMS) vs Consistency (LCS) over 30 days</p>
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> VMS</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-sky-500" /> LCS</div>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontSize: 12, fill: '#666' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Line type="monotone" dataKey="vms" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="lcs" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-background border rounded-3xl p-8 shadow-md">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold">Quiz History</h3>
                  <p className="text-sm text-muted-foreground">Accuracy percentage over recent attempts</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedQuizzes}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontSize: 12, fill: '#666' }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="acc" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* AI Side Cards */}
          <div className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/20 p-2.5 rounded-2xl text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-primary">AI Coaching Card</h3>
              </div>
              <div className="bg-background rounded-2xl p-5 border border-primary/10 mb-6 shadow-sm min-h-[80px] flex items-center">
                {isAiLoading ? (
                  <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm italic">Gemini is analyzing data...</span>
                  </div>
                ) : (
                  <p className="text-sm italic leading-relaxed text-slate-700 whitespace-pre-wrap">"{aiSuggestion || status.msg}"</p>
                )}
              </div>
              
              <div className="space-y-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Actionable Template</p>
                <div className="bg-background border rounded-2xl p-4 text-sm relative group min-h-[100px]">
                  {isAiLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-full animate-pulse" />
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                    </div>
                  ) : (
                    <p className="text-slate-600 leading-relaxed">{aiSuggestion || 'Đang chuẩn bị lời khuyên...'}</p>
                  )}
                </div>
                <button 
                  disabled={isAiLoading || !aiSuggestion}
                  onClick={() => {
                    navigator.clipboard.writeText(aiSuggestion);
                    toast.success('Message copied to clipboard!');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
                >
                  <MessageSquare className="h-4 w-4" /> Copy for Messenger
                </button>
              </div>
            </div>

            <div className="bg-background border rounded-3xl p-8 shadow-sm">
              <h3 className="text-lg font-bold mb-6">Quick Actions</h3>
              <div className="space-y-3">
                {[
                  { label: 'View Recent Errors', icon: AlertCircle },
                  { label: 'Export Progress PDF', icon: BookOpen },
                  { label: 'Assign Extra Drill', icon: Plus },
                ].map(action => (
                  <button key={action.label} className="w-full flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-muted transition-colors text-sm font-semibold">
                    <div className="flex items-center gap-3">
                      <action.icon className="h-4 w-4 text-muted-foreground" />
                      {action.label}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Re-using some icons from the sidebar
import { BookOpen, Plus } from 'lucide-react';
