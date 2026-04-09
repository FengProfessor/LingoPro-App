'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Classroom, Profile, StudentProgress } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain, Plus, Users, BookOpen, BarChart3, LogOut, Copy,
  CheckCircle2, Zap, Loader2, Trash2, TrendingUp, GraduationCap,
  ChevronRight, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClass) loadStudents(selectedClass.id);
  }, [selectedClass]);

  const loadData = async (classId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }

    try {
      const url = `/api/teacher/stats?teacherId=${user.id}${classId ? `&classroomId=${classId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setProfile({ id: user.id } as Profile);

      // Handle profile fetching separately or just use what we have
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (prof) setProfile(prof);

      setClassrooms(data.classrooms || []);
      
      // Select first classroom if not already selected
      if (!classId && data.classrooms?.length > 0) {
        setSelectedClass(data.classrooms[0]);
        // Re-run to load students for the first classroom
        loadData(data.classrooms[0].id);
      } else if (classId) {
        setStudents(data.students || []);
      }
    } catch (err: any) {
      console.error('Teacher data load error:', err);
      toast.error('Failed to load classes: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudents = async (classroomId: string) => {
    // This is now handled by loadData with classId, 
    // but keeping the direct call logic for manual refresh if needed
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch(`/api/teacher/stats?teacherId=${user?.id}&classroomId=${classroomId}`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err: any) {
      toast.error('Failed to load students');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newClassName.trim()) return;
    setIsCreating(true);
    const { data, error } = await supabase.from('classrooms').insert({
      teacher_id: profile.id,
      name: newClassName.trim(),
      description: newClassDesc.trim() || null,
    }).select().single();

    if (error) {
      console.error('Create classroom error:', error);
      toast.error(`Failed to create classroom: ${error.message}`);
    } else {
      toast.success(`Classroom "${data.name}" created!`);
      setClassrooms([{ ...data, enrollment_count: 0 }, ...classrooms]);
      setSelectedClass({ ...data, enrollment_count: 0 });
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassDesc('');
    }
    setIsCreating(false);
  };


  const handleDeleteClass = async (id: string) => {
    if (!confirm('Delete this classroom? All data will be lost.')) return;
    await supabase.from('classrooms').delete().eq('id', id);
    const updated = classrooms.filter(c => c.id !== id);
    setClassrooms(updated);
    setSelectedClass(updated[0] || null);
    toast.success('Classroom deleted.');
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Invite code copied!');
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/40 font-sans">
        <header className="h-14 border-b bg-background px-6 flex items-center justify-between lg:hidden">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </header>
        <div className="flex flex-col lg:flex-row min-h-screen">
          <aside className="hidden lg:flex w-64 border-r bg-background flex-col p-6 space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </aside>
          <main className="flex-1 p-4 lg:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-[500px] w-full rounded-2xl" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-[500px] w-full rounded-2xl" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const totalStudents = classrooms.reduce((sum, c) => sum + (c.enrollment_count || 0), 0);
  const avgAccuracy = students.length > 0
    ? Math.round(students.reduce((s, st) => s + (st.avg_quiz_accuracy || 0), 0) / students.length * 100)
    : 0;

  return (
    <div className="flex min-h-screen bg-muted/40 font-sans">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 w-64 flex-col border-r bg-background hidden sm:flex">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary">
            <div className="bg-primary/10 p-1.5 rounded-lg"><Brain className="h-5 w-5" /></div>
            <span className="text-lg">LingoPro</span>
          </Link>
        </div>

        {/* Profile */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> Teacher
              </p>
            </div>
          </div>
        </div>

        {/* Classes list */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Classes</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-1">
            {classrooms.map(cls => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                  selectedClass?.id === cls.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{cls.name}</span>
                <span className="text-xs opacity-60">{cls.enrollment_count || 0}</span>
              </button>
            ))}
            {classrooms.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No classes yet. Create one!</p>
            )}
          </nav>
        </div>

        <div className="p-4 border-t space-y-1">
          <Link href="/teacher/grammar" className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all">
            <BarChart3 className="h-4 w-4" /> Grammar Exercises
          </Link>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col sm:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 border-b bg-background/80 backdrop-blur px-6">
          <div>
            <h1 className="font-bold text-lg">{selectedClass?.name || 'Teacher Dashboard'}</h1>
            {selectedClass && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Invite code:</p>
                <button
                  onClick={() => copyInviteCode(selectedClass.invite_code)}
                  className="flex items-center gap-1.5 text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md hover:bg-primary/20 transition-colors"
                >
                  {selectedClass.invite_code}
                  {copiedCode === selectedClass.invite_code
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <Copy className="h-3 w-3" />
                  }
                </button>
              </div>
            )}
          </div>
          {selectedClass && (
            <div className="flex gap-2">
              <Link href={`/teacher/words/${selectedClass.id}`} className="flex items-center gap-2 text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-xl transition-colors">
                <Plus className="h-4 w-4" /> Add Words
              </Link>
              <Link href={`/teacher/grammar/${selectedClass.id}`} className="flex items-center gap-2 text-sm font-semibold bg-muted text-foreground hover:bg-muted/80 px-4 py-2 rounded-xl transition-colors">
                <Zap className="h-4 w-4" /> Grammar
              </Link>
              <button
                onClick={() => handleDeleteClass(selectedClass.id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Students', val: totalStudents, icon: Users, color: 'text-sky-500', bg: 'bg-sky-500/10' },
              { label: 'Classrooms', val: classrooms.length, icon: BookOpen, color: 'text-violet-500', bg: 'bg-violet-500/10' },
              { label: 'Students in Class', val: selectedClass ? (selectedClass.enrollment_count || 0) : 0, icon: GraduationCap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: 'Avg. Quiz Score', val: `${avgAccuracy}%`, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            ].map(stat => (
              <div key={stat.label} className="bg-background border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className={`${stat.bg} p-2.5 rounded-xl`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.val}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Student Progress Table */}
          {selectedClass ? (
            <div className="bg-background border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-bold">Student Progress — {selectedClass.name}</h2>
                <span className="text-xs text-muted-foreground">{students.length} enrolled</span>
              </div>
              {students.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="font-semibold text-muted-foreground">No students yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share the invite code <span className="font-mono font-bold text-primary">{selectedClass.invite_code}</span> with your students.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {students.map((s, i) => (
                    <div key={s.student_id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{s.student_name || 'Anonymous'}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{s.words_reviewed || 0} words</p>
                        <p className="text-xs text-muted-foreground">reviewed</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{s.quizzes_taken || 0}</p>
                        <p className="text-xs text-muted-foreground">quizzes</p>
                      </div>
                      <div className="text-right w-16">
                        <p className={`text-sm font-bold ${
                          (s.avg_quiz_accuracy || 0) > 0.8 ? 'text-emerald-500' : 
                          (s.avg_quiz_accuracy || 0) > 0.6 ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          {s.avg_quiz_accuracy ? `${Math.round(s.avg_quiz_accuracy * 100)}%` : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">accuracy</p>
                      </div>
                      {(s.avg_quiz_accuracy || 0) > 0.85 && (
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                      <Link href={`/teacher/student/${s.student_id}?class=${selectedClass.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-background border rounded-2xl p-12 text-center shadow-sm">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Create your first classroom</h3>
              <p className="text-muted-foreground mb-6 text-sm">Set up a classroom, add vocabulary, and invite your students.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> Create Classroom
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Create New Classroom</h2>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Class Name *</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="e.g. IELTS Preparation 2026"
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <textarea
                  value={newClassDesc}
                  onChange={e => setNewClassDesc(e.target.value)}
                  placeholder="e.g. Class for intermediate students targeting band 7.0"
                  rows={2}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
