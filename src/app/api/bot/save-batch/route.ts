import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getWordSourceMap } from '@/lib/bot-utils';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        if (!Array.isArray(data)) {
            return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 400 });
        }
        
        const { wordToTags } = await getWordSourceMap();
        const supabase = createServiceClient();
        
        console.log(`[BOT-API] Saving ${data.length} words...`);
        let successCount = 0;
        
        for (const item of data) {
            if (!item.word) continue;
            
            const cleanWord = item.word.trim().toLowerCase();
            const sourceTags = wordToTags[cleanWord] || [];
            const finalTags = ['ai-auto-bot', ...sourceTags];

            const { error } = await supabase.from('global_dictionary').upsert({
                word: cleanWord,
                tags: finalTags,
                data: item
            }, { onConflict: 'word' });
            
            if (!error) {
                successCount++;
            } else {
                console.error(`[ERROR] Failed to save "${item.word}":`, error.message);
            }
        }

        return NextResponse.json({ success: true, saved: successCount });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
