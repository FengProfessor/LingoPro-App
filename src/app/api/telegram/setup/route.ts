import { NextResponse } from 'next/server';

/**
 * GET /api/telegram/setup
 * Call this once to register your webhook URL with Telegram.
 * Example: https://lingopro-nu.vercel.app/api/telegram/setup
 */
export async function GET(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
  }

  const host = new URL(req.url).origin;
  const webhookUrl = `${host}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      }),
    }
  );

  const data = await res.json();
  return NextResponse.json({
    success: data.ok,
    webhook_url: webhookUrl,
    telegram_response: data,
  });
}
