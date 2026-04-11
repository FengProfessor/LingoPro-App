const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pixabayKey = process.env.PIXABAY_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiKey);

async function verifyFix() {
  const wordId = 'e469ab9d-460c-42f0-9f1b-4c28432e967b'; // synonym
  console.log('Verifying fix for word ID:', wordId);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = 'Create a 3-word English search query for a high-quality educational image illustrating the concept of "synonyms" (words with same meaning). Use symbolic keywords like "thesaurus icon" or "dictionary diagram". Return ONLY the 3 words.';
    
    const result = await model.generateContent(prompt);
    const q = result.response.text().trim().replace(/["']/g, '');
    console.log('Generated AI Query:', q);

    const params = new URLSearchParams({
      key: pixabayKey,
      q: q,
      image_type: 'photo',
      per_page: '3',
      safesearch: 'true'
    });
    
    const res = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    const data = await res.json();
    const imageUrl = data.hits?.[0]?.webformatURL;

    if (imageUrl) {
      await supabase.from('words').update({ image_url: imageUrl }).eq('id', wordId);
      console.log('Success! Word updated with image:', imageUrl);
    } else {
      console.log('No image found for query.');
    }
  } catch (err) {
    console.error('Execution error:', err.message);
  }
}

verifyFix();
