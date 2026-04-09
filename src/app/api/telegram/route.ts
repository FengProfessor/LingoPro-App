import { NextResponse } from 'next/server';
import { google } from 'googleapis';

async function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

async function getDueWords() {
  const auth = await getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetName = meta.data.sheets?.[0].properties?.title || 'Sheet1';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:J`,
  });

  const today = new Date().toISOString().split('T')[0];
  const rows = response.data.values || [];
  return rows
    .filter(row => row[0] && (!row[9] || row[9] <= today))
    .slice(0, 5)
    .map(row => ({ word: row[0], translation: row[1], ipa: row[2] }));
}

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required in .env.local');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });
  return res.json();
}

export async function GET() {
  try {
    const dueWords = await getDueWords();
    const count = dueWords.length;

    let message = `📚 <b>LingoPro - Daily Review</b>\n\n`;

    if (count === 0) {
      message += `🎉 You have no words due today. Great job keeping up!\n\nKeep adding new words with the Chrome Extension.`;
    } else {
      message += `🔔 You have <b>${count} word${count > 1 ? 's' : ''}</b> to review today:\n\n`;
      dueWords.forEach((w, i) => {
        message += `${i + 1}. <b>${w.word}</b>`;
        if (w.ipa) message += ` <i>${w.ipa}</i>`;
        if (w.translation) message += `\n    → ${w.translation}`;
        message += `\n\n`;
      });
      message += `👉 Open LingoPro and start reviewing: <a href="http://localhost:3000/flashcard">Start Flashcard</a>`;
    }

    await sendTelegram(message);
    return NextResponse.json({ success: true, sent: count, message });
  } catch (error: any) {
    console.error('Telegram Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also allow POST to trigger manually
export async function POST() {
  return GET();
}
