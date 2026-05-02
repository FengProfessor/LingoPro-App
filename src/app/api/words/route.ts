import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { enrichWord as performAIEnrichment } from '@/lib/ai-enrich';
import { searchImage } from '@/lib/image-search';
import { stabilityToLevel } from '@/lib/srs';

// ── Telegram Helpers ──
async function sendTelegramNotification(userId: string, text: string, imageUrl?: string | null) {
  try {
    const supabase = createServiceClient();
    const { data: profile } = await supabase.from('profiles').select('telegram_id').eq('id', userId).single();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (profile?.telegram_id && botToken) {
      const endpoint = imageUrl 
        ? `https://api.telegram.org/bot${botToken}/sendPhoto` 
        : `https://api.telegram.org/bot${botToken}/sendMessage`;

      const body: any = {
        chat_id: profile.telegram_id,
        parse_mode: 'HTML',
      };

      if (imageUrl) {
        body.photo = imageUrl;
        body.caption = text;
      } else {
        body.text = text;
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return true;
    }
  } catch (err) {
    console.warn('[Telegram] Notification failed:', err);
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Lấy hoặc tạo "personal classroom" của user
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreatePersonalClassroom(supabase: any, userId: string): Promise<string> {
  // 1. Tìm classroom đã tồn tại của user này
  const { data: existing } = await supabase
    .from('classrooms')
    .select('id')
    .eq('teacher_id', userId)
    .eq('name', '__personal__')
    .single();

  if (existing?.id) return existing.id;

  // 2. Tạo mới nếu chưa có
  const { data: created, error } = await supabase
    .from('classrooms')
    .insert({
      teacher_id: userId,
      name: '__personal__',
      description: 'Personal word list',
      invite_code: `P-${userId.slice(0, 8).toUpperCase()}`,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Cannot create personal classroom: ${error.message}`);
  return created.id;
}

/**
 * Background AI enrichment (Internal)
 */
async function enrichWord(wordId: string, originalInput: string, userId: string, customApiKey?: string, dictionaryData?: any, userTargetTranslation?: string) {
  try {
    const parsed = await performAIEnrichment(originalInput, customApiKey, dictionaryData, userTargetTranslation);

    const supabase = createServiceClient();
    const updateData = {
      word: parsed.english,
      translation: parsed.vietnamese,
      ipa: parsed.ipa,
      pos: parsed.pos,
      example: parsed.example,
      synonyms: parsed.synonyms,
      antonyms: parsed.antonyms,
    };

    // ── Global Image Cache & Search ──
    let imageUrl: string | null = null;
    
    const { data: cachedWord } = await supabase
      .from('words')
      .select('image_url')
      .eq('word', parsed.english)
      .not('image_url', 'is', null)
      .limit(1)
      .maybeSingle();

    if (cachedWord?.image_url) {
      imageUrl = cachedWord.image_url;
    } else {
      imageUrl = await searchImage(parsed.english, parsed.image_search_query);
    }

    // Final Update
    await supabase.from('words').update({
      ...updateData,
      image_url: imageUrl
    }).eq('id', wordId);
      
    // ── Stage 2: Rich Follow-up Notification ──
    const richCaption = `🎉 <b>Phân tích hoàn tất!</b>\n\n` +
      `🏷 <b>${parsed.english}</b> (${parsed.pos})\n` +
      `🔊 ${parsed.ipa || ''}\n` +
      `🇻🇳 ${parsed.vietnamese}\n\n` +
      `📝 <i>${parsed.example}</i>`;

    await sendTelegramNotification(userId, richCaption, imageUrl);

  } catch (err: any) {
    console.error(`AI enrichment failed for "${originalInput}":`, err.message);
    try {
      const supabase = createServiceClient();
      await supabase.from('words').update({
        translation: '❌ Analysis failed - click Retry',
      }).eq('id', wordId);
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Lưu từ ngay lập tức, AI enrichment chạy nền
// Body: { word, userId }  hoặc  { word, userId, classroomId }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const word = (body.word || '').trim().slice(0, 100);
    const userId = (body.userId || '').trim();
    let classroomId = (body.classroomId || '').trim();

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Tự động dùng personal classroom nếu không truyền classroomId
    if (!classroomId) {
      classroomId = await getOrCreatePersonalClassroom(supabase, userId);
    }

    // ── Check duplicate (case-insensitive) ──
    const { data: existing } = await supabase
      .from('words')
      .select('id, word, translation')
      .eq('classroom_id', classroomId)
      .ilike('word', word.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: `"${word}" already in your list!`,
        wordId: existing.id,
      });
    }

    // ── Save word immediately (Basic) ──
    const { data, error } = await supabase
      .from('words')
      .insert({
        classroom_id: classroomId,
        added_by: userId,
        word,
        translation: '⏳ Analyzing...',
        source_url: body.sourceUrl || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    // ── Stage 1: Fast Dictionary Lookup (Skip if already provided by Extension) ──
    let dictData: any = null;
    let initialTranslation = body.translation || '⏳ Analyzing...';
    let initialIpa = body.ipa || '';
    let initialPos = body.pos || '';
    
    // Only fetch if data was not manually selected in the extension
    if (initialTranslation === '⏳ Analyzing...') {
      try {
        const dictRes = await fetch(`https://dict.minhqnd.com/api/v1/lookup?word=${encodeURIComponent(word)}&lang=en&def_lang=vi`);
        if (dictRes.ok) {
          dictData = await dictRes.json();
          const actualDictData = dictData?.results?.[0];
          // Extract primary meaning and IPA from the nested data
          if (actualDictData?.meanings?.length > 0) {
            initialIpa = actualDictData.pronunciations?.[0]?.ipa || '';
            initialTranslation = actualDictData.meanings[0].definition || initialTranslation;
            initialPos = actualDictData.meanings[0].pos || '';
          }
        }
      } catch (dictErr) {
        console.warn('[Dictionary API] Failed:', dictErr);
      }
    }

    // Update DB with either manual or fetched data
    await supabase.from('words').update({
      translation: initialTranslation,
      ipa: initialIpa,
      pos: initialPos,
      dictionary_data: dictData
    }).eq('id', data.id);

    // ── Stage 1: Immediate Notification (Basic) ──
    const immediateText = `✅ <b>Đã lưu:</b> <code>${word}</code>\n` +
      `${initialIpa ? `🔊 ${initialIpa}\n` : ''}` +
      `🇻🇳 ${initialTranslation}\n` +
      `<i>Đang phân tích hình ảnh...</i>`;
      
    sendTelegramNotification(userId, immediateText);

    const skipAI = Boolean(body.skipAI);
    if (!skipAI) {
      // ── Background AI Enrichment (Stage 2) ──
      const { data: profile } = await supabase.from('profiles').select('gemini_api_key').eq('id', userId).single();
      enrichWord(data.id, word, userId, profile?.gemini_api_key, dictData, initialTranslation);
    }
    
    return NextResponse.json({
      success: true,
      message: `"${word}" saved!`,
      wordId: data.id,
    });

  } catch (error: any) {
    console.error('POST /api/words Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to save word', details: error.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Lấy từ của user (personal list)
// Query: ?userId=xxx  hoặc  ?classroomId=xxx&userId=xxx
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';
    let classroomId = searchParams.get('classroomId') || '';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Tự động dùng personal classroom
    if (!classroomId) {
      classroomId = await getOrCreatePersonalClassroom(supabase, userId);
    }

    const { data: words, error } = await supabase
      .from('words')
      .select('*, srs_progress(*)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const now = new Date().getTime();
    const enriched = (words || []).map((w: any) => {
      const srs = (w.srs_progress || []).find((s: any) => s.user_id === userId) || null;
      const nextReviewDate = srs?.next_review_date ? new Date(srs.next_review_date).getTime() : now;
      
      // FSRS calculation: Map stability to a virtual Level 1-6
      const stability = srs?.stability || 0;
      const srsLevel = stabilityToLevel(stability);
      const isDue = !srs || nextReviewDate <= now;
      
      return {
        ...w,
        srs,
        isDue,
        reviewCount: srs?.review_count || 0,
        srsLevel, 
        mastery: Math.min(100, srsLevel * 20),
        status: srsLevel >= 5 ? 'mastered' : 'learning',
      };
    });

    return new NextResponse(JSON.stringify({ success: true, data: enriched, classroomId }), {
      headers: { 'Cache-Control': 'no-store, must-revalidate, max-age=0' },
    });
  } catch (error: any) {
    console.error('GET /api/words Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT: Cập nhật nghĩa từ thủ công (Dùng cho tính năng chọn nghĩa)
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const { wordId, translation, pos, ipa } = await req.json();
    if (!wordId) return NextResponse.json({ error: 'wordId is required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('words').update({
      translation,
      pos,
      ipa
    }).eq('id', wordId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { wordId } = await req.json();
    if (!wordId) return NextResponse.json({ error: 'wordId is required' }, { status: 400 });
    const supabase = createServiceClient();
    const { error } = await supabase.from('words').delete().eq('id', wordId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
