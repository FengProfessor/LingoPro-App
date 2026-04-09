'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Brain, Users, BookOpen, Target, TrendingUp, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface UserStat {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  wordCount: number;
  wordsToday: number;
  quizCount: number;
  avgAccuracy: number;
  lastActive: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalWords, setTotalWords] = useState(0);
  const [totalQuizzes, setTotalQuizzes] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const res = await fetch('/api/admin/stats');
      if (!res.ok) { router.push('/'); return; }
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setTotalWords(data.totalWords);
        setTotalQuizzes(data.totalQuizzes);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeUsers = users.filter(u => u.wordCount > 0).length;

  return (
    <div className="min-h-screen bg-muted/40 font-sans">
      <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur px-4 sm:px-6 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 font-bold text-primary">
          <Brain className="h-5 w-5" />
          Admin Dashboard
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'Active Users', value: activeUsers, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Total Words', value: totalWords, icon: BookOpen, color: 'text-violet-600 bg-violet-50' },
            { label: 'Quizzes Done', value: totalQuizzes, icon: Target, color: 'text-amber-600 bg-amber-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-background border rounded-2xl p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="bg-background border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-bold">User Activity</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time usage statistics</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">User</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Words</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Today</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Quizzes</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Accuracy</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      No users yet.
                    </td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{u.full_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{u.wordCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${u.wordsToday > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {u.wordsToday > 0 ? `+${u.wordsToday}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{u.quizCount || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {u.avgAccuracy > 0 ? (
                        <span className={`font-bold ${u.avgAccuracy >= 80 ? 'text-emerald-600' : u.avgAccuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {Math.round(u.avgAccuracy * 100)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                      {u.lastActive ? new Date(u.lastActive).toLocaleDateString('vi-VN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
