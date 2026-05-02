const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfill() {
  console.log('--- BACKFILLING ANALYTICS HISTORY ---');
  
  const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student').limit(3);
  const classroomId = 'e947947b-e6dc-4c16-8b9c-2f6efa76835c';

  if (!students) return;

  for (let d = 14; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    // Student 0: Rising Star Trend
    await supabase.from('student_daily_stats').upsert({
      student_id: students[0].id,
      classroom_id: classroomId,
      vms: Math.min(100, 20 + (14 - d) * 4), // Grows 20 -> 76
      lcs: Math.min(100, 50 + (14 - d) * 3), // Grows 50 -> 92
      total_words: 20,
      recorded_at: dateStr
    });

    // Student 1: Cramming Trend
    if (students[1]) {
        await supabase.from('student_daily_stats').upsert({
          student_id: students[1].id,
          classroom_id: classroomId,
          vms: 5, // Flat low mastery
          lcs: d < 3 ? 90 : 10, // Only active last 3 days
          total_words: 15,
          recorded_at: dateStr
        });
    }
  }

  console.log('Backfill complete!');
}

backfill();
