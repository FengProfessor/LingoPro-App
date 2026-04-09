-- LingoPro EdTech SaaS - Supabase Schema
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. SETUP & EXTENSIONS
-- =============================================
create extension if not exists "uuid-ossp";

-- =============================================
-- 2. TABLE DEFINITIONS (Order by dependencies)
-- =============================================

-- PROFILES (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'student' check (role in ('teacher', 'student')),
  created_at timestamptz default now()
);

-- CLASSROOMS
create table if not exists public.classrooms (
  id uuid default uuid_generate_v4() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  invite_code text unique not null default upper(substring(md5(random()::text), 1, 6)),
  created_at timestamptz default now()
);

-- ENROLLMENTS
create table if not exists public.enrollments (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  classroom_id uuid references public.classrooms(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(student_id, classroom_id)
);

-- WORDS
create table if not exists public.words (
  id uuid default uuid_generate_v4() primary key,
  classroom_id uuid references public.classrooms(id) on delete cascade not null,
  added_by uuid references public.profiles(id),
  word text not null,
  translation text,
  ipa text,
  pos text,
  example text,
  source_url text,
  created_at timestamptz default now()
);

-- SRS PROGRESS
create table if not exists public.srs_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  word_id uuid references public.words(id) on delete cascade not null,
  ease_factor float default 2.5,
  interval_days int default 1,
  review_count int default 0,
  next_review_date date default current_date + 1,
  last_reviewed_at timestamptz,
  unique(user_id, word_id)
);

-- QUIZ RESULTS
create table if not exists public.quiz_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  classroom_id uuid references public.classrooms(id) on delete cascade not null,
  quiz_type text default 'vocabulary' check (quiz_type in ('vocabulary', 'grammar')),
  score int not null,
  total_questions int not null,
  accuracy float generated always as (score::float / total_questions) stored,
  completed_at timestamptz default now()
);

-- GRAMMAR EXERCISES
create table if not exists public.grammar_exercises (
  id uuid default uuid_generate_v4() primary key,
  classroom_id uuid references public.classrooms(id) on delete cascade not null,
  topic text not null,
  level text default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  question text not null,
  options text[] not null,
  correct_answer text not null,
  explanation text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- GRAMMAR RESULTS
create table if not exists public.grammar_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exercise_id uuid references public.grammar_exercises(id) on delete cascade not null,
  chosen_answer text not null,
  is_correct boolean default false,
  time_taken_ms int,
  completed_at timestamptz default now()
);

-- Function to automatically check grammar answer
create or replace function public.check_grammar_answer()
returns trigger as $$
begin
  select (ge.correct_answer = new.chosen_answer) into new.is_correct
  from public.grammar_exercises ge
  where ge.id = new.exercise_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for checking answer
drop trigger if exists on_grammar_result_inserted on public.grammar_results;
create trigger on_grammar_result_inserted
  before insert on public.grammar_results
  for each row execute procedure public.check_grammar_answer();


-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =============================================
alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.enrollments enable row level security;
alter table public.words enable row level security;
alter table public.srs_progress enable row level security;
alter table public.quiz_results enable row level security;
alter table public.grammar_exercises enable row level security;
alter table public.grammar_results enable row level security;

-- =============================================
-- 4. FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Re-create trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- 5. POLICIES (All tables must exist now)
-- =============================================

-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Everyone can view profiles" on public.profiles for select using (true);

-- Classrooms
create policy "Teachers manage own classrooms" on public.classrooms for all using (auth.uid() = teacher_id);
create policy "Students can view joined classrooms" on public.classrooms for select using (
  exists (select 1 from public.enrollments e where e.classroom_id = id and e.student_id = auth.uid())
);

-- Enrollments
create policy "Students manage own enrollments" on public.enrollments for all using (auth.uid() = student_id);
create policy "Teachers view their class enrollments" on public.enrollments for select using (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
);

-- Words
create policy "Teachers manage classroom words" on public.words for all using (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
);
create policy "Students view classroom words" on public.words for select using (
  exists (select 1 from public.enrollments e where e.classroom_id = classroom_id and e.student_id = auth.uid())
);

-- SRS Progress
create policy "Users manage own SRS progress" on public.srs_progress for all using (auth.uid() = user_id);
create policy "Teachers view student SRS progress" on public.srs_progress for select using (
  exists (
    select 1 from public.words w
    join public.classrooms c on c.id = w.classroom_id
    where w.id = word_id and c.teacher_id = auth.uid()
  )
);

-- Quiz Results
create policy "Students manage own quiz results" on public.quiz_results for all using (auth.uid() = user_id);
create policy "Teachers view class quiz results" on public.quiz_results for select using (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
);

-- Grammar Exercises
create policy "Teachers manage grammar exercises" on public.grammar_exercises for all using (
  exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
);
create policy "Students view classroom grammar" on public.grammar_exercises for select using (
  exists (select 1 from public.enrollments e where e.classroom_id = classroom_id and e.student_id = auth.uid())
);

-- Grammar Results
create policy "Students manage own grammar results" on public.grammar_results for all using (auth.uid() = user_id);
create policy "Teachers view grammar results" on public.grammar_results for select using (
  exists (
    select 1 from public.grammar_exercises ge
    join public.classrooms c on c.id = ge.classroom_id
    where ge.id = exercise_id and c.teacher_id = auth.uid()
  )
);

-- =============================================
-- 6. VIEWS
-- =============================================
create or replace view public.student_progress as
select
  p.id as student_id,
  p.full_name as student_name,
  p.email,
  e.classroom_id,
  count(distinct sp.word_id) as words_reviewed,
  avg(sp.review_count) as avg_review_count,
  count(distinct qr.id) as quizzes_taken,
  avg(qr.accuracy) as avg_quiz_accuracy,
  max(sp.last_reviewed_at) as last_active
from public.profiles p
join public.enrollments e on e.student_id = p.id
left join public.words w on w.classroom_id = e.classroom_id
left join public.srs_progress sp on sp.word_id = w.id and sp.user_id = p.id
left join public.quiz_results qr on qr.user_id = p.id and qr.classroom_id = e.classroom_id
group by p.id, p.full_name, p.email, e.classroom_id;
