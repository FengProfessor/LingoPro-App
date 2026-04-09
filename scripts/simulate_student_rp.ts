import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

async function simulate() {
  console.log('🔵 Roleplay: Simulation of Student Actions...');

  // 1. Find Classroom
  const { data: cls } = await supabase.from('classrooms').select('id').eq('name', 'IELTS Masterclass 2026').single();
  if (!cls) { console.error('Classroom not found!'); return; }
  const classroomId = cls.id;

  // 2. Find Students
  const { data: students } = await supabase.from('profiles').select('*').ilike('email', '%lingopro.test');
  if (!students || students.length < 2) { console.error('Students not found!'); return; }

  const studentX = students.find(s => s.email.includes('x'));
  const studentY = students.find(s => s.email.includes('y'));

  if (!studentX || !studentY) return;

  // ─── PART 1: STUDENT X ADDS A WORD ───
  console.log(`- ${studentX.full_name} is adding a new word: "Ambiguous"...`);
  await supabase.from('words').upsert({
    classroom_id: classroomId,
    added_by: studentX.id,
    word: 'Ambiguous',
    translation: 'Mơ hồ, nhập nhằng',
    pos: 'adj',
    example: 'His answer was so ambiguous that I couldn\'t understand his position.'
  });

  // ─── PART 2: STUDENTS TAKE VOCAB QUIZ ───
  console.log(`- Students are taking the Vocabulary Quiz...`);
  await supabase.from('quiz_results').insert([
    { user_id: studentX.id, classroom_id: classroomId, score: 5, total_questions: 5, quiz_type: 'vocabulary' },
    { user_id: studentY.id, classroom_id: classroomId, score: 3, total_questions: 5, quiz_type: 'vocabulary' }
  ]);

  // ─── PART 3: STUDENTS TAKE GRAMMAR EXERCISE (PASSIVE VOICE) ───
  console.log(`- Students are taking the "Passive Voice" Grammar Exercises...`);
  const { data: exercises } = await supabase.from('grammar_exercises').select('id').eq('classroom_id', classroomId).eq('topic', 'Passive Voice');
  
  if (exercises && exercises.length > 0) {
    for (const ex of exercises) {
      // Student X gets all right
      await supabase.from('grammar_results').insert({
        user_id: studentX.id,
        exercise_id: ex.id,
        chosen_answer: 'correct_answer_stub', // simplification for DB data
        is_correct: true
      });
      // Student Y gets 50% right
      await supabase.from('grammar_results').insert({
        user_id: studentY.id,
        exercise_id: ex.id,
        chosen_answer: 'random_answer',
        is_correct: Math.random() > 0.5
      });
    }
    console.log(`✅ Simulation complete!`);
  } else {
    console.warn('⚠️ No grammar exercises found to simulate results for!');
  }
}

simulate().catch(console.error);
