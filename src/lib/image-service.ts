/**
 * Image Service for LingoPro
 * Strategy:
 *   Tier 1: Wikipedia Thumbnail API (free, no key, good for concrete nouns)
 *   Tier 2: Smart SVG Illustration (semantic emoji + gradient, 100% offline, zero API)
 *
 * Note: Pixabay blocked by Cloudflare server-side. Pexels requires key. Gemini Imagen requires billing.
 * Wikipedia + Smart SVG covers 100% of words reliably.
 */

import { imageSearch } from '@mudbill/duckduckgo-images-api';

/**
 * Image Service for LingoPro
 * Strategy:
 *   Tier 1: DuckDuckGo Images (Real photos, high quality)
 *   Tier 2: Wikipedia Thumbnail API (Fallback)
 */

export async function fetchDuckDuckGoImage(word: string): Promise<string | null> {
    try {
        // Appending 'stock photo' ensures we get real photos (e.g. real dog, people for 'love')
        const query = `${word} stock photo`;
        const res = await imageSearch({ query, moderate: true });
        
        if (res && res.length > 0) {
            // Find the first URL that is not from koala.sh (which sometimes serves weird AI images)
            const validImage = res.find(r => r.image && !r.image.includes('koala.sh')) || res[0];
            return validImage.image;
        }
        return null;
    } catch (e) {
        console.error('DDG Image Error for', word, ':', e);
        return null;
    }
}

export async function fetchWikipediaImage(word: string): Promise<string | null> {
    try {
        const searchWord = word.includes(' ') ? word.split(' ')[0] : word;
        const title = searchWord.trim().replace(/\s+/g, '_');
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;
        const data = await res.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const page: any = Object.values(pages)[0];
        if (page.pageid === -1 || !page.thumbnail) return null;
        const src: string = page.thumbnail.source || '';
        if (src.includes('Wikipedia-logo') || src.includes('Flag_of') || src.includes('.svg')) return null;
        return src;
    } catch {
        return null;
    }
}

export async function getWordImage(
    word: string,
    definition: string = '',
    pos: string = ''
): Promise<{ url: string; source: 'duckduckgo' | 'wikipedia' | 'none' }> {
    
    // 1. DuckDuckGo (Primary: Real contextual photos)
    const ddgUrl = await fetchDuckDuckGoImage(word);
    if (ddgUrl) return { url: ddgUrl, source: 'duckduckgo' };

    // 2. Wikipedia (Fallback)
    const wikiUrl = await fetchWikipediaImage(word);
    if (wikiUrl) return { url: wikiUrl, source: 'wikipedia' };

    return { url: '', source: 'none' };
}

