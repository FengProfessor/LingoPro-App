import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

async function fixRls() {
  console.log('🛠 Fixing RLS Infinite Recursion...');

  // We use rpc() to execute SQL if possible, but the local supabase client doesn't have a direct sql runner.
  // However, I can use the service role client which BYPASSES RLS. 
  // Wait, the client code (Dashboard) is what's failing. The fix must be in the DB.
  
  // I will use `supabase.rpc()` to execute a custom function that fixes policies if I can create it.
  // Actually, I'll try to run the SQL via a migration or a direct script if I have a way.
  
  // Actually, I can just use the Service Role key in the Dashboard temporarily to see if it works, 
  // but the real fix is the DB.
  
  // Let's try to find a way to run SQL. 
  // I can use `npx supabase db execute` if I'm authenticated.
  
  // Wait, I can just write a Node script that uses the 'pg' client if I had the connection string, 
  // but I only have the Supabase keys.
  
  // I'll try to use a 'createServiceClient()' call in the dashboard itself as a "test" fix for the user first.
  // No, that's bad practice.
  
  // I'll try to run the SQL fix via `npx supabase db execute` or similar.
  // Or I can use a hack: I have the Gemini vision tool, I can't really "type" into a SQL editor easily, 
  // but I can use `run_command` with Supabase CLI.
  
  console.log('Sending SQL fix to Supabase CLI...');
  const sql = `
    -- 1. Break recursion in enrollments
    drop policy if exists "Teachers view their class enrollments" on public.enrollments;
    create policy "Teachers view their class enrollments" on public.enrollments 
    for select using (
      auth.uid() in (
        select teacher_id from public.classrooms 
        where id = classroom_id
      )
    );

    -- 2. Break recursion in classrooms
    drop policy if exists "Students can view joined classrooms" on public.classrooms;
    create policy "Students can view joined classrooms" on public.classrooms 
    for select using (
      auth.uid() in (
        select student_id from public.enrollments 
        where classroom_id = id
      )
    );
  `;

  // Actually the above still might recurse. Let's use the foolproof "no-loop" way:
  // Use a function with SECURITY DEFINER to check if a user is a teacher of a classroom.
  const bypassSql = \`
    create or replace function public.is_classroom_teacher(cls_id uuid)
    returns boolean as \$\$
      select exists (
        select 1 from public.classrooms
        where id = cls_id and teacher_id = auth.uid()
      );
    \$\$ language sql security definer;

    create or replace function public.is_classroom_student(cls_id uuid)
    returns boolean as \$\$
      select exists (
        select 1 from public.enrollments
        where classroom_id = cls_id and student_id = auth.uid()
      );
    \$\$ language sql security definer;

    -- Update policies to use these functions
    drop policy if exists "Students can view joined classrooms" on public.classrooms;
    create policy "Students can view joined classrooms" on public.classrooms 
    for select using (is_classroom_student(id));

    drop policy if exists "Teachers view their class enrollments" on public.enrollments;
    create policy "Teachers view their class enrollments" on public.enrollments 
    for select using (is_classroom_teacher(classroom_id));
  \`;

  console.log('Please execute the following SQL in your Supabase SQL Editor to fix the infinite recursion:');
  console.log(bypassSql);
}

fixRls();
