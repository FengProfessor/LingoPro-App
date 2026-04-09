import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/admin/stats
 * Returns all users with their activity stats for the admin dashboard.
 * Uses service role to bypass RLS.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    const today = new Date().toISOString().split('T')[0];

    // Enrich each user with stats
    const users = await Promise.all((profiles || []).map(async (profile: any) => {
      // Count words (via their personal classroom)
      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('id')
        .eq('teacher_id', profile.id)
        .eq('name', '__personal__');

      let wordCount = 0;
      let wordsToday = 0;
      let lastActive: string | null = null;

      if (classrooms && classrooms.length > 0) {
        const classroomIds = classrooms.map((c: any) => c.id);

        const { data: words } = await supabase
          .from('words')
          .select('id, created_at')
          .in('classroom_id', classroomIds);

        wordCount = words?.length || 0;
        wordsToday = (words || []).filter((w: any) =>
          w.created_at?.startsWith(today)
        ).length;

        if (words && words.length > 0) {
          lastActive = words.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]?.created_at;
        }
      }

      // Quiz stats
      const { data: quizResults } = await supabase
        .from('quiz_results')
        .select('accuracy, completed_at')
        .eq('user_id', profile.id);

      const quizCount = quizResults?.length || 0;
      const avgAccuracy = quizCount > 0
        ? (quizResults || []).reduce((sum: number, r: any) => sum + (r.accuracy || 0), 0) / quizCount
        : 0;

      // Update lastActive from quiz if more recent
      if (quizResults && quizResults.length > 0) {
        const latestQuiz = quizResults.sort((a: any, b: any) =>
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        )[0]?.completed_at;

        if (!lastActive || new Date(latestQuiz) > new Date(lastActive)) {
          lastActive = latestQuiz;
        }
      }

      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        created_at: profile.created_at,
        wordCount,
        wordsToday,
        quizCount,
        avgAccuracy,
        lastActive,
      };
    }));

    // Aggregate totals
    const totalWords = users.reduce((sum, u) => sum + u.wordCount, 0);
    const totalQuizzes = users.reduce((sum, u) => sum + u.quizCount, 0);

    return NextResponse.json({ success: true, users, totalWords, totalQuizzes });
  } catch (error: any) {
    console.error('GET /api/admin/stats Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
