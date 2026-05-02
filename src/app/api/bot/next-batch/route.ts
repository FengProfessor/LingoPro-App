import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getWordSourceMap } from '@/lib/bot-utils';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const batchSize = parseInt(searchParams.get('size') || '10');
        const direction = searchParams.get('direction') || 'asc';

        const { uniqueWords } = await getWordSourceMap();
        
        let allWords = [...uniqueWords];
        if (direction === 'desc') allWords.reverse();

        const supabase = createServiceClient();

        let nextBatch: string[] = [];
        let checkedCount = 0;
        const CHECK_CHUNK_SIZE = 500;

        while (nextBatch.length < batchSize && checkedCount < allWords.length) {
            const chunk = allWords.slice(checkedCount, checkedCount + CHECK_CHUNK_SIZE);
            const { data: existingData, error: selectError } = await supabase
                .from('global_dictionary')
                .select('word')
                .in('word', chunk);
            
            if (selectError) throw selectError;

            const existingSet = new Set(existingData?.map(i => i.word) || []);
            const freshWords = chunk.filter(w => !existingSet.has(w));
            
            for (const word of freshWords) {
                if (nextBatch.length < batchSize) {
                    nextBatch.push(word);
                } else break;
            }
            checkedCount += CHECK_CHUNK_SIZE;
        }

        const { count: totalSaved } = await supabase
            .from('global_dictionary')
            .select('*', { count: 'exact', head: true });
            
        const realRemaining = uniqueWords.length - (totalSaved || 0);

        return NextResponse.json({ 
            words: nextBatch, 
            remaining: realRemaining,
            total: uniqueWords.length,
            saved: totalSaved || 0
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
