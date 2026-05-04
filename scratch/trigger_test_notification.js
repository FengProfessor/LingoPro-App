const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function triggerTest() {
  console.log('--- Trình kích hoạt thông báo Test ---');
  
  // 1. Đặt tất cả từ vựng về trạng thái "cần ôn ngay"
  const { error: updateError } = await supabase
    .from('srs_progress')
    .update({ next_review_date: new Date(Date.now() - 1000).toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update all
    
  if (updateError) {
    console.error('Lỗi cập nhật srs:', updateError);
    return;
  }
  console.log('1. Đã đặt tất cả từ vựng vào trạng thái CẦN ÔN TẬP.');

  // 2. Reset watermark trong telegram_sessions để đảm bảo thông báo gửi đi
  const { error: sessionError } = await supabase
    .from('telegram_sessions')
    .update({ session_data: {} })
    .neq('id', -1);
    
  if (sessionError) {
    console.error('Lỗi reset session:', sessionError);
  }
  console.log('2. Đã xóa lịch sử thông báo cũ để kích hoạt lại.');

  console.log('3. Đang gọi API Cron để gửi thông báo...');
  
  // 3. Gọi API Cron
  const response = await fetch('http://localhost:3000/api/cron/telegram-due?secret=lingopro_secret_123');
  const data = await response.json();
  
  console.log('Kết quả API:', data);
  console.log('--------------------------------------');
  console.log('KIỂM TRA IPHONE CỦA BẠN NGAY BÂY GIỜ!');
}

triggerTest();
