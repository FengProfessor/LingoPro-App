import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { calculateNextReview } from '@/lib/srs';

/**
 * POST /api/words/srs
 * Body: { userId, wordId, quality: 0 | 3 | 5 }
 * - quality 0 = Forgot, 3 = Hard, 5 = Easy
 * Upserts an srs_progress row with the next SM-2 schedule.
 */
export async function POST(req: Request) {
  try {
    const { userId, wordId, quality } = await req.json();

    if (!userId || !wordId || ![0, 3, 4, 5].includes(quality)) {
      return NextResponse.json(
        { error: 'userId, wordId, and quality (0|3|4|5) are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get current SRS entry if exists
    const { data: existing } = await supabase
      .from('srs_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .single();

    const currentSRS = existing
      ? {
          easeFactor: existing.ease_factor,
          interval: existing.interval_days,
          reviewCount: existing.review_count,
          nextReviewDate: existing.next_review_date,
        }
      : {
          easeFactor: 2.5,
          interval: 0.5,
          reviewCount: 1, // Start at Level 1 for new records
          nextReviewDate: new Date().toISOString(),
        };

    const newSRS = calculateNextReview(currentSRS, quality as 0 | 3 | 4 | 5);

    // Upsert into srs_progress
    const { data, error } = await supabase
      .from('srs_progress')
      .upsert(
        {
          user_id: userId,
          word_id: wordId,
          ease_factor: newSRS.easeFactor,
          interval_days: newSRS.interval,
          review_count: newSRS.reviewCount,
          next_review_date: newSRS.nextReviewDate,
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,word_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('SRS Upsert Error:', error.message);
      return NextResponse.json({ error: 'Failed to save progress', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, srs: newSRS, data });
  } catch (error: any) {
    console.error('POST /api/words/srs Error:', error.message);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
