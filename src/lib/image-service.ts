/**
 * Image Service for LingoPro
 * Strategy:
 *   Tier 1: Wikipedia Thumbnail API (free, no key, good for concrete nouns)
 *   Tier 2: Smart SVG Illustration (semantic emoji + gradient, 100% offline, zero API)
 *
 * Note: Pixabay blocked by Cloudflare server-side. Pexels requires key. Gemini Imagen requires billing.
 * Wikipedia + Smart SVG covers 100% of words reliably.
 */

// ─────────────────────────────────────────────
// TIER 1: Wikipedia Thumbnail API (no key)
// ─────────────────────────────────────────────

export async function fetchWikipediaImage(word: string): Promise<string | null> {
    try {
        // For phrasal verbs / multi-word: use first main word for Wikipedia
        const searchWord = word.includes(' ') ? word.split(' ')[0] : word;
        const title = searchWord.trim().replace(/\s+/g, '_');
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (!res.ok) return null;
        const data = await res.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const page: any = Object.values(pages)[0];
        // Reject if no article or no image
        if (page.pageid === -1 || !page.thumbnail) return null;
        // Reject generic icons (wikipedia svg icons, flags etc.)
        const src: string = page.thumbnail.source || '';
        if (src.includes('Wikipedia-logo') || src.includes('Flag_of') || src.includes('.svg')) return null;
        return src;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// TIER 2: Smart Semantic SVG Illustration
// ─────────────────────────────────────────────

/**
 * Map từ vựng đến emoji + theme color dựa trên semantic categories.
 * Được build offline, không cần API.
 */
function getSemanticTheme(word: string, definition: string, pos: string): {
    emojis: string[];
    color1: string;
    color2: string;
    accent: string;
    category: string;
} {
    const w = word.toLowerCase();
    const def = definition.toLowerCase();
    const combined = `${w} ${def}`;

    // ── Nature & Environment ──
    if (/\b(nature|plant|tree|flower|forest|ocean|sea|river|mountain|animal|bird|fish|wildlife|earth|environment|green|grow|bloom|harvest)\b/.test(combined))
        return { emojis: ['🌿', '🌱', '🌳'], color1: '#0d2b1a', color2: '#1b4332', accent: '#74c69d', category: 'nature' };

    // ── Abundance & Quantity ──
    if (/\b(abundant|plenty|large|quantity|numerous|many|much|excess|overflow|surplus|rich|full|complete|whole|entire)\b/.test(combined))
        return { emojis: ['🌾', '✨', '💫'], color1: '#1a1200', color2: '#3d2b00', accent: '#f5a623', category: 'abundance' };

    // ── Academic / Knowledge ──
    if (/\b(academic|analysis|research|study|theory|hypothesis|evidence|data|concept|method|knowledge|learn|education|university|science|logic|rational)\b/.test(combined))
        return { emojis: ['📚', '🔬', '💡'], color1: '#0a1628', color2: '#1a2f5e', accent: '#60a5fa', category: 'academic' };

    // ── Business / Finance ──
    if (/\b(business|finance|money|profit|market|economy|invest|trade|revenue|cost|budget|company|corporate|strategy|growth|capital|asset)\b/.test(combined))
        return { emojis: ['💼', '📈', '💰'], color1: '#0f1c10', color2: '#1a3320', accent: '#4ade80', category: 'business' };

    // ── Emotion / Feeling ──
    if (/\b(feel|emotion|anxiety|joy|fear|anger|sad|happy|depress|stress|worry|calm|peace|love|hate|passion|mood|mental|psychological)\b/.test(combined))
        return { emojis: ['💭', '🌊', '✨'], color1: '#1a0533', color2: '#2d1b69', accent: '#c084fc', category: 'emotion' };

    // ── Action / Movement ──
    if (/\b(move|action|run|walk|climb|push|pull|jump|achieve|accomplish|perform|execute|carry|bring|take|give|transfer|proceed)\b/.test(combined) || pos === 'verb')
        return { emojis: ['⚡', '🎯', '🔥'], color1: '#1c0a00', color2: '#3d1a00', accent: '#f97316', category: 'action' };

    // ── Communication / Language ──
    if (/\b(speak|talk|say|tell|write|read|communicate|language|word|message|express|describe|explain|discuss|argue|persuade|define)\b/.test(combined))
        return { emojis: ['💬', '📝', '🗣️'], color1: '#001a1a', color2: '#002d2d', accent: '#2dd4bf', category: 'communication' };

    // ── Technology ──
    if (/\b(technology|computer|digital|internet|software|system|data|process|network|device|machine|automate|program|code|algorithm)\b/.test(combined))
        return { emojis: ['⚙️', '💻', '🔗'], color1: '#0a0a1a', color2: '#1a1a3d', accent: '#818cf8', category: 'technology' };

    // ── People & Society ──
    if (/\b(people|society|community|social|human|person|individual|group|culture|politics|government|democracy|freedom|right|justice|law)\b/.test(combined))
        return { emojis: ['👥', '🤝', '🌐'], color1: '#1a0a00', color2: '#2d1a10', accent: '#fb923c', category: 'society' };

    // ── Health & Body ──
    if (/\b(health|body|disease|medical|treatment|medicine|cure|pain|injury|physical|mental|energy|strength|weak|condition|symptom)\b/.test(combined))
        return { emojis: ['❤️', '🏥', '💊'], color1: '#1a0a0a', color2: '#3d1a1a', accent: '#f87171', category: 'health' };

    // ── Adjective: Positive qualities ──
    if (/\b(good|great|excellent|superior|perfect|beautiful|strong|powerful|important|significant|valuable|effective|efficient|successful)\b/.test(combined) && pos === 'adjective')
        return { emojis: ['⭐', '✨', '🏆'], color1: '#0f0f00', color2: '#1f1f00', accent: '#fbbf24', category: 'positive' };

    // ── Adjective: Negative/Complex qualities ──
    if (/\b(bad|difficult|complex|complicated|ambiguous|uncertain|vague|obscure|abstract|unclear|confuse|conflict|contradict)\b/.test(combined))
        return { emojis: ['🌀', '❓', '🔮'], color1: '#0a001a', color2: '#1a0033', accent: '#a78bfa', category: 'complex' };

    // ── Default: General ──
    const defaultPalettes = [
        { emojis: ['📖', '🔤', '💎'], color1: '#0f172a', color2: '#1e293b', accent: '#4CAF50' },
        { emojis: ['🌟', '💫', '✨'], color1: '#0c1222', color2: '#1e2a4a', accent: '#60a5fa' },
        { emojis: ['🎯', '🔑', '💡'], color1: '#1a0f0f', color2: '#2d1a1a', accent: '#f87171' },
    ];
    const p = defaultPalettes[word.charCodeAt(0) % defaultPalettes.length];
    return { ...p, category: 'general' };
}

export function generateSmartSvg(word: string, definition: string = '', pos: string = ''): string {
    const theme = getSemanticTheme(word, definition, pos);
    const [e1, e2, e3] = theme.emojis;
    const shortDef = definition.length > 55 ? definition.substring(0, 52) + '...' : definition;
    const posLabel = pos ? pos.toUpperCase() : 'WORD';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.color1}"/>
      <stop offset="100%" style="stop-color:${theme.color2}"/>
    </linearGradient>
    <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${theme.accent};stop-opacity:0"/>
      <stop offset="50%" style="stop-color:${theme.accent}"/>
      <stop offset="100%" style="stop-color:${theme.accent};stop-opacity:0"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="600" height="300" fill="url(#bg)"/>
  
  <!-- Decorative circles -->
  <circle cx="520" cy="50" r="80" fill="${theme.accent}" opacity="0.06"/>
  <circle cx="80" cy="250" r="60" fill="${theme.accent}" opacity="0.05"/>
  <circle cx="300" cy="150" r="120" fill="${theme.accent}" opacity="0.04"/>
  
  <!-- Emoji decorations (background) -->
  <text x="50" y="100" font-size="40" opacity="0.15" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${e3}</text>
  <text x="520" y="240" font-size="36" opacity="0.12" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${e2}</text>
  
  <!-- Main emoji -->
  <text x="300" y="115" text-anchor="middle" font-size="64" filter="url(#glow)" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${e1}</text>
  
  <!-- Accent line -->
  <rect x="100" y="135" width="400" height="1.5" fill="url(#line)" opacity="0.5"/>
  
  <!-- POS badge -->
  <rect x="245" y="145" width="110" height="22" rx="11" fill="${theme.accent}" opacity="0.15"/>
  <text x="300" y="161" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="800" fill="${theme.accent}" letter-spacing="2">${posLabel}</text>
  
  <!-- Word -->
  <text x="300" y="205" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="36" font-weight="900" fill="#ffffff">${word}</text>
  
  <!-- Definition -->
  <text x="300" y="235" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#94a3b8">${shortDef}</text>
  
  <!-- Brand -->
  <text x="300" y="268" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${theme.accent}" opacity="0.6" letter-spacing="1">LINGOPRO DICTIONARY</text>
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ─────────────────────────────────────────────
// MAIN: Smart image fetcher
// ─────────────────────────────────────────────

export async function getWordImage(
    word: string,
    definition: string = '',
    pos: string = ''
): Promise<{ url: string; source: 'wikipedia' | 'placeholder' }> {
    // Tier 1: Wikipedia (good for concrete nouns like "cat", "mountain", "parliament")
    const wikiUrl = await fetchWikipediaImage(word);
    if (wikiUrl) return { url: wikiUrl, source: 'wikipedia' };

    // Tier 2: Smart SVG (always works, semantic colors + emoji)
    return { url: generateSmartSvg(word, definition, pos), source: 'placeholder' };
}
