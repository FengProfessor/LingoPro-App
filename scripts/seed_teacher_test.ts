import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

const TEACHER_ID = 'ba60ff49-9141-4e28-9b29-94d4865ad819';

async function seedV3() {
  console.log('🚀 Seeding Teacher Test Data V3 (Hardcoded IDs)...');

  // 1. Get the classroom ID
  const { data: cls } = await supabase.from('classrooms').select('*').eq('teacher_id', TEACHER_ID).order('created_at', { ascending: false }).limit(1).single();
  if (!cls) throw new Error('Classroom not found');
  const classroomId = cls.id;
  console.log('✅ Using classroom:', cls.name, classroomId);

  // 2. Create 2 students with unique emails
  const emails = ['student.x@lingopro.test', 'student.y@lingopro.test'];
  for (const email of emails) {
    const { data: userRecord, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true,
      user_metadata: { full_name: email.includes('x') ? 'Nguyen Van X' : 'Tran Thi Y' }
    });
    
    // Ignore already exists
    const user = userRecord?.user || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email);
    if (!user) continue;

    const studentName = user.user_metadata?.full_name || 'Mock Student';

    // 3. Upsert Profile
    await supabase.from('profiles').upsert({ id: user.id, email, full_name: studentName, role: 'student' });

    // 4. Enroll
    const { error: enrErr } = await supabase.from('enrollments').upsert({
      student_id: user.id,
      classroom_id: classroomId
    });
    if (enrErr) console.error('Enrollment error:', enrErr);

    // 5. Quiz Results
    const accuracy = email.includes('x') ? 0.85 : 0.65;
    await supabase.from('quiz_results').insert({
      user_id: user.id,
      classroom_id: classroomId,
      score: Math.round(accuracy * 10),
      total_questions: 10,
      completed_at: new Date().toISOString()
    });

    console.log(`✅ Student ${studentName} enrolled and quiz results added.`);
  }

  console.log('\n🌟 Seeding complete!');
}

seedV3().catch(console.error);
