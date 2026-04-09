import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * POST /api/quiz/save
 * Body: { userId, classroomId, score, totalQuestions, quizType }
 */
export async function POST(req: Request) {
  try {
    const { userId, classroomId, score, totalQuestions, quizType = 'vocabulary' } = await req.json();

    let finalClassroomId = classroomId;

    const supabase = createServiceClient();

    // Fallback if classroomId is missing: find personal classroom
    if (!finalClassroomId && userId) {
      const { data: cls } = await supabase
        .from('classrooms')
        .select('id')
        .eq('name', 'Personal')
        .eq('teacher_id', userId)
        .single();
      if (cls) finalClassroomId = cls.id;
    }

    if (!userId || !finalClassroomId || score === undefined || !totalQuestions) {
      return NextResponse.json({ error: 'userId, classroomId, score, and totalQuestions are required' }, { status: 400 });
    }

    const accuracyPct = Math.round((score / totalQuestions) * 100);

    const { data, error } = await supabase
      .from('quiz_results')
      .insert({
        user_id: userId,
        classroom_id: finalClassroomId,
        quiz_type: quizType,
        score,
        total_questions: totalQuestions,
        accuracy: accuracyPct,
      })
      .select()
      .single();

    if (error) {
      console.error('Quiz Save Error [DB]:', error.message, error.details, error.hint);
      return NextResponse.json({ 
        error: 'Failed to save quiz results to database',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('POST /api/quiz/save Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
