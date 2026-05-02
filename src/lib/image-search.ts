/**
 * Image Search Service using Pollinations AI
 * Optimized for generative text-to-image flashcards.
 * 
 * Strategy:
 * 1. AI (Gemini) generates a highly descriptive 'image_search_query' prompt.
 * 2. We pass this directly to Pollinations AI, which streams back an AI-generated image.
 * 3. We return the URL directly for the browser/Telegram to consume.
 */

export async function searchImage(word: string, descriptiveQuery?: string): Promise<string | null> {
  // Use Gemini's descriptive query if available, otherwise fall back to a standard prompt
  const basePrompt = descriptiveQuery 
    ? descriptiveQuery 
    : `A clean, minimalist educational illustration of the concept: ${word}, white background, high quality`;
  
  // Seed it based on the word so the same word gets the same image consistently
  // Create a simple hash representation from the word
  const seed = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Build the Pollinations AI URL
  const params = new URLSearchParams({
    width: '800',
    height: '500',
    nologo: 'true',
    seed: seed.toString(),
    // Ensures safety filters are somewhat respected
    safe: 'true' 
  });

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(basePrompt)}?${params.toString()}`;
  
  console.log(`[AI Image] Generated Pollinations URL for "${word}": ${url}`);
  
  return url;
}
