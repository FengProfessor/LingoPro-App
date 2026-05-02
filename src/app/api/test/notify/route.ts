import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

async function sendTelegram(chatId: string, text: string): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN is missing' };
  
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  return handleNotify(userId);
}

export async function POST(req: Request) {
  const { userId } = await req.json();
  return handleNotify(userId);
}

async function handleNotify(userId: string | null) {
  try {
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const supabase = createServiceClient();
    const { data: p, error } = await supabase
      .from('profiles')
      .select('telegram_id, full_name')
      .eq('id', userId)
      .single();

    if (error || !p?.telegram_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'User has no telegram_id set in profile',
        profile: p 
      });
    }

    const testMsg = `🔔 <b>TEST THÀNH CÔNG!</b>\n\nChào <b>${p.full_name}</b>,\nĐây là tin nhắn thử nghiệm từ hệ thống LingoPro.\n\nThông báo SRS của bạn sẽ được gửi về đây khi có từ vựng đến hạn!`;
    
    const result = await sendTelegram(p.telegram_id, testMsg);

    return NextResponse.json({ 
      success: result.ok, 
      telegram_response: result,
      telegram_id: p.telegram_id 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
