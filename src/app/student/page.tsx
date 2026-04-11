'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, Word } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain, BookOpen, Zap, LayoutDashboard, LogOut, Loader2, Plus,
  CheckCircle2, TrendingUp, User, LayoutGrid, ArrowRight, RotateCcw, RefreshCw,
  Menu, X, Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quizStats, setQuizStats] = useState({ total: 0, avgAccuracy: 0 });
  const [isRetryingAI, setIsRetryingAI] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('--- Auth Check Started ---');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        loadData(session.user.id);
      } else {
        setIsLoading(false);
        router.push('/auth');
      }
    };
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        router.push('/auth');
      }
    });
    
    return () => { subscription.unsubscribe(); };
  }, []);

  const loadData = async (userId: string) => {
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setProfile(prof);

      // Fresh fetch with timestamp to disable any aggressive browser cache
      const res = await fetch(`/api/words?userId=${userId}&t=${Date.now()}`);
      const data = await res.json();
      
      if (data.success) {
        setWords(data.data || []);
        setClassroomId(data.classroomId);

        if (data.classroomId) {
          const { data: qr } = await supabase
            .from('quiz_results')
            .select('*')
            .eq('user_id', userId)
            .eq('classroom_id', data.classroomId);

          if (qr && qr.length > 0) {
            const totalCorrect = qr.reduce((s: number, q: any) => s + (q.score || 0), 0);
            const totalQuestions = qr.reduce((s: number, q: any) => s + (q.total_questions || 1), 0);
            setQuizStats({
              total: qr.length,
              avgAccuracy: Math.round((totalCorrect / totalQuestions) * 100)
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Load Dashboard error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // === Countdown Timer Hooks ===
  useEffect(() => {
    if (words.length === 0) return;

    const sortedWords = [...words]
      .filter((w: any) => w.srs?.next_review_date)
      .sort((a: any, b: any) => new Date(a.srs.next_review_date).getTime() - new Date(b.srs.next_review_date).getTime());

    const soonestWord = sortedWords.find((w: any) => new Date(w.srs.next_review_date) > new Date());
    if (!soonestWord) {
      setCountdown('');
      return;
    }

    const targetDate = new Date(soonestWord.srs?.next_review_date || Date.now());

    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      
      if (diff <= 0) {
        setCountdown('Ready!');
        if (profile?.id) loadData(profile.id);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      if (h > 0) setCountdown(`${h}h ${m}m ${s}s`);
      else if (m > 0) setCountdown(`${m}m ${s}s`);
      else setCountdown(`${s}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [words, profile?.id]);

  // === Auto-retry failed words ===
  useEffect(() => {
    if (!classroomId || words.length === 0) return;
    const hasFailed = words.some((w: any) => 
      w.translation?.includes('failed') || w.translation?.includes('Analyzing')
    );
    if (hasFailed && !isRetryingAI) {
      handleRetryAI();
    }
  }, [classroomId, words.length]);

  // === Auto-refresh Data every 10s ===
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(() => {
      loadData(profile.id);
    }, 10000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleRetryAI = async () => {
    if (!classroomId || isRetryingAI) return;
    setIsRetryingAI(true);
    try {
      const res = await fetch('/api/words/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId }),
      });
      if (!res.ok) throw new Error('Background refresh failed');
      const data = await res.json();
      if (data.refreshed > 0) {
        toast.success(`✅ AI analyzed ${data.refreshed} word(s)!`);
        setTimeout(() => { if (profile?.id) loadData(profile.id); }, 2000);
      }
    } catch (err) {
      // Background maintenance failed - silently log without toast
      console.warn('Background AI retry failed, will try again next cycle.');
    } finally {
      setIsRetryingAI(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/40 p-8 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const dueWords = words.filter((w: any) => w.isDue);
  const masteredCount = words.filter((w: any) => w.srsLevel === 5).length;

  return (
    <div className="flex min-h-screen w-full bg-muted/40 font-sans relative">
      {/* ═══ MOBILE DRAWER ═══ */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-background flex flex-col p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <Link href="/student" className="flex items-center gap-2 font-bold text-primary">
                  <Brain className="h-6 w-6" /> <span className="text-xl">LingoPro</span>
                </Link>
                <X className="h-6 w-6 cursor-pointer" onClick={() => setIsMenuOpen(false)} />
              </div>
              <nav className="flex-1 space-y-4">
                <Link href="/student" className="flex items-center gap-3 font-bold text-primary bg-primary/5 p-3 rounded-xl"><LayoutDashboard /> Dashboard</Link>
                <Link href="/import" className="flex items-center gap-3 font-semibold p-3"><Plus /> Import Words</Link>
                <Link href={classroomId ? `/flashcard?class=${classroomId}` : '#'} className="flex items-center gap-3 font-semibold p-3"><BookOpen /> Review</Link>
              </nav>
              <button onClick={handleSignOut} className="flex items-center gap-3 p-3 text-destructive font-bold"><LogOut /> Sign Out</button>
          </div>
        </div>
      )}

      {/* ═══ SIDEBAR (md+) ═══ */}
      <aside className="fixed inset-y-0 left-0 z-20 w-64 border-r bg-background hidden md:flex flex-col p-6">
        <Link href="/student" className="flex items-center gap-2 font-black text-primary text-2xl mb-10">
          <Brain className="h-8 w-8" /> LingoPro
        </Link>
        <nav className="flex-1 space-y-2">
          <Link href="/student" className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl font-bold transition-all">
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </Link>
          <Link href={classroomId ? `/flashcard?class=${classroomId}` : '#'} className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:bg-muted rounded-xl transition-all font-semibold">
            <BookOpen className="h-5 w-5" /> Flashcards
          </Link>
          <Link href={classroomId ? `/quiz?class=${classroomId}` : '#'} className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:bg-muted rounded-xl transition-all font-semibold">
            <Zap className="h-5 w-5" /> Mini Quiz
          </Link>
          <Link href="/import" className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:bg-muted rounded-xl transition-all font-semibold">
            <Plus className="h-5 w-5" /> Import Words
          </Link>
          <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:bg-muted rounded-xl transition-all font-semibold">
            <User className="h-5 w-5" /> Profile
          </Link>
        </nav>
        <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive rounded-xl transition-all font-semibold">
          <LogOut className="h-5 w-5" /> Sign Out
        </button>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <header className="h-16 border-b bg-background/80 backdrop-blur sticky top-0 z-10 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Menu className="h-6 w-6 md:hidden cursor-pointer" onClick={() => setIsMenuOpen(true)} />
            <h1 className="font-black text-lg sm:text-xl">Dashboard</h1>
          </div>
          <button onClick={() => profile?.id && loadData(profile.id)} className="p-2 hover:bg-muted rounded-full transition-colors">
            <RotateCcw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="p-6 sm:p-10 max-w-5xl mx-auto w-full space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: 'Total Words', val: words.length, icon: LayoutGrid, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Ready Review', val: dueWords.length, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
              { label: 'Mastered', val: masteredCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Accuracy', val: `${quizStats.avgAccuracy}%`, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-50' },
            ].map(s => (
              <div key={s.label} className="bg-background border rounded-2xl p-5 shadow-sm">
                <div className={`${s.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div className="text-xl sm:text-2xl font-black">{s.val}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          <section className="bg-white border rounded-[32px] shadow-xl p-8 sm:p-12 text-center relative overflow-hidden">
             <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-400 to-indigo-500" />
             
             <h2 className="text-2xl sm:text-4xl font-black text-slate-800 mb-2">Golden Time Analysis</h2>
             <p className="text-muted-foreground font-semibold mb-10">Advanced Spaced Repetition (SRS)</p>
             
             <div className="flex items-end justify-center gap-3 sm:gap-8 h-40 sm:h-56 px-4 border-b-2 border-slate-50 mb-12">
                {[1, 2, 3, 4, 5, 6].map((level) => {
                  const count = words.filter((w: any) => (w.srsLevel || 1) === level).length;
                  const maxCount = Math.max(1, words.length);
                  const heightPct = Math.max(10, Math.round((count / maxCount) * 100));
                  
                  // Real SRS intervals labels (Aligned with srs.ts)
                  const labels = ['1d', '3d', '7d', '14d', '1mo', '3mo'];
                  const colors = [
                    'bg-rose-400',   // L1
                    'bg-amber-400',  // L2
                    'bg-sky-400',    // L3
                    'bg-indigo-500', // L4
                    'bg-emerald-500',// L5
                    'bg-purple-500'  // L6
                  ];

                  return (
                    <div key={level} className="flex flex-col items-center justify-end h-full w-10 sm:w-16 group">
                      <span className="text-xs font-black text-slate-400 mb-2 transition-transform group-hover:scale-125">{count}</span>
                      <div 
                        className={`w-full rounded-t-2xl transition-all duration-700 ease-out level-bar-${level} shadow-lg ${colors[level-1]}`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <div className="mt-4 flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-500">Level {level}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{labels[level-1]}</span>
                      </div>
                    </div>
                  );
                })}
             </div>

             <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-600">
                  Ready to review: <span className="text-emerald-500 font-black">{dueWords.length}</span> words
                </h3>
                
                <Link href={classroomId ? `/flashcard?class=${classroomId}` : '#'} 
                      className={`inline-flex items-center gap-3 px-12 py-5 rounded-full font-black text-xl shadow-2xl transition-all
                        ${dueWords.length > 0 
                          ? 'bg-emerald-500 text-white hover:scale-105 hover:bg-emerald-600' 
                          : 'bg-slate-100 text-slate-400 pointer-events-none'}`}>
                  {dueWords.length > 0 ? 'Review Now' : 'All Caught Up!'} <ArrowRight className="h-6 w-6" />
                </Link>
                
                {countdown && dueWords.length === 0 && (
                  <div className="flex items-center justify-center gap-3 text-slate-500 pt-4 animate-in fade-in zoom-in duration-500">
                    <Clock className="h-6 w-6 text-indigo-500" />
                    <span className="text-sm font-bold">Next session in:</span>
                    <span className="text-3xl font-black text-indigo-600 font-mono tracking-tighter">{countdown}</span>
                  </div>
                )}
             </div>
          </section>
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-background border-t md:hidden flex items-center justify-around z-[90]">
        <Link href="/student" className="p-3 text-primary"><LayoutDashboard /></Link>
        <Link href="/import" className="p-4 -mt-10 bg-primary text-white rounded-2xl shadow-lg shadow-primary/40"><Plus /></Link>
        <Link href={classroomId ? `/flashcard?class=${classroomId}` : '#'} className="p-3 text-muted-foreground"><BookOpen /></Link>
      </nav>
    </div>
  );
}
