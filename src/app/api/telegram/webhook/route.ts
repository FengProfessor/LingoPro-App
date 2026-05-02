export const runtime = 'edge';
export const preferredRegion = 'sin1'; // Singapore region for lowest latency to Vietnam

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { calculateNextReview, mapQualityToRating } from '@/lib/srs';
import { enrichWord as performAIEnrichment } from '@/lib/ai-enrich';
import { searchImage } from '@/lib/image-search';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface WordData {
  id: string;
  word: string;
  translation: string;
  ipa?: string;
  pos?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
  image_url?: string;
  reviewCount: number;
  distractors?: string[];
}

// ─── Telegram API helpers ────────────────────────────────────────────────────

async function sendMessage(chatId: string | number, text: string, extra: object = {}) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}

async function sendPhoto(chatId: string | number, photoUrl: string, extra: object = {}) {
  await fetch(`${API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, parse_mode: 'HTML', ...extra }),
  });
}

async function sendVoice(chatId: string | number, voiceUrl: string, extra: object = {}) {
  await fetch(`${API}/sendVoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, voice: voiceUrl, disable_notification: true, ...extra }),
  });
}

/** Parse IPA from raw JSON string or plain text */
function parseIpa(raw?: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    // Prefer UK, fallback US, fallback first value
    return parsed.uk || parsed.us || Object.values(parsed)[0] as string || raw;
  } catch {
    return raw; // already plain text
  }
}

async function editMessage(chatId: string | number, messageId: number, text: string, extra: object = {}) {
  await fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }),
  });
}

