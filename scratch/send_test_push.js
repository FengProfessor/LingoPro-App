const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

async function sendTestPush() {
  console.log('--- Đang gửi thông báo Test qua OneSignal ---');
  
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('Lỗi: Thiếu App ID hoặc API Key trong .env.local');
    return;
  }

  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { en: '🚀 LingoPro Test!' },
        contents: { en: 'Thông báo chuyên nghiệp của bạn đã sẵn sàng. Chúc mừng!' },
        url: 'https://lingopro-nu.vercel.app/quiz',
      },
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );
    console.log('Kết quả từ OneSignal:', response.data);
    console.log('------------------------------------------');
    console.log('KIỂM TRA IPHONE CỦA BẠN NGAY!');
  } catch (error) {
    console.error('Lỗi khi gửi thông báo:', error.response?.data || error.message);
  }
}

sendTestPush();
