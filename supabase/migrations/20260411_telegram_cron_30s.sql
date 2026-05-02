-- 1. Dọn dẹp các job cũ (nếu có) để tránh chạy trùng
DO $$
BEGIN
    PERFORM cron.unschedule(jobid) 
    FROM cron.job 
    WHERE jobname LIKE 'telegram_due_30s_%';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. JOB A: Chạy ngay lập tức ở giây thứ 0 mỗi phút
SELECT cron.schedule(
  'telegram_due_30s_A',
  '* * * * *',
  $$
    SELECT net.http_get(
      url:='https://lingopro-nu.vercel.app/api/cron/telegram-due?secret=lingopro_secret_123',
      headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);

-- 3. JOB B: Chờ 30 giây rồi mới chạy (Tạo ra chu kỳ 30s)
SELECT cron.schedule(
  'telegram_due_30s_B',
  '* * * * *',
  $$
    SELECT pg_sleep(30); -- Nghỉ 30 giây
    SELECT net.http_get(
      url:='https://lingopro-nu.vercel.app/api/cron/telegram-due?secret=lingopro_secret_123',
      headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
