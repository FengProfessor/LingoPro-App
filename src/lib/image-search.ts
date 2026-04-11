/**
 * Image Search Service using Pixabay API
 * Optimized for educational vocabulary flashcards.
 * 
 * Strategy:
 * 1. Try `illustration` type first (vector-style, cleaner, more abstract - great for abstract words like "meaning")
 * 2. If no results, fall back to `photo` with concept-focused search terms
 * 3. Use category & editor_choice filters for highest quality
 */

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// Suffix hints to improve relevance for abstract vocabulary words
const ILLUSTRATION_HINTS = 'concept illustration';
const PHOTO_HINTS = 'isolated white background';

// Words that are clearly abstract and benefit from illustrations
const ABSTRACT_CONCEPTS = new Set([
  'meaning', 'synonym', 'antonym', 'concept', 'idea', 'thought', 'memory',
  'theory', 'knowledge', 'learning', 'education', 'wisdom', 'culture',
  'habit', 'success', 'failure', 'goal', 'motivation', 'emotion', 'feeling',
  'whose', 'grammar', 'vocabulary', 'internet', 'lingo', 'diversity',
  'renewable', 'portable', 'analysis', 'feature', 'ready', 'golden',
  'like', 'enjoy', 'attract', 'activities', 'fit', 'meaning', 'feature'
]);

/**
 * Build a smart search query that improves relevance for vocabulary images.
 * For abstract words → concept illustration style
 * For concrete/noun words → direct photo
 */
function buildQuery(word: string): { query: string; imageType: string } {
  const lowerWord = word.toLowerCase();

  const isAbstract = ABSTRACT_CONCEPTS.has(lowerWord) || 
    lowerWord.split(' ').length === 1 && lowerWord.length >= 6 && !/\d/.test(lowerWord);

  if (isAbstract) {
    return {
      query: `${word} ${ILLUSTRATION_HINTS}`,
      imageType: 'illustration'
    };
  }

  // Multi-word phrases (e.g. "wide range", "catch the plane") → use photo
  return {
    query: word,
    imageType: 'photo'
  };
}

export async function searchImage(word: string, descriptiveQuery?: string): Promise<string | null> {
  if (!PIXABAY_API_KEY) {
    console.warn('PIXABAY_API_KEY is missing. Skipping image search.');
    return null;
  }

  // Strategy:
  // 1. If we have a descriptive AI query, use it first (best relevance)
  if (descriptiveQuery) {
    const aiResult = await fetchPixabay(descriptiveQuery, 'photo');
    if (aiResult) return aiResult;
  }

  const { query: smartQuery, imageType } = buildQuery(word);
  
  // Try 2: Smart type (illustration or photo) based on word itself
  const result = await fetchPixabay(smartQuery, imageType);
  if (result) return result;

  // Try 3: Fallback to photo with original word
  if (imageType === 'illustration') {
    const photoResult = await fetchPixabay(word, 'photo');
    if (photoResult) return photoResult;
  }

  // Try 4: Last resort - all types, broadened search
  return fetchPixabay(word, 'all');
}

async function fetchPixabay(query: string, imageType: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      key: PIXABAY_API_KEY!,
      q: query,
      image_type: imageType,
      per_page: '5',
      safesearch: 'true',
      orientation: 'horizontal',
      min_width: '400',
    });

    const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    const data = await response.json();

    if (data.hits && data.hits.length > 0) {
      // Prefer editor's choice if available
      const editorChoice = data.hits.find((h: any) => h.editor_choice);
      const best = editorChoice || data.hits[0];
      console.log(`[Pixabay] "${query}" (${imageType}) → ${best.webformatURL}`);
      return best.webformatURL;
    }

    return null;
  } catch (err) {
    console.error(`[Pixabay] Search failed for "${query}" (${imageType}):`, err);
    return null;
  }
}
