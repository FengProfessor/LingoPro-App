const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simulate() {
  console.log('--- STARTING MASS 10-STUDENT SIMULATION ---');
  
  const classroomId = 'e947947b-e6dc-4c16-8b9c-2f6efa76835c';
  const { data: words } = await supabase.from('words').select('id').limit(50);
  
  if (!words || words.length < 20) {
    console.error('Not enough words in the DB to simulate students.');
    return;
  }

  // 1. Ensure we have 10 students (3 existing + 7 new mocks)
  let { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student');
  
  if (students.length < 10) {
    console.log(`Creating ${10 - students.length} new students...`);
    const newNames = ['Le Van A', 'Pham Thi B', 'Hoang Van C', 'Vo Thi D', 'Dang Van E', 'Bui Thi F', 'Do Van G', 'Ngo Thi H', 'Ly Van I'];
    for (let i = 0; i < (10 - students.length); i++) {
        const id = crypto.randomUUID();
        await supabase.from('profiles').insert({
            id: id,
            email: `student.${i+students.length}@example.com`,
            full_name: newNames[i] || `Student #${i+students.length}`,
            role: 'student'
        });
    }
    // Re-fetch
    const result = await supabase.from('profiles').select('id, full_name').eq('role', 'student').limit(10);
    students = result.data;
  }

  // 2. Enroll all in the classroom
  console.log('Enrolling students...');
  for (const s of students) {
    await supabase.from('enrollments').upsert({
        student_id: s.id,
        classroom_id: classroomId
    });
  }

  // 3. Generate 14 days of history per student Personae
  console.log('Generating 14-day history and activity...');
  
  const personae = [
    { type: 'RISING_STAR', consistency: 0.95, accuracy: 0.92, masteryGrowth: 5 },
    { type: 'RISING_STAR', consistency: 0.85, accuracy: 0.88, masteryGrowth: 4 },
    { type: 'DORMANT', lastActiveDays: 10, consistency: 0, accuracy: 0.7, mastery: 40 },
    { type: 'DORMANT', lastActiveDays: 5, consistency: 0, accuracy: 0.6, mastery: 30 },
    { type: 'CRAMMING', consistency: 0.1, accuracy: 1.0, mastery: 5 },
    { type: 'AT_RISK', reviewCount: 50, consistency: 0.7, accuracy: 0.5, mastery: 10 },
    { type: 'AT_RISK', reviewCount: 40, consistency: 1.0, accuracy: 0.4, mastery: 12 },
    { type: 'AVERAGE', consistency: 0.6, accuracy: 0.75, masteryGrowth: 2 },
    { type: 'FADING', consistency: 0.8, accuracy: 0.85, fadingStart: 4 }, // Was good, stopped 4 days ago
    { type: 'NEWCOMER', joinedDays: 2, consistency: 1.0, accuracy: 0.9, mastery: 5 }
  ];

  const limit = Math.min(students.length, personae.length);
  for (let sIdx = 0; sIdx < limit; sIdx++) {
    const student = students[sIdx];
    const p = personae[sIdx];
    if (!student || !p) continue;
    console.log(`- Simulating ${student.full_name} (${p.type})`);

    // A. Historical Stats (Daily)
    for (let d = 14; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split('T')[0];

        let vms = 20;
        let lcs = 50;

        if (p.type === 'RISING_STAR') {
            vms = Math.min(95, 10 + (14 - d) * p.masteryGrowth);
            lcs = p.consistency * 100;
        } else if (p.type === 'DORMANT') {
            vms = p.mastery;
            lcs = d > p.lastActiveDays ? 60 : 0;
        } else if (p.type === 'CRAMMING') {
            vms = 5;
            lcs = d <= 1 ? 100 : 5;
        } else if (p.type === 'AT_RISK') {
            vms = p.mastery;
            lcs = p.consistency * 100;
        } else if (p.type === 'AVERAGE') {
            vms = 15 + (14 - d) * p.masteryGrowth;
            lcs = p.consistency * 100;
        } else if (p.type === 'FADING') {
            vms = 40;
            lcs = d > p.fadingStart ? 100 : 0;
        } else if (p.type === 'NEWCOMER') {
            vms = d < p.joinedDays ? 5 : 0;
            lcs = d < p.joinedDays ? 100 : 0;
        }

        await supabase.from('student_daily_stats').upsert({
            student_id: student.id,
            classroom_id: classroomId,
            vms: Math.round(vms),
            lcs: Math.round(lcs),
            total_words: words.length,
            recorded_at: dateStr
        });
    }

    // B. SRS Progress (Current state)
    const reviewCount = p.reviewCount || (p.type === 'RISING_STAR' ? 30 : 10);
    for (let i = 0; i < reviewCount; i++) {
        await supabase.from('srs_progress').upsert({
            user_id: student.id,
            word_id: words[i % words.length].id,
            stability: p.type === 'RISING_STAR' && i < 15 ? 30 : (p.type === 'AT_RISK' ? 2 : 5),
            last_reviewed_at: p.type === 'DORMANT' 
                ? new Date(Date.now() - p.lastActiveDays * 24 * 60 * 60 * 1000).toISOString()
                : (p.type === 'FADING' ? new Date(Date.now() - p.fadingStart * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString()),
            review_count: i < 5 ? 1 : 5
        });
    }

    // C. Quiz Results
    const quizCount = p.type === 'RISING_STAR' ? 5 : 2;
    for (let i = 0; i < quizCount; i++) {
        await supabase.from('quiz_results').insert({
            user_id: student.id,
            classroom_id: classroomId,
            score: Math.round(10 * p.accuracy),
            total_questions: 10,
            completed_at: new Date(Date.now() - (i * 2) * 24 * 60 * 60 * 1000).toISOString()
        });
    }
  }

  console.log('--- MASS SIMULATION COMPLETE ---');
}

simulate();
