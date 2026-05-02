const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simulate() {
  console.log('--- SIMULATING STUDENT DATA ---');
  
  // 1. Get classroom and students
  const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student').limit(3);
  const { data: words } = await supabase.from('words').select('id').limit(50);
  const classroomId = 'e947947b-e6dc-4c16-8b9c-2f6efa76835c';

  if (!students || students.length < 2 || !words) {
    console.error('Insufficient data to simulate.');
    return;
  }

  // Student 0: Nguyen Van X -> RISING STAR
  console.log(`Simulating Rising Star: ${students[0].full_name}`);
  for (let i = 0; i < 20; i++) {
    await supabase.from('srs_progress').upsert({
      user_id: students[0].id,
      word_id: words[i].id,
      stability: i < 12 ? 30 : 5, // 60% mastered
      last_reviewed_at: new Date(Date.now() - (i % 14) * 24 * 60 * 60 * 1000).toISOString(),
      review_count: 5
    });
  }
  await supabase.from('quiz_results').insert({
    user_id: students[0].id,
    classroom_id: classroomId,
    score: 9,
    total_questions: 10,
    accuracy: 0.9,
    completed_at: new Date().toISOString()
  });

  // Student 1: Tran Thi Y -> CRAMMING
  console.log(`Simulating Cramming: ${students[1].full_name}`);
  for (let i = 0; i < 10; i++) {
    await supabase.from('srs_progress').upsert({
      user_id: students[1].id,
      word_id: words[i+20]?.id || words[0].id,
      stability: 2, // Low stability
      last_reviewed_at: new Date().toISOString(), // Just did it
      review_count: 1
    });
  }
  await supabase.from('quiz_results').insert({
    user_id: students[1].id,
    classroom_id: classroomId,
    score: 10,
    total_questions: 10,
    accuracy: 1.0,
    completed_at: new Date().toISOString()
  });

  // Student 2: Dormant (if exists)
  if (students[2]) {
    console.log(`Simulating Dormant: ${students[2].full_name}`);
    for (let i = 0; i < 5; i++) {
        await supabase.from('srs_progress').upsert({
          user_id: students[2].id,
          word_id: words[i+30]?.id || words[0].id,
          stability: 10,
          last_reviewed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
          review_count: 3
        });
      }
  }

  console.log('Simulation complete!');
}

simulate();
