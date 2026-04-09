import { createServiceClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * GET /api/teacher/stats?teacherId=xxx&classroomId=yyy
 * Fetches teacher dashboard stats bypassing RLS recursion issues.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get('teacherId');
    const classroomId = searchParams.get('classroomId');

    if (!teacherId) return NextResponse.json({ error: 'teacherId is required' }, { status: 400 });

    const supabase = createServiceClient();

    // 1. Get classrooms
    const { data: classrooms, error: classErr } = await supabase
      .from('classrooms')
      .select('*, enrollments(count)')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (classErr) throw classErr;

    // Join-like enrollment count
    const enriched = (classrooms || []).map(c => ({
      ...c,
      enrollment_count: c.enrollments?.[0]?.count || 0
    }));

    // 2. Get students for selected classroom if provided
    let students = [];
    if (classroomId) {
      const { data: studentData, error: studentErr } = await supabase
        .from('student_progress')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('avg_quiz_accuracy', { ascending: false });
      
      if (studentErr) throw studentErr;
      students = studentData || [];
    }

    return NextResponse.json({
      classrooms: enriched,
      students
    });
  } catch (error: any) {
    console.error('Teacher API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