async function editMessageCaption(chatId: string | number, messageId: number, caption: string, extra: object = {}) {
  await fetch(`${API}/editMessageCaption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption, parse_mode: 'HTML', ...extra }),
  });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ─── Session helpers ─────────────────────────────────────────────────────────

async function getSession(supabase: any, telegramId: string) {
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  return data;
}

async function saveSession(supabase: any, telegramId: string, userId: string | null, sessionData: object) {
  await supabase.from('telegram_sessions').upsert(
    { telegram_id: telegramId, user_id: userId, session_data: sessionData, updated_at: new Date().toISOString() },
    { onConflict: 'telegram_id' }
  );
}

async function clearSession(supabase: any, telegramId: string) {
  await supabase.from('telegram_sessions')
    .update({ session_data: {} })
    .eq('telegram_id', telegramId);
}

// ─── Quiz helpers ─────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** Get due words for a user (includes new words and words with SRS records) */
async function getDueWords(supabase: any, userId: string, limit: number) {
  // 1. Fetch personal classroom ID
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id')
    .eq('teacher_id', userId)
    .eq('name', '__personal__')
    .single();

  if (!classroom) return [];

  // 2. Call the server-side RPC for 100% accuracy
  const { data: words, error } = await supabase.rpc('get_due_words_list', {
    p_user_id: userId,
    p_classroom_id: classroom.id,
    p_limit: limit
  });

  if (error || !words) {
    console.error('RPC get_due_words_list failed:', error?.message);
    return [];
  }

  return words.filter((w: any) => w.translation && !w.translation.toLowerCase().includes('failed')); 
}

/** Build 4 choices: 1 correct + 3 random distractors */
async function buildChoices(supabase: any, correctWord: any, allWords: any[]) {
  // Use other words in queue as distractors first
  let distractors = allWords
    .filter(w => w.id !== correctWord.id && w.translation)
    .map(w => w.translation);

  // If not enough, fetch random words from DB
  if (distractors.length < 3) {
    const { data: extras } = await supabase
      .from('words')
      .select('translation')
      .neq('id', correctWord.id)
      .not('translation', 'is', null)
      .limit(20);
    if (extras) {
      distractors = [...distractors, ...extras.map((e: any) => e.translation)];
    }
  }

  // Pick 3 unique distractors
  const uniqueDistractors = shuffleArray([...new Set(distractors)]).slice(0, 3);
  const choices = shuffleArray([correctWord.translation, ...uniqueDistractors]);

  return {
    choices, // Array of 4 strings
    correctIndex: choices.indexOf(correctWord.translation),
  };
}

function formatCloze(sentence: string, word: string): string {
  if (!sentence) return '';
  // Case insensitive match for the word, replacing with underscores
  // Escaping regex special characters if any
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
  const cloze = sentence.replace(regex, () => '<u>______</u>');
  
  // If no replacement happened (e.g. word is inflected like 'oceans'), 
  // try a simpler replacement for any occurrence of the word
  if (cloze === sentence) {
    const simpleRegex = new RegExp(escapedWord, 'gi');
    return sentence.replace(simpleRegex, '<u>______</u>');
  }
  return cloze;
}

/** Send a quiz question */
async function sendQuestion(chatId: string | number, session: any) {
  const { word_queue, current_index, words, correct, wrong } = session;
  const total = word_queue.length;
  const currentWordData = words[current_index];

  if (!currentWordData) return;

  // Background check for missing data (POS/Example) - if missing, trigger a background enrichment if possible
  // For now, we just ensure it displays nicely even with missing data.

  const labels = ['A', 'B', 'C', 'D'];
  const { choices, correctIndex } = await buildChoicesFromData(currentWordData);

  // Save choices into session for validation on answer
  session.choices = choices;
  session.correct_index = correctIndex;
  session.current_word = currentWordData;

  const progress = `Từ <b>${current_index + 1}/${total}</b> | ✅ ${correct} ❌ ${wrong}`;
  const posTag = currentWordData.pos ? ` <i>(${currentWordData.pos})</i>` : '';
  const question = `\n\n🔤 <b>${currentWordData.word.toUpperCase()}</b>${posTag}`;
  const voiceUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(currentWordData.word)}&tl=en&client=tw-ob`;
  const ipaText = parseIpa(currentWordData.ipa);
  const ipa = ipaText ? `\n<code>${ipaText}</code> <a href="${voiceUrl}">🔊</a>` : '';
  
  let cloze = '';
  if (currentWordData.example) {
    const hidden = formatCloze(currentWordData.example, currentWordData.word);
    cloze = `\n\n📝 <i>${hidden}</i>`;
  }

  const text = `${progress}${question}${ipa}${cloze}\n\nNghĩa của từ này là gì?`;

  const keyboard = choices.map((c: string, i: number) => [{
    text: `${labels[i]}. ${c}`,
    callback_data: `ans_${i}`,
  }]);

  if (currentWordData.image_url) {
    await sendPhoto(chatId, currentWordData.image_url, { caption: text, reply_markup: { inline_keyboard: keyboard } });
  } else {
    await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  }

  // Also send voice message for immediate playback (silent notification)
  try {
    await sendVoice(chatId, voiceUrl);
  } catch (err) {
    console.error('Failed to send voice message:', err);
  }

  return { choices, correctIndex };
}

async function buildChoicesFromData(wordData: any) {
  // Choices were already computed and stored; rebuild from wordData.choices if available
  const correct = wordData.translation;
  const distractors = wordData.distractors || [];
  const all = shuffleArray([correct, ...distractors.slice(0, 3)]);
  return { choices: all, correctIndex: all.indexOf(correct) };
}

// ─── User lookup ──────────────────────────────────────────────────────────────

async function findUserByTelegramId(supabase: any, telegramId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_id', telegramId)
    .single();
  return data;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleStart(supabase: any, chatId: string, telegramId: string) {
  const user = await findUserByTelegramId(supabase, telegramId);
  if (!user) {
    await sendMessage(chatId,
      '👋 Chào mừng đến với <b>LingoPro Bot</b>!\n\n' +
      'Để sử dụng bot, bạn cần liên kết tài khoản:\n' +
      '1. Vào <a href="https://lingopro-nu.vercel.app/profile">Profile</a> trên web\n' +
      '2. Nhập Telegram ID của bạn: <code>' + telegramId + '</code>\n' +
      '3. Nhắn /start lại ở đây'
    );
    return;
  }

  // Check due words (Using the RPC for 100% sync)
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('name', '__personal__')
    .single();

  let dueCount = 0;
  if (classroom) {
    const { data: count, error: countErr } = await supabase.rpc('get_due_word_count', {
      p_user_id: user.id,
      p_classroom_id: classroom.id
    });
    if (!countErr) dueCount = count || 0;
  }

  if (dueCount === 0) {
    await sendMessage(chatId,
      `🎉 Xin chào <b>${user.full_name?.split(' ')[0]}</b>!\n\n` +
      `Bạn không có từ nào cần ôn tập lúc này.\n` +
      `Hãy quay lại sau nhé! ⏰`
    );
    return;
  }

  const options = [5, 10, 20].filter(n => n <= dueCount);
  const keyboard = [
    ...options.map(n => [{ text: `▶️ Ôn ${n} từ`, callback_data: `start_quiz_${n}` }]),
    [{ text: `📚 Tất cả (${dueCount} từ)`, callback_data: `start_quiz_${dueCount}` }],
  ];

  await sendMessage(chatId,
    `👋 Xin chào <b>${user.full_name?.split(' ')[0]}</b>!\n\n` +
    `📊 Bạn có <b>${dueCount} từ</b> cần ôn tập.\n\n` +
    `Bạn muốn ôn bao nhiêu từ?`,
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

async function handleStartQuiz(supabase: any, chatId: string, telegramId: string, msgId: number, count: number) {
  const user = await findUserByTelegramId(supabase, telegramId);
  if (!user) return;

  const dueWords = await getDueWords(supabase, user.id, count);
  if (dueWords.length === 0) {
    await editMessage(chatId, msgId, '✅ Không có từ nào cần ôn tập lúc này!');
    return;
  }

  // 2. Precompute distractors AND track words that need "Self-Healing" data
  const enrichmentPromises: Promise<any>[] = [];

  // Fetch student's custom API key if available
  const { data: profile } = await supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single();
  const customApiKey = profile?.gemini_api_key;

  for (const word of dueWords as WordData[]) {
    // Self-Healing: If example, pos, or image is missing, enrich it now!
    if (!word.example || !word.pos || !word.image_url) {
      const p = (async () => {
        try {
          // 1. AI Enrichment if text data missing
          if (!word.example || !word.pos) {
            const parsed = await performAIEnrichment(word.word, customApiKey);
            word.example = parsed.example;
            word.pos = parsed.pos;
            word.ipa = parsed.ipa;
            word.synonyms = parsed.synonyms;
            word.antonyms = parsed.antonyms;
            word.translation = parsed.vietnamese;
          }

          // 2. Image Enrichment if missing
          if (!word.image_url) {
            // Check Global Cache first
            const { data: cached } = await supabase.from('words').select('image_url').eq('word', word.word).not('image_url', 'is', null).limit(1).maybeSingle();
            if (cached?.image_url) {
              word.image_url = cached.image_url;
              console.log(`✓ Reusing cached image for "${word.word}" in Self-Healing`);
            } else {
              word.image_url = (await searchImage(word.word)) || undefined;
            }
          }

          // 3. Update DB
          await supabase.from('words').update({
            example: word.example,
            pos: word.pos,
            ipa: word.ipa,
            synonyms: word.synonyms,
            antonyms: word.antonyms,
            image_url: word.image_url,
            translation: word.translation
          }).eq('id', word.id);
        } catch (err) {
          console.error(`Self-healing failed for "${word.word}":`, err);
        }
      })();
      enrichmentPromises.push(p);
    }
  }

  // Await all enrichments (parallel) so the session has the best data
  if (enrichmentPromises.length > 0) {
    await Promise.all(enrichmentPromises);
  }

  // 3. Precompute distractors using FINAL enriched data
  const wordsWithDistractors: WordData[] = [];
  for (const word of dueWords as WordData[]) {
    let others = (dueWords as WordData[])
      .filter((w: WordData) => w.id !== word.id && w.translation && !w.translation.toLowerCase().includes('failed'))
      .map((w: WordData) => w.translation);
    
    if (others.length < 3) {
      const { data: extras } = await supabase
        .from('words')
        .select('translation')
        .neq('id', word.id)
        .not('translation', 'is', null)
        .limit(10);
      if (extras) others = [...others, ...extras.map((e: any) => e.translation)];
    }
    wordsWithDistractors.push({ ...word, distractors: shuffleArray([...new Set(others)]) });
  }

  const session = {
    state: 'quiz',
    user_id: user.id,
    word_queue: (dueWords as WordData[]).map((w: WordData) => w.id),
    words: wordsWithDistractors,
    current_index: 0,
    correct: 0,
    wrong: 0,
    choices: [] as string[],
    correct_index: -1,
    current_word: null as WordData | null,
    last_notified_count: dueWords.length,
  };

  await saveSession(supabase, telegramId, user.id, session);

  // Edit original message to remove keyboard
  await editMessage(chatId, msgId, `✅ Bắt đầu ôn <b>${dueWords.length} từ</b>! Chúc bạn học tốt! 🚀`);

  // Send first question
  const { choices, correctIndex } = await sendQuestion(chatId, session) || {};

  // Update session with choices
  session.choices = choices || [];
  session.correct_index = correctIndex ?? -1;
  await saveSession(supabase, telegramId, user.id, session);
}

async function handleAnswer(supabase: any, chatId: string, telegramId: string, msgId: number, callbackId: string, answerIndex: number) {
  const sessionRecord = await getSession(supabase, telegramId);
  if (!sessionRecord || !sessionRecord.session_data?.state) {
    await answerCallback(callbackId, '⚠️ Không tìm thấy phiên ôn tập. Hãy nhắn /start');
    return;
  }

  const session = sessionRecord.session_data;
  const { choices, correct_index, current_word, current_index, word_queue, correct, wrong, user_id } = session;
  const labels = ['A', 'B', 'C', 'D'];

  const isCorrect = answerIndex === correct_index;
  const quality = isCorrect ? 4 : 0; // Good (4) or Forgot (0)
  
  const updatedCorrect = correct + (isCorrect ? 1 : 0);
  const updatedWrong = wrong + (isCorrect ? 0 : 1);
  const nextIndex = current_index + 1;
  const isLast = nextIndex >= word_queue.length;

  const resultEmoji = isCorrect ? '✅' : '❌';
  const resultText = isCorrect
    ? `${resultEmoji} <b>Đúng rồi!</b>`
    : `${resultEmoji} <b>Sai!</b> Đáp án đúng là: <b>${labels[correct_index]}. ${choices[correct_index]}</b>`;

  const choicesText = choices.map((c: string, i: number) =>
    i === correct_index ? `<b>${labels[i]}. ${c} ✓</b>` : `${labels[i]}. ${c}`
  ).join('\n');

  const progress = `Từ <b>${current_index + 1}/${word_queue.length}</b> | ✅ ${updatedCorrect} ❌ ${updatedWrong}`;
  const posTag = current_word.pos ? ` <i>(${current_word.pos})</i>` : '';
  const wordText = `\n\n🔤 <b>${current_word.word.toUpperCase()}</b>${posTag}`;
  const voiceUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(current_word.word)}&tl=en&client=tw-ob`;
  const ipaTextAnswer = parseIpa(current_word.ipa);
  const ipa = ipaTextAnswer ? `\n<code>${ipaTextAnswer}</code> <a href="${voiceUrl}">🔊</a>` : '';
  
  let exampleFeedback = '';
  if (current_word.example) {
    const regex = new RegExp(`\\b${current_word.word}\\b`, 'gi');
    const bolded = current_word.example.replace(regex, (match: string) => `<b>${match}</b>`);
    exampleFeedback = `\n\n📝 <i>${bolded}</i>`;
  }

  let extraInfo = '';
  if (current_word.synonyms?.length) {
    extraInfo += `\n\n<b>≈ Đồng nghĩa:</b> ${current_word.synonyms.join(', ')}`;
  }
  if (current_word.antonyms?.length) {
    extraInfo += `\n<b>≠ Trái nghĩa:</b> ${current_word.antonyms.join(', ')}`;
  }

  const resultMsg = `${progress}${wordText}${ipa}${exampleFeedback}${extraInfo}\n\n${resultText}\n\n${choicesText}`;

  // 1. FAST PATH: Update UI in Telegram immediately
  const uiPromises: Promise<any>[] = [
    answerCallback(callbackId)
  ];
  
  // Pre-update session state
  session.correct = updatedCorrect;
  session.wrong = updatedWrong;
  session.current_index = nextIndex;

  if (isLast) {
    const nextKeyboard = [[{ text: '📊 Xem kết quả', callback_data: 'finish_quiz' }]];
    if (current_word.image_url) {
      uiPromises.push(editMessageCaption(chatId, msgId, resultMsg, { reply_markup: { inline_keyboard: nextKeyboard } }));
    } else {
      uiPromises.push(editMessage(chatId, msgId, resultMsg, { reply_markup: { inline_keyboard: nextKeyboard } }));
    }
  } else {
    // Show correct answer for current question, remove buttons
    if (current_word.image_url) {
      uiPromises.push(editMessageCaption(chatId, msgId, resultMsg, { reply_markup: { inline_keyboard: [] } }));
    } else {
      uiPromises.push(editMessage(chatId, msgId, resultMsg, { reply_markup: { inline_keyboard: [] } }));
    }
    
    // Send next question immediately below it
    uiPromises.push(
      sendQuestion(chatId, session).then((res) => {
        if (res) {
          session.choices = res.choices;
          session.correct_index = res.correctIndex;
        }
      })
    );
  }

  const uiUpdatePromise = Promise.all(uiPromises);

  // 2. SLOW PATH: Database operations
  // Calculate next SRS date using FSRS v5
  const { data: existing } = await supabase
    .from('srs_progress')
    .select('*')
    .eq('user_id', user_id)
    .eq('word_id', current_word.id)
    .single();

  const currentSRS = existing
    ? { 
        stability: Number(existing.stability) || Number(existing.interval_days) || 0,
        difficulty: Number(existing.difficulty) || 5,
        interval: existing.interval_days,
        reviewCount: existing.review_count, 
        nextReviewDate: existing.next_review_date,
        lastReviewDate: existing.last_reviewed_at || existing.created_at
      }
    : { 
        stability: 0, 
        difficulty: 0, 
        interval: 0, 
        reviewCount: 0, 
        nextReviewDate: new Date().toISOString(),
        lastReviewDate: new Date().toISOString()
      };

  // Map Telegram quality (0, 4) to FSRS rating (1, 3)
  const fsrsRating = mapQualityToRating(quality);
  const newSRS = calculateNextReview(currentSRS, fsrsRating);

  // Execute UI update and DB saves at the same time
  await Promise.all([
    uiUpdatePromise,
    supabase.from('srs_progress').upsert({
      user_id,
      word_id: current_word.id,
      stability: newSRS.stability,
      difficulty: newSRS.difficulty,
      interval_days: newSRS.interval,
      review_count: newSRS.reviewCount,
      next_review_date: newSRS.nextReviewDate,
      last_reviewed_at: new Date().toISOString(),
      algorithm_version: 'fsrs-v5-telegram',
    }, { onConflict: 'user_id,word_id' }),
    saveSession(supabase, telegramId, user_id, session)
  ]);
}

async function handleNextWord(supabase: any, chatId: string, telegramId: string, msgId: number, callbackId: string) {
  const sessionRecord = await getSession(supabase, telegramId);
  if (!sessionRecord?.session_data?.state) return;

  const session = sessionRecord.session_data;

  // Edit the "next word" button away
  await answerCallback(callbackId);

  // Send next question
  const result = await sendQuestion(chatId, session);
  if (result) {
    session.choices = result.choices;
    session.correct_index = result.correctIndex;
    await saveSession(supabase, telegramId, session.user_id, session);
  }
}

async function handleFinish(supabase: any, chatId: string, telegramId: string, msgId: number, callbackId: string) {
  const sessionRecord = await getSession(supabase, telegramId);
  if (!sessionRecord?.session_data) return;

  const { correct, wrong, word_queue } = sessionRecord.session_data;
  const total = word_queue.length;
  const accuracy = Math.round((correct / total) * 100);

  const emoji = accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪';

  const summary =
    `${emoji} <b>Hoàn thành phiên ôn tập!</b>\n\n` +
    `📊 Kết quả:\n` +
    `✅ Đúng: <b>${correct}/${total}</b>\n` +
    `❌ Sai: <b>${wrong}/${total}</b>\n` +
    `🎯 Độ chính xác: <b>${accuracy}%</b>\n\n` +
    (accuracy < 80
      ? `💡 Hãy tiếp tục luyện tập để cải thiện!\n`
      : `🌟 Tuyệt vời! Hãy duy trì phong độ này!\n`) +
    `\n👉 <a href="https://lingopro-nu.vercel.app/student">Xem tiến độ trên web</a>`;

  const lastWord = sessionRecord.session_data?.current_word;
  const finishKeyboard = { reply_markup: { inline_keyboard: [[{ text: '🔄 Ôn tiếp', callback_data: 'go_start' }]] } };
  if (lastWord?.image_url) {
    await editMessageCaption(chatId, msgId, summary, finishKeyboard);
  } else {
    await editMessage(chatId, msgId, summary, finishKeyboard);
  }
  await answerCallback(callbackId);
  await clearSession(supabase, telegramId);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    // Handle callback queries (button presses)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id);
      const telegramId = String(cb.from.id);
      const msgId = cb.message.message_id;
      const data = cb.data as string;

      if (data === 'go_start') {
        await answerCallback(cb.id);
        await handleStart(supabase, chatId, telegramId);
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('start_quiz_')) {
        const count = parseInt(data.replace('start_quiz_', ''));
        await handleStartQuiz(supabase, chatId, telegramId, msgId, count);
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('ans_')) {
        const idx = parseInt(data.replace('ans_', ''));
        await handleAnswer(supabase, chatId, telegramId, msgId, cb.id, idx);
        return NextResponse.json({ ok: true });
      }

      if (data === 'next_word') {
        await handleNextWord(supabase, chatId, telegramId, msgId, cb.id);
        return NextResponse.json({ ok: true });
      }

      if (data === 'finish_quiz') {
        await handleFinish(supabase, chatId, telegramId, msgId, cb.id);
        return NextResponse.json({ ok: true });
      }

      await answerCallback(cb.id);
      return NextResponse.json({ ok: true });
    }

    // Handle text messages
    if (body.message) {
      const msg = body.message;
      const chatId = String(msg.chat.id);
      const telegramId = String(msg.from.id);
      const text = msg.text || '';

      if (text.startsWith('/start')) {
        await handleStart(supabase, chatId, telegramId);
      } else if (text === '/help') {
        await sendMessage(chatId,
          '📚 <b>LingoPro Bot - Hướng dẫn</b>\n\n' +
          '/start - Bắt đầu ôn tập\n' +
          '/help - Xem hướng dẫn\n\n' +
          'Bot sẽ tự động nhắc bạn khi có từ cần ôn tập!'
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 200 }); // Always 200 for Telegram
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook is active' });
}
