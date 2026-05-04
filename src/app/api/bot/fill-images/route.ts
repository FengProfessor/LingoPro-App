import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getWordImage } from '@/lib/image-service';

/**
 * POST /api/bot/fill-images
 * Backfill ảnh cho các từ đã có trong DB nhưng chưa có image_url
 * Body: { limit?: number } — mặc định 100
 */
export async function POST(req: Request) {
    try {
        const { limit = 100 } = await req.json().catch(() => ({}));
        const supabase = createServiceClient();

        // Get words with no real image: null URL, or source is none/null
        const { data: words, error } = await supabase
            .from('global_dictionary')
            .select('word, data, image_url, image_source')
            .or('image_url.is.null,image_source.is.null,image_source.eq.none')
            .limit(limit);

        if (error) {
            // Nếu cột chưa tồn tại → trả về hướng dẫn tạo cột
            if (error.message.includes('image_url') || error.message.includes('column')) {
                return NextResponse.json({
                    success: false,
                    error: 'Cột image_url chưa tồn tại trong DB. Chạy SQL migration trước.',
                    sql: `ALTER TABLE global_dictionary ADD COLUMN IF NOT EXISTS image_url TEXT; ALTER TABLE global_dictionary ADD COLUMN IF NOT EXISTS image_source TEXT DEFAULT 'none';`
                }, { status: 400 });
            }
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!words || words.length === 0) {
            return NextResponse.json({ success: true, message: 'Tất cả từ đã có ảnh!', updated: 0 });
        }

        console.log(`[FILL-IMAGES] Processing ${words.length} words...`);
        let updated = 0;
        let ddgCount = 0;
        let wikiCount = 0;
        let noneCount = 0;

        for (const row of words) {
            const wordData = row.data as any;
            const definition = wordData?.results?.[0]?.meanings?.[0]?.definition || '';
            const pos = wordData?.results?.[0]?.meanings?.[0]?.pos || '';

            const { url, source } = await getWordImage(row.word, definition, pos);

            const { error: updateErr } = await supabase
                .from('global_dictionary')
                .update({ image_url: url, image_source: source })
                .eq('word', row.word);

            if (!updateErr) {
                updated++;
                if (source === 'duckduckgo') ddgCount++;
                else if (source === 'wikipedia') wikiCount++;
                else noneCount++;
                console.log(`[FILL-IMAGES] ✓ "${row.word}" ← ${source}`);
            } else {
                console.error(`[FILL-IMAGES] ✗ "${row.word}":`, updateErr.message);
            }

            // Throttle: tránh rate limit Pixabay (100 req/min free tier)
            await new Promise(r => setTimeout(r, 650));
        }

        return NextResponse.json({
            success: true,
            updated,
            breakdown: { duckduckgo: ddgCount, wikipedia: wikiCount, none: noneCount },
            message: `Đã cập nhật ${updated}/${words.length} từ`
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

/**
 * GET /api/bot/fill-images
 * Kiểm tra trạng thái: bao nhiêu từ đã có ảnh / chưa có
 */
export async function GET() {
    try {
        const supabase = createServiceClient();

        const { count: total } = await supabase
            .from('global_dictionary')
            .select('*', { count: 'exact', head: true });

        const { count: withImage } = await supabase
            .from('global_dictionary')
            .select('*', { count: 'exact', head: true })
            .not('image_url', 'is', null)
            .neq('image_source', 'placeholder');

        const { count: withPlaceholder } = await supabase
            .from('global_dictionary')
            .select('*', { count: 'exact', head: true })
            .eq('image_source', 'placeholder');

        return NextResponse.json({
            total: total || 0,
            withRealImage: withImage || 0,
            withPlaceholder: withPlaceholder || 0,
            withoutImage: (total || 0) - (withImage || 0) - (withPlaceholder || 0)
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
