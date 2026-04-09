import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { enrichWord as performAIEnrichment } from '@/lib/ai-enrich';

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
 * Background AI enrichment
 */
async function enrichWord(wordId: string, originalInput: string) {
  try {
    const parsed = await performAIEnrichment(originalInput);

    const supabase = createServiceClient();
    const { error } = await supabase.from('words').update({
      word: parsed.english,
      translation: parsed.vietnamese,
      ipa: parsed.ipa,
      pos: parsed.pos,
      example: parsed.example,
      synonyms: parsed.synonyms,
      antonyms: parsed.antonyms,
    }).eq('id', wordId);
    
    if (error) console.error(`DB update failed for word "${originalInput}":`, error.message);
    else console.log(`✓ AI enriched with synonyms/antonyms: "${originalInput}" → EN: "${parsed.english}" / VI: "${parsed.vietnamese}"`);
  } catch (err: any) {
    console.error(`AI enrichment failed for word "${originalInput}":`, err.message);
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

    // ── Save word immediately ──
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

    const skipAI = Boolean(body.skipAI);
    if (!skipAI) {
      // ── Wait for AI enrichment ──
      await enrichWord(data.id, word);
    }
    
    return NextResponse.json({
      success: true,
      message: `"${word}" saved${skipAI ? ' (pending AI)' : ' and analyzed'}!`,
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
      const reviewCount = srs?.review_count || 1; // Default to Level 1
      const isDue = !srs || nextReviewDate <= now;
      
      const srsLevel = Math.max(1, Math.min(5, reviewCount));
      
      return {
        ...w,
        srs,
        isDue,
        reviewCount,
        srsLevel, // Mochi buckets 1 to 5
        mastery: Math.min(100, srsLevel * 20),
        status: srsLevel >= 4 ? 'mastered' : 'learning',
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
