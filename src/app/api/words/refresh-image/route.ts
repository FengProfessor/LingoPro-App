import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { searchImage } from '@/lib/image-search';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { wordId } = await req.json();
    if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 });

    const supabase = createServiceClient();
    
    // 1. Get word details to generate a better prompt
    const { data: word, error: fetchErr } = await supabase
      .from('words')
      .select('word, translation, example, added_by')
      .eq('id', wordId)
      .single();

    if (fetchErr || !word) throw new Error('Word not found');

    // 2. Get AI Key
    const { data: profile } = await supabase.from('profiles').select('gemini_api_key').eq('id', word.added_by).single();
    const apiKey = profile?.gemini_api_key || process.env.GEMINI_API_KEY || '';
    
    // 3. Generate a descriptive prompt using Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Create a 3-word English search query for a high-quality, symbolic or educational image illustrating "${word.word}" (context: ${word.translation}, example: ${word.example }). For abstract concepts, use clear symbolic keywords (e.g., "dictionary diagram", "language icon", "arrows together"). Return ONLY the 3 words. No prose.`;
    
    const aiResult = await model.generateContent(prompt);
    const descriptiveQuery = aiResult.response.text().trim();

    // 4. Search Pixabay with this new AI query
    const imageUrl = await searchImage(word.word, descriptiveQuery);

    if (!imageUrl) throw new Error('Could not find better image');

    // 5. Update DB
    await supabase.from('words').update({ image_url: imageUrl }).eq('id', wordId);

    return NextResponse.json({ success: true, imageUrl });
  } catch (err: any) {
    console.error('Refresh image error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
