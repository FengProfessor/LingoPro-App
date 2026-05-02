const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSimulation() {
  console.log('--- STARTING COMPREHENSIVE CLASS-WIDE SIMULATION (30 DAYS) ---');
  
  const classroomId = 'e947947b-e6dc-4c16-8b9c-2f6efa76835c';
  const { data: words } = await supabase.from('words').select('id').limit(50);
  
  const personae = [
    { name: 'Nguyễn Minh Tâm', type: 'RISING_STAR', consistency: 1.0, accuracy: 0.98, masteryGrowth: 4.5 },
    { name: 'Lê Hoàng Nam', type: 'RISING_STAR', consistency: 0.9, accuracy: 0.92, masteryGrowth: 4.0 },
    { name: 'Trần Thu Thảo', type: 'RISING_STAR', consistency: 0.95, accuracy: 0.90, masteryGrowth: 3.8 },
    { name: 'Phạm Gia Bảo', type: 'DORMANT', lastActiveDays: 15, consistency: 0, accuracy: 0.8, mastery: 45 },
    { name: 'Vũ Quỳnh Chi', type: 'DORMANT', lastActiveDays: 6, consistency: 0, accuracy: 0.7, mastery: 35 },
    { name: 'Hoàng Anh Tuấn', type: 'CRAMMING', consistency: 0.05, accuracy: 1.0, mastery: 8 },
    { name: 'Đỗ Hùng Dũng', type: 'AT_RISK', reviewCount: 65, consistency: 0.8, accuracy: 0.42, mastery: 11 },
    { name: 'Bùi Ngọc Ánh', type: 'AT_RISK', reviewCount: 48, consistency: 0.9, accuracy: 0.48, mastery: 15 },
    { name: 'Võ Minh Triết', type: 'FADING', consistency: 0.9, accuracy: 0.85, fadingStart: 5 },
    { name: 'Lý Thu Hà', type: 'AVERAGE', consistency: 0.6, accuracy: 0.78, masteryGrowth: 2.2 }
  ];

  const activeStudents = [];

  for (let i = 0; i < personae.length; i++) {
    const p = personae[i];
    const email = `student.${i}@lingopro.test`;
    
    // 1. Find or Create Auth User
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    let authUser = users.find(u => u.email === email);
    let userId;

    if (!authUser) {
        console.log(`Creating auth user: ${email}`);
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password: 'password123',
            email_confirm: true,
            user_metadata: { full_name: p.name, role: 'student' }
        });
        if (createErr) { console.error(`Error creating ${email}:`, createErr); continue; }
        userId = newUser.user.id;
    } else {
        userId = authUser.id;
        await supabase.from('profiles').update({ full_name: p.name }).eq('id', userId);
    }
    
    activeStudents.push({ id: userId, ...p });

    // 2. Enroll
    await supabase.from('enrollments').upsert({ student_id: userId, classroom_id: classroomId });
  }

  // 3. Clean and Populate
  const ids = activeStudents.map(s => s.id);
  console.log('Clearing old records...');
  await supabase.from('srs_progress').delete().in('user_id', ids);
  await supabase.from('quiz_results').delete().in('user_id', ids);
  await supabase.from('student_daily_stats').delete().in('student_id', ids);

  console.log('Generating 30-day activity...');
  for (const s of activeStudents) {
    process.stdout.write(`- Simulating ${s.name}... `);

    // History (30 days)
    for (let d = 30; d >= 0; d--) {
        const dateStr = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let vms = 15;
        let lcs = 50;

        if (s.type === 'RISING_STAR') {
            vms = Math.min(98, 10 + (30 - d) * s.masteryGrowth);
            lcs = (d % 7 === 0) ? 0 : 100; // Misses Sunday
        } else if (s.type === 'DORMANT') {
            vms = s.mastery;
            lcs = d > s.lastActiveDays ? 80 : 0;
        } else if (s.type === 'CRAMMING') {
            vms = 8;
            lcs = d <= 1 ? 100 : 0;
        } else if (s.type === 'AT_RISK') {
            vms = s.mastery + (Math.random() * 3);
            lcs = s.consistency * 100;
        } else if (s.type === 'AVERAGE') {
            vms = 12 + (30 - d) * s.masteryGrowth;
            lcs = Math.random() > 0.4 ? 100 : 0;
        } else if (s.type === 'FADING') {
            vms = 60;
            lcs = d > s.fadingStart ? 100 : 0;
        }

        await supabase.from('student_daily_stats').upsert({
            student_id: s.id,
            classroom_id: classroomId,
            vms: Math.round(vms),
            lcs: Math.round(lcs),
            total_words: words.length,
            recorded_at: dateStr
        });
    }

    // SRS
    const reviews = s.reviewCount || (s.type === 'RISING_STAR' ? 45 : 15);
    for (let i = 0; i < reviews; i++) {
        await supabase.from('srs_progress').upsert({
            user_id: s.id,
            word_id: words[i % words.length].id,
            stability: s.type === 'RISING_STAR' ? 40 : (s.type === 'AT_RISK' ? 1.2 : 5),
            last_reviewed_at: (s.type === 'DORMANT' || s.type === 'FADING')
                ? new Date(Date.now() - (s.lastActiveDays || s.fadingStart) * 24 * 60 * 60 * 1000).toISOString()
                : new Date().toISOString(),
            review_count: 10
        });
    }

    // Quiz
    const qCount = s.type === 'RISING_STAR' ? 10 : 3;
    for (let i = 0; i < qCount; i++) {
        await supabase.from('quiz_results').insert({
            user_id: s.id,
            classroom_id: classroomId,
            score: Math.round(10 * s.accuracy),
            total_questions: 10,
            completed_at: new Date(Date.now() - (i * 3) * 24 * 60 * 60 * 1000).toISOString()
        });
    }
    console.log('Done.');
  }
  console.log('--- MASS SIMULATION COMPLETE ---');
}

runSimulation();
