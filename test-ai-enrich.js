const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Use gemini-1.5-flash as it is more likely to be available if 2.0/2.5 are not yet globally standard in all environments
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function testEnrich(word) {
    const prompt = `You are a bilingual dictionary. Analyze the word/phrase: "${word}".
Detect its language (English or Vietnamese).
Return ONLY valid JSON with these exact keys:
- "english": the English word/phrase (if input is Vietnamese, translate to English; if input is English, use it as-is in lowercase base form)
- "vietnamese": the Vietnamese meaning (if input is English, translate to Vietnamese; if input is Vietnamese, use it as-is)  
- "ipa": IPA phonetic transcription of the ENGLISH word
- "pos": part of speech (noun/verb/adj/adv/prep/conj/det)
- "example": one natural English sentence using the English word
- "synonyms": array of 3-5 common English synonyms
- "antonyms": array of 3-5 common English antonyms
Strict JSON only, no markdown fences, no prose.`;

    try {
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        console.log('Raw result:', rawText);
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('Parsed result:', JSON.stringify(parsed, null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testEnrich('meticulous');
