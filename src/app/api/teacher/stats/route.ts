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

      // Map to include TESOL metrics (Simulated based on pedagogical heuristics for this prototype)
      students = (studentData || []).map(s => {
        const accuracy = s.avg_quiz_accuracy || 0;
        const vms = s.vms || 0;
        const words = s.words_reviewed || 0;

        // Active Vocabulary is roughly 60-80% of passive vocabulary indexed by accuracy
        const activeVms = Math.round(vms * (0.6 + (accuracy * 0.4)));
        const depth = Math.round((vms + (s.lcs || 0)) / 2);

        // CEFR Level Mapping
        let cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' = 'A1';
        if (words >= 1000) cefr = 'C2';
        else if (words >= 600) cefr = 'C1';
        else if (words >= 300) cefr = 'B2';
        else if (words >= 150) cefr = 'B1';
        else if (words >= 50) cefr = 'A2';

        return {
          ...s,
          active_vms: activeVms,
          communicative_depth: depth,
          cefr_level: cefr
        };
      });
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
