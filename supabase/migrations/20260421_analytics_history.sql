-- Phase 2: Analytics History Tracking
-- Create table for daily snapshots

create table if not exists public.student_daily_stats (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  classroom_id uuid references public.classrooms(id) on delete cascade not null,
  vms int not null,
  lcs int not null,
  total_words int not null,
  recorded_at date not null default current_date,
  unique(student_id, recorded_at)
);

-- Enable RLS
alter table public.student_daily_stats enable row level security;

-- Policies: Teachers can view stats for students in their classrooms
create policy "Teachers view trends for their students" on public.student_daily_stats
for select using (
  exists (
    select 1 from public.classrooms c
    where c.id = classroom_id and c.teacher_id = auth.uid()
  )
);

-- Snapshot function: Captures current view state into history table
create or replace function public.snapshot_student_stats()
returns void as $$
begin
  insert into public.student_daily_stats (student_id, classroom_id, vms, lcs, total_words)
  select student_id, classroom_id, vms, lcs, total_words
  from public.student_progress
  on conflict (student_id, recorded_at) 
  do update set 
    vms = excluded.vms,
    lcs = excluded.lcs,
    total_words = excluded.total_words;
end;
$$ language plpgsql security definer;
