import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EnrichedWord {
  english: string;
  vietnamese: string;
  ipa: string;
  pos: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  image_search_query: string;
}

/**
 * Analyzes a word using Gemini AI to get bilingual details and context.
 * Supports customApiKey for "Bring Your Own Key" (BYOK) cost saving.
 */
export async function enrichWord(originalInput: string, customApiKey?: string): Promise<EnrichedWord> {
  // Use user-provided key or fallback to system key
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('No Gemini API Key provided');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a bilingual dictionary. Analyze the word/phrase: "${originalInput}".
Detect its language (English or Vietnamese).
Return ONLY valid JSON with these exact keys:
- "english": the English word/phrase (if input is Vietnamese, translate to English; if input is English, use it as-is in lowercase base form)
- "vietnamese": the Vietnamese meaning (if input is English, translate to Vietnamese; if input is Vietnamese, use it as-is)  
- "ipa": IPA phonetic transcription of the ENGLISH word
- "pos": part of speech (noun/verb/adj/adv/prep/conj/det)
- "example": one natural English sentence using the English word
- "synonyms": array of 3-5 common English synonyms
- "antonyms": array of 3-5 common English antonyms
- "image_search_query": a 2-4 word descriptive English string for image search. For abstract words, use symbolic or educational keywords (e.g., for "synonyms": "words meaning same icon", for "diversity": "different people hands together illustration", for "grammar": "sentence structure diagram"). Focus on high-quality, concept-driven visuals.
Strict JSON only, no markdown fences, no prose.`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON found in AI response`);
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      english: (parsed.english || originalInput).toLowerCase().trim(),
      vietnamese: parsed.vietnamese || originalInput,
      ipa: parsed.ipa || '',
      pos: parsed.pos || '',
      example: parsed.example || '',
      synonyms: parsed.synonyms || [],
      antonyms: parsed.antonyms || [],
      image_search_query: parsed.image_search_query || '',
    };
  } catch (err: any) {
    console.error(`AI enrichment failed for word "${originalInput}":`, err.message);
    throw err;
  }
}
