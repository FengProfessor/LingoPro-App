const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simulate() {
  console.log('--- STARTING COMPREHENSIVE 10-STUDENT SIMULATION (21 DAYS) ---');
  
  const classroomId = 'e947947b-e6dc-4c16-8b9c-2f6efa76835c';
  const { data: words } = await supabase.from('words').select('id').limit(50);
  
  if (!words || words.length < 20) {
    console.error('Insufficient vocabulary to simulate.');
    return;
  }

  // 1. Personae Definitions
  const personae = [
    { name: 'Nguyễn Văn An', type: 'RISING_STAR', consistency: 1.0, accuracy: 0.95, masteryGrowth: 4 },
    { name: 'Trần Thị Bình', type: 'AVERAGE', consistency: 0.65, accuracy: 0.72, masteryGrowth: 1.5 },
    { name: 'Lê Văn Cường', type: 'RISING_STAR', consistency: 0.9, accuracy: 0.88, masteryGrowth: 3.5 },
    { name: 'Phạm Thị Diệu', type: 'DORMANT', lastActiveDays: 10, consistency: 0, accuracy: 0.75, mastery: 42 },
    { name: 'Hoàng Văn Đức', type: 'DORMANT', lastActiveDays: 5, consistency: 0, accuracy: 0.6, mastery: 30 },
    { name: 'Võ Thị Dung', type: 'CRAMMING', consistency: 0.1, accuracy: 1.0, mastery: 5 },
    { name: 'Đặng Văn Em', type: 'AT_RISK', reviewCount: 55, consistency: 0.75, accuracy: 0.45, mastery: 8 },
    { name: 'Bùi Thị Phương', type: 'AT_RISK', reviewCount: 42, consistency: 0.4, accuracy: 0.52, mastery: 14 },
    { name: 'Đỗ Văn Giang', type: 'FADING', consistency: 0.85, accuracy: 0.82, fadingStart: 4 },
    { name: 'Ngô Thị Hoa', type: 'NEWCOMER', joinedDays: 3, consistency: 1.0, accuracy: 0.95, mastery: 2 }
  ];

  // 2. Identify/Create Students
  console.log('Syncing students and enrollments...');
  const activeStudents = [];
  
  for (let i = 0; i < personae.length; i++) {
    const p = personae[i];
    // Check if student exists by name prefix or generic email
    const email = `student.${i}@lingopro.test`;
    
    let { data: profile, error: getErr } = await supabase.from('profiles').select('id').eq('email', email).single();
    
    if (!profile) {
        const id = require('crypto').randomUUID();
        const { data: newProfile, error: insErr } = await supabase.from('profiles').insert({
            id: id,
            email: email,
            full_name: p.name,
            role: 'student'
        }).select('id').single();
        
        if (insErr) {
            console.error(`Failed to create student ${p.name}:`, insErr);
            continue;
        }
        profile = newProfile;
    } else {
        await supabase.from('profiles').update({ full_name: p.name }).eq('id', profile.id);
    }
    
    if (profile) {
        activeStudents.push({ ...profile, ...p });
        await supabase.from('enrollments').upsert({
            student_id: profile.id,
            classroom_id: classroomId
        });
    }
  }

  // 3. WIPE OLD DATA for these specific students to ensure clean test
  const studentIds = activeStudents.map(s => s.id);
  console.log('Cleaning old test data...');
  await supabase.from('srs_progress').delete().in('user_id', studentIds);
  await supabase.from('quiz_results').delete().in('user_id', studentIds);
  await supabase.from('student_daily_stats').delete().in('student_id', studentIds);

  // 4. Generate Data (21 Days History)
  console.log('Generating historical curves...');
  
  for (const s of activeStudents) {
    console.log(`- Modeling: ${s.name} (${s.type})`);

    // A. Daily Stats (History)
    for (let d = 21; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split('T')[0];

        let vms = 15;
        let lcs = 50;

        if (s.type === 'RISING_STAR') {
            vms = Math.min(95, 12 + (21 - d) * s.masteryGrowth);
            lcs = (d % 7 < 6) ? 100 : 0; // Misses some weekends
        } else if (s.type === 'DORMANT') {
            vms = s.mastery;
            lcs = d > s.lastActiveDays ? 70 : 0;
        } else if (s.type === 'CRAMMING') {
            vms = 5;
            lcs = d <= 1 ? 100 : 0;
        } else if (s.type === 'AT_RISK') {
            vms = s.mastery + (Math.random() * 2);
            lcs = s.consistency * 100;
        } else if (s.type === 'AVERAGE') {
            vms = 10 + (21 - d) * s.masteryGrowth;
            lcs = Math.random() > 0.3 ? 100 : 0;
        } else if (s.type === 'FADING') {
            vms = 55;
            lcs = d > s.fadingStart ? 100 : 0;
        } else if (s.type === 'NEWCOMER') {
            vms = d < s.joinedDays ? 5 : 0;
            lcs = d < s.joinedDays ? 100 : 0;
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

    // B. SRS Current State
    const reviewCount = s.reviewCount || (s.type === 'RISING_STAR' ? 40 : 15);
    for (let i = 0; i < reviewCount; i++) {
        await supabase.from('srs_progress').upsert({
            user_id: s.id,
            word_id: words[i % words.length].id,
            stability: s.type === 'RISING_STAR' && i < 25 ? 35 : (s.type === 'AT_RISK' ? 1.5 : 4),
            last_reviewed_at: (s.type === 'DORMANT' || s.type === 'FADING') 
                ? new Date(Date.now() - (s.lastActiveDays || s.fadingStart) * 24 * 60 * 60 * 1000).toISOString()
                : new Date().toISOString(),
            review_count: i < 5 ? 1 : 7
        });
    }

    // C. Recent Quizzes
    const quizCount = s.type === 'RISING_STAR' ? 8 : 3;
    for (let i = 0; i < quizCount; i++) {
        await supabase.from('quiz_results').insert({
            user_id: s.id,
            classroom_id: classroomId,
            score: Math.round(10 * s.accuracy),
            total_questions: 10,
            completed_at: new Date(Date.now() - (i * 3) * 24 * 60 * 60 * 1000).toISOString()
        });
    }
  }

  console.log('--- MASS SIMULATION COMPLETE (10 STUDENTS / 21 DAYS) ---');
}

simulate();
