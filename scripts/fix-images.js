const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pixabayKey = process.env.PIXABAY_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !pixabayKey || !geminiKey) {
  console.error('Missing environment variables. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiKey);

async function searchImage(word, descriptiveQuery) {
  const query = descriptiveQuery || word;
  try {
    const params = new URLSearchParams({
      key: pixabayKey,
      q: query,
      image_type: 'photo',
      per_page: '3',
      safesearch: 'true',
      orientation: 'horizontal'
    });
    const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    const data = await response.json();
    if (data.hits && data.hits.length > 0) {
       return data.hits[0].webformatURL;
    }
    return null;
  } catch (err) {
    console.error(`Search failed for "${query}":`, err.message);
    return null;
  }
}

async function fixImages(forceRefresh = false) {
  console.log(`--- LingoPro AI Image Repair Tool (force=${forceRefresh}) ---`);
  
  let query = supabase.from('words').select('id, word, translation, example, image_url');
  
  if (!forceRefresh) {
    query = query.is('image_url', null);
  }

  const { data: words, error } = await query;

  let processedWords = words;
  if (!forceRefresh) {
    processedWords = words.filter(w => !w.image_url);
  }

  if (error) {
    console.error('Error fetching words:', error);
    return;
  }

  console.log(`Processing ${processedWords.length} words...`);
  
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  for (const item of processedWords) {
    try {
      let descriptiveQuery = item.word;
      
      try {
        console.log(`[AI] Generating visual query for "${item.word}"...`);
        const prompt = `Create a 3-word English search query for an image illustrating "${item.word}" (translated as ${item.translation}). Context: ${item.example || ''}. Return ONLY the 3 words.`;
        const aiResult = await model.generateContent(prompt);
        descriptiveQuery = aiResult.response.text().trim().replace(/["']/g, '');
        console.log(`[API] Searching "${descriptiveQuery}"...`);
      } catch (aiErr) {
        console.warn(`[AI Fail] Falling back to "${item.word}"`);
      }

      const imageUrl = await searchImage(item.word, descriptiveQuery);

      if (imageUrl) {
        const { error: updateError } = await supabase
          .from('words')
          .update({ image_url: imageUrl })
          .eq('id', item.id);
        
        if (updateError) console.error(`Failed to update ${item.id}:`, updateError.message);
        else console.log(`✓ "${item.word}" updated with better image.`);
      } else {
        console.log(`✗ No image found for "${item.word}"`);
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Failed to process "${item.word}":`, err.message);
    }
  }

  console.log('\n--- Finished! ---');
}

const forceRefresh = process.argv.includes('--force');
fixImages(forceRefresh);
