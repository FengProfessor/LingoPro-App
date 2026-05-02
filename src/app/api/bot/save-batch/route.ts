import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getWordSourceMap } from '@/lib/bot-utils';
import { getWordImage } from '@/lib/image-service';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        if (!Array.isArray(data)) {
            return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 400 });
        }
        
        const { wordToTags } = await getWordSourceMap();
        const supabase = createServiceClient();
        
        console.log(`[BOT-API] Saving ${data.length} words (with images)...`);
        let successCount = 0;
        
        for (const item of data) {
            if (!item.word) continue;
            
            const cleanWord = item.word.trim().toLowerCase();
            const sourceTags = wordToTags[cleanWord] || [];
            const finalTags = ['ai-auto-bot', ...sourceTags];

            // Trích xuất definition và pos từ data để tìm ảnh chính xác hơn
            const firstMeaning = item.results?.[0]?.meanings?.[0];
            const definition = firstMeaning?.definition || '';
            const pos = firstMeaning?.pos || '';

            // Lấy ảnh minh họa (Unsplash → Gemini fallback)
            let imageUrl: string | null = null;
            let imageSource: string = 'none';
            try {
                const imgResult = await getWordImage(cleanWord, definition, pos);
                imageUrl = imgResult.url;
                imageSource = imgResult.source;
                if (imageUrl) {
                    console.log(`[IMAGE] "${cleanWord}" ← ${imageSource}`);
                }
            } catch (imgErr: any) {
                console.warn(`[IMAGE] Skipped for "${cleanWord}":`, imgErr.message);
            }

            const { error } = await supabase.from('global_dictionary').upsert({
                word: cleanWord,
                tags: finalTags,
                data: item,
                image_url: imageUrl,
                image_source: imageSource,
            }, { onConflict: 'word' });
            
            if (!error) {
                successCount++;
            } else {
                // Nếu lỗi do thiếu cột image_url → fallback lưu không có ảnh
                if (error.message.includes('image_url') || error.message.includes('image_source')) {
                    const { error: e2 } = await supabase.from('global_dictionary').upsert({
                        word: cleanWord,
                        tags: finalTags,
                        data: item,
                    }, { onConflict: 'word' });
                    if (!e2) successCount++;
                    else console.error(`[ERROR] Failed to save "${item.word}":`, e2.message);
                } else {
                    console.error(`[ERROR] Failed to save "${item.word}":`, error.message);
                }
            }
        }

        return NextResponse.json({ success: true, saved: successCount });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
