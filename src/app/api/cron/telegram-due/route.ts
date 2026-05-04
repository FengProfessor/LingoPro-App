import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/notifications';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Helper: Send Telegram message with optional inline keyboard
async function sendTelegram(chatId: string, text: string, replyMarkup?: object): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('Telegram send error:', err);
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const envSecret = process.env.CRON_SECRET;
    const testSecret = 'lingopro_secret_123';

    const isAuthorized =
      (authHeader === `Bearer ${envSecret}`) ||
      (authHeader === `Bearer ${testSecret}`) ||
      (secret === envSecret) ||
      (secret === testSecret);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, telegram_id')
      .not('telegram_id', 'is', null);

    if (profError) throw profError;
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with telegram_id found', data: [] });
    }

    const now = new Date().toISOString();
    const notifications = [];

    for (const p of profiles) {
      const { data: srsRecords } = await supabase
        .from('srs_progress')
        .select('id, next_review_date')
        .eq('user_id', p.id)
        .lte('next_review_date', now);

      const dueCount = srsRecords?.length || 0;

      // Fetch user's session data to check the latest notified count
      const { data: sessionDataObj } = await supabase
        .from('telegram_sessions')
        .select('session_data')
        .eq('telegram_id', p.telegram_id)
        .single();
      
      const sessionData = sessionDataObj?.session_data || {};
      const lastNotifiedCount = sessionData.last_notified_count || 0;
      const lastNotifiedTime = sessionData.last_notified_time || 0;
      
      const hoursSinceLast = lastNotifiedTime ? (Date.now() - new Date(lastNotifiedTime).getTime()) / (1000 * 60 * 60) : 100;

      // Anti-spam: Do NOT notify if the user is currently in a quiz
      if (sessionData.state === 'quiz') {
        continue;
      }

      // Notify if:
      // 1. More words are due than last time (New words hit the bucket)
      // 2. OR enough time has passed (6 hours) and there are still words due
      const shouldNotify = (dueCount > lastNotifiedCount) || (dueCount > 0 && hoursSinceLast >= 6);

      if (shouldNotify) {
        // A new word became due (bucket expired) OR it's a daily reminder
        const firstName = p.full_name?.split(' ').pop() || 'bạn';

        const message =
          `⏰ <b>Thời Điểm Vàng!</b>\n\n` +
          `Xin chào <b>${firstName}</b>! Hiện tại bạn đang có <b>${dueCount} từ</b> cần ôn.\n\n` +
          `Hãy ôn ngay để không bị quên nhé 👇`;

        const options = [5, 10, 20].filter(n => n < dueCount);
        const keyboard = {
          inline_keyboard: [
            ...options.map(n => [{ text: `▶️ Ôn ${n} từ`, callback_data: `start_quiz_${n}` }]),
            [{ text: `📚 Ôn tất cả (${dueCount} từ)`, callback_data: `start_quiz_${dueCount}` }],
          ],
        };

        const sent = await sendTelegram(p.telegram_id, message, keyboard);
        
        // Also send Push Notification via OneSignal
        try {
          await sendPushNotification(
            '⏰ Thời Điểm Vàng!',
            `Chào ${firstName}, bạn có ${dueCount} từ cần ôn tập. Hãy ôn ngay nhé!`,
            '/quiz'
          );
        } catch (err) {
          console.error('OneSignal send error:', err);
        }

        // Update watermark
        sessionData.last_notified_count = dueCount;
        sessionData.last_notified_time = new Date().toISOString();
        await supabase.from('telegram_sessions').upsert({
          telegram_id: p.telegram_id,
          user_id: p.id,
          session_data: sessionData
        }, { onConflict: 'telegram_id' });

        notifications.push({
          user_id: p.id,
          full_name: p.full_name,
          telegram_id: p.telegram_id,
          due_count: dueCount,
          sent,
        });
      } else if (dueCount < lastNotifiedCount) {
        // User studied some words, silently lower the watermark so next time a word drops, it flags as > lastNotifiedCount
        sessionData.last_notified_count = dueCount;
        await supabase.from('telegram_sessions').upsert({
          telegram_id: p.telegram_id,
          user_id: p.id,
          session_data: sessionData
        }, { onConflict: 'telegram_id' });
      }
    }

    return NextResponse.json({ 
      success: true, 
      sent_count: notifications.filter(n => n.sent).length,
      total_due: notifications.length,
      data: notifications 
    });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
