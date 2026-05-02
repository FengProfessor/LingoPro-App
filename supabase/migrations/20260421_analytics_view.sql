-- Upgrade student_progress view for Teacher Analytics
-- Calculates VMS (Mastery) and LCS (Consistency)

drop view if exists public.student_progress;

create or replace view public.student_progress as
with stats as (
  select 
    p.id as student_id,
    p.full_name as student_name,
    p.email,
    e.classroom_id,
    count(distinct sp.word_id) as total_words,
    -- VMS: Những từ có độ bền vững cao (stability > 15 ngày)
    count(distinct case when sp.stability > 15 then sp.word_id end) as mastered_words,
    -- LCS: Đếm số ngày hoạt động trong 14 ngày qua
    count(distinct date(sp.last_reviewed_at)) filter (where sp.last_reviewed_at > (now() - interval '14 days')) as active_days_14,
    avg(qr.accuracy) as avg_quiz_accuracy,
    count(distinct qr.id) as quizzes_taken,
    max(sp.last_reviewed_at) as last_active
  from public.profiles p
  join public.enrollments e on e.student_id = p.id
  left join public.words w on w.classroom_id = e.classroom_id
  left join public.srs_progress sp on sp.word_id = w.id and sp.user_id = p.id
  left join public.quiz_results qr on qr.user_id = p.id and qr.classroom_id = e.classroom_id
  group by p.id, p.full_name, p.email, e.classroom_id
)
select 
  *,
  case when total_words > 0 then round((mastered_words::float / total_words::float) * 100) else 0 end as vms,
  round((active_days_14::float / 14.0) * 100) as lcs
from stats;
