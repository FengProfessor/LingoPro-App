import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * POST /api/import/ocr
 * Body: { base64: string, mimeType: string }
 * Uses Gemini Vision to extract vocabulary words from an image
 */
export async function POST(req: Request) {
  try {
    const { base64, mimeType } = await req.json();
    if (!base64 || !mimeType) {
      return NextResponse.json({ error: 'base64 and mimeType are required' }, { status: 400 });
    }

    const prompt = `You are a vocabulary extraction assistant. 
Look at this image and extract ALL English vocabulary words that appear to be:
- Underlined or highlighted (especially in red, yellow, or any color)
- Bold or emphasized
- Listed as vocabulary items
- Words that a student might need to learn

Return ONLY a JSON array of lowercase strings. No explanations, no markdown.
Example: ["epicenter", "thousands", "phenomenon", "extraordinary"]

If no clear vocabulary words are found, return an empty array: []`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          data: base64,
          mimeType: mimeType as any,
        },
      },
    ]);

    const rawText = result.response.text();
    console.log('OCR raw response:', rawText.substring(0, 500));

    // Extract JSON array from response
    const arrayMatch = rawText.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return NextResponse.json({ words: [] });
    }

    const words: string[] = JSON.parse(arrayMatch[0]);
    const filtered = words
      .filter(w => typeof w === 'string' && w.length > 1 && w.length < 80)
      .map(w => w.toLowerCase().trim());

    return NextResponse.json({ success: true, words: [...new Set(filtered)] });
  } catch (error: any) {
    console.error('OCR Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
