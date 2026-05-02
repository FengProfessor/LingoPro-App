import { createServiceClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const classroomId = searchParams.get('classroomId');

    if (!studentId || !classroomId) {
      return NextResponse.json({ error: 'Missing studentId or classroomId' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Fetch current student progress
    const { data: current, error: curErr } = await supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', studentId)
      .eq('classroom_id', classroomId)
      .single();

    if (curErr) throw curErr;

    // 2. Fetch history (last 30 days)
    const { data: history, error: histErr } = await supabase
      .from('student_daily_stats')
      .select('recorded_at, vms, lcs')
      .eq('student_id', studentId)
      .eq('classroom_id', classroomId)
      .order('recorded_at', { ascending: true })
      .limit(30);

    // 3. Fetch recent quiz results
    const { data: quizzes, error: quizErr } = await supabase
      .from('quiz_results')
      .select('completed_at, score, total_questions, accuracy')
      .eq('user_id', studentId)
      .eq('classroom_id', classroomId)
      .order('completed_at', { ascending: true })
      .limit(10);

    return NextResponse.json({
      current,
      history: history || [],
      quizzes: quizzes || []
    });
  } catch (error: any) {
    console.error('Student Detail API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
