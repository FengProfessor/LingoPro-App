const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAnalytics() {
  console.log('--- TESTING TEACHER ANALYTICS LOGIC ---');
  
  // 1. Get a student and their SRS + Quizzes
  const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student').limit(2);
  
  if (!students || students.length === 0) {
    console.log('No students found to test.');
    return;
  }

  for (const student of students) {
    console.log(`\nAnalyzing Student: ${student.full_name} (${student.id})`);
    
    // Get SRS Progress
    const { data: srs } = await supabase.from('srs_progress').select('*').eq('user_id', student.id);
    const totalWords = srs?.length || 0;
    const masteredWords = srs?.filter(w => w.stability > 15).length || 0;
    
    // Get Quizzes in last 30 days
    const { data: quizzes } = await supabase.from('quiz_results').select('*').eq('user_id', student.id);
    const avgAccuracy = quizzes?.length ? quizzes.reduce((a, b) => a + b.accuracy, 0) / quizzes.length : 0;

    // Calculate LCS (unique active days in last 14 days)
    const activeDaysSet = new Set();
    srs?.forEach(w => {
      if (w.last_reviewed_at) {
        const date = new Date(w.last_reviewed_at);
        const diffDays = (new Date() - date) / (1000 * 60 * 60 * 24);
        if (diffDays <= 14) activeDaysSet.add(date.toISOString().split('T')[0]);
      }
    });
    const activeDaysCount = activeDaysSet.size;

    // Metrics
    const vms = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
    const lcs = Math.round((activeDaysCount / 14) * 100);

    // Smart Tag Logic
    let tag = 'NORMAL';
    const lastActive = srs?.reduce((max, w) => w.last_reviewed_at > max ? w.last_reviewed_at : max, '') || '';
    const isDormant = lastActive && (new Date() - new Date(lastActive)) / (1000 * 60 * 60 * 24) > 3;
    
    if (isDormant) tag = 'DORMANT';
    else if (lcs > 80 && avgAccuracy > 0.8) tag = 'RISING STAR';
    else if (lcs < 30 && avgAccuracy > 0.8 && quizzes?.length > 2) tag = 'CRAMMING';
    else if (vms < 30 && totalWords > 10) tag = 'AT RISK';

    console.log(`- VMS (Mastery): ${vms}% (${masteredWords}/${totalWords} words)`);
    console.log(`- LCS (Consistency): ${lcs}% (${activeDaysCount}/14 active days)`);
    console.log(`- Avg Accuracy: ${Math.round(avgAccuracy * 100)}%`);
    console.log(`- SUGGESTED TAG: ${tag}`);
  }
}

testAnalytics();
