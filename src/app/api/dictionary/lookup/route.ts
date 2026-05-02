import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/dictionary/lookup?word=X
 *
 * Tra cứu từ trong global_dictionary (dữ liệu Bot đã cào).
 * Được dùng bởi LingoPro Extension để lấy dữ liệu phong phú trước khi fallback sang dict.minhqnd.com.
 *
 * Response format tương thích với dict.minhqnd.com để LingoPro dùng cùng một parser.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const word = (searchParams.get('word') || '').trim().toLowerCase();

  if (!word) {
    return NextResponse.json({ success: false, error: 'word is required' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('global_dictionary')
      .select('word, data, tags')
      .eq('word', word)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Trả về data theo format chuẩn của LingoPro (giống dict.minhqnd.com)
    return NextResponse.json({
      success: true,
      source: 'global_dictionary', // LingoPro có thể dùng để biết nguồn
      tags: data.tags || [],
      ...data.data, // Spread toàn bộ dữ liệu Bot cào: word, pronunciations, results, familyWords
    });

  } catch (err: any) {
    console.error('[Dictionary Lookup] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
