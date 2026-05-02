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
 * Analyzes a word using Gemini AI.
 * If dictionaryData is provided, AI helps pick the best meaning for the context.
 */
export async function enrichWord(originalInput: string, customApiKey?: string, dictionaryData?: any, userTargetTranslation?: string): Promise<EnrichedWord> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('No Gemini API Key provided');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const dictionaryContext = dictionaryData 
    ? `Available dictionary definitions: ${JSON.stringify(dictionaryData?.results?.[0]?.meanings || [])}` 
    : '';

  const explicitContext = userTargetTranslation 
    ? `CRITICAL INSTRUCTION: The user SPECIFICALLY selected this translation: "${userTargetTranslation}". You MUST use EXACTLY "${userTargetTranslation}" for the "vietnamese" field, without changing it. Base all your generated example sentences, synonyms, antonyms, and especially the image search query context strictly around THIS specific meaning.`
    : `Detect language. If dictionary definitions above are provided, PICK the best one for a general learner.`;

  const prompt = `You are a bilingual dictionary. Analyze: "${originalInput}".
${explicitContext}
${!userTargetTranslation ? dictionaryContext : ''}

Return ONLY valid JSON with these exact keys:
- "english": the English word (lowercase base form)
- "vietnamese": the exact Vietnamese meaning requested (or best picked)
- "ipa": IPA phonetic transcription
- "pos": part of speech
- "example": one natural English sentence
- "synonyms": array of 3-5 common English synonyms
- "antonyms": array of 3-5 common English antonyms
- "image_search_query": a 2-5 word descriptive English string for image generation that matched the context.
Strict JSON only.`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    
    // Attempt multi-strategy parsing
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Invalid AI response format`);
      parsed = JSON.parse(jsonMatch[0]);
    }

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
