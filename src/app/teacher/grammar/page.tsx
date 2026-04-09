'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

// This page redirects to the teacher's first classroom grammar page,
// or shows a helpful message if no classrooms exist.
export default function TeacherGrammarIndex() {
  const router = useRouter();
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('id')
        .eq('teacher_id', user.id)
        .neq('name', '__personal__')
        .order('created_at', { ascending: false })
        .limit(1);

      if (classrooms && classrooms.length > 0) {
        router.replace(`/teacher/grammar/${classrooms[0].id}`);
      } else {
        setMessage('no_classroom');
      }
    }
    redirect();
  }, []);

  if (message === 'no_classroom') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-muted/40 font-sans p-8">
        <div className="bg-background border rounded-3xl p-10 text-center max-w-md shadow-sm space-y-4">
          <div className="text-5xl">📚</div>
          <h2 className="text-2xl font-black">No Classrooms Yet</h2>
          <p className="text-muted-foreground">
            You need to create a classroom first before managing Grammar Exercises.
          </p>
          <button
            onClick={() => router.push('/teacher')}
            className="w-full bg-primary text-white font-bold py-3 rounded-2xl hover:bg-primary/90 transition-colors mt-2"
          >
            Go to Dashboard → Create Classroom
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
