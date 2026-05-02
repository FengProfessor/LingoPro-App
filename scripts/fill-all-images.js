/**
 * Script chạy trực tiếp để fill ảnh cho TẤT CẢ từ trong DB
 * Không phụ thuộc vào Next.js server, chạy độc lập
 * node scripts/fill-all-images.js [--limit=N]
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Parse CLI args
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 500;
const BATCH = 50; // Process in sub-batches to avoid memory issues

// ── Semantic theme map ──────────────────────────────────────────────
function getTheme(word, definition, pos) {
    const w = word.toLowerCase();
    const def = (definition || '').toLowerCase();
    const c = `${w} ${def}`;
    const posStr = (pos || '').toLowerCase();

    if (/\b(nature|plant|tree|flower|forest|ocean|sea|river|mountain|animal|bird|fish|wildlife|earth|environment|green|grow|bloom)\b/.test(c))
        return { e: '🌿', c1: '#0d2b1a', c2: '#1b4332', a: '#74c69d' };
    if (/\b(abundant|plenty|large|quantity|numerous|many|excess|overflow|surplus|rich|full|harvest)\b/.test(c))
        return { e: '🌾', c1: '#1a1200', c2: '#3d2b00', a: '#f5a623' };
    if (/\b(academic|analysis|research|study|theory|hypothesis|evidence|concept|knowledge|science|logic)\b/.test(c))
        return { e: '📚', c1: '#0a1628', c2: '#1a2f5e', a: '#60a5fa' };
    if (/\b(business|finance|money|profit|market|economy|invest|trade|revenue|budget|company|capital)\b/.test(c))
        return { e: '💼', c1: '#0f1c10', c2: '#1a3320', a: '#4ade80' };
    if (/\b(feel|emotion|anxiety|joy|fear|anger|sad|happy|depress|stress|worry|calm|peace|passion|mood|mental)\b/.test(c))
        return { e: '💭', c1: '#1a0533', c2: '#2d1b69', a: '#c084fc' };
    if (/\b(move|action|run|walk|climb|achieve|accomplish|perform|execute|proceed|advance|progress)\b/.test(c) || posStr === 'verb')
        return { e: '⚡', c1: '#1c0a00', c2: '#3d1a00', a: '#f97316' };
    if (/\b(speak|talk|say|tell|write|read|communicate|language|word|message|express|explain)\b/.test(c))
        return { e: '💬', c1: '#001a1a', c2: '#002d2d', a: '#2dd4bf' };
    if (/\b(technology|computer|digital|system|data|network|device|machine|automate|code|algorithm)\b/.test(c))
        return { e: '⚙️', c1: '#0a0a1a', c2: '#1a1a3d', a: '#818cf8' };
    if (/\b(people|society|community|social|human|culture|politics|government|freedom|justice|law)\b/.test(c))
        return { e: '👥', c1: '#1a0a00', c2: '#2d1a10', a: '#fb923c' };
    if (/\b(health|body|disease|medical|treatment|medicine|cure|pain|physical|energy|strength)\b/.test(c))
        return { e: '❤️', c1: '#1a0a0a', c2: '#3d1a1a', a: '#f87171' };

    const defaults = [
        { e: '📖', c1: '#0f172a', c2: '#1e293b', a: '#4CAF50' },
        { e: '🌟', c1: '#0c1222', c2: '#1e2a4a', a: '#60a5fa' },
        { e: '🎯', c1: '#1a0f0f', c2: '#2d1a1a', a: '#f87171' },
        { e: '💡', c1: '#0a1210', c2: '#1a2420', a: '#2dd4bf' },
    ];
    return defaults[word.charCodeAt(0) % defaults.length];
}

function buildSvg(word, definition, pos) {
    const t = getTheme(word, definition, pos);
    const shortDef = (definition || '').length > 55 ? (definition || '').substring(0, 52) + '...' : (definition || '');
    const posLabel = pos ? pos.toUpperCase() : 'WORD';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${t.c1}"/><stop offset="100%" style="stop-color:${t.c2}"/>
    </linearGradient>
    <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${t.a};stop-opacity:0"/>
      <stop offset="50%" style="stop-color:${t.a}"/>
      <stop offset="100%" style="stop-color:${t.a};stop-opacity:0"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="600" height="300" fill="url(#bg)"/>
  <circle cx="520" cy="50" r="80" fill="${t.a}" opacity="0.06"/>
  <circle cx="80" cy="250" r="60" fill="${t.a}" opacity="0.05"/>
  <text x="50" y="100" font-size="40" opacity="0.12" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${t.e}</text>
  <text x="520" y="240" font-size="36" opacity="0.1" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${t.e}</text>
  <text x="300" y="115" text-anchor="middle" font-size="64" filter="url(#glow)" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${t.e}</text>
  <rect x="100" y="135" width="400" height="1.5" fill="url(#line)" opacity="0.5"/>
  <rect x="245" y="145" width="110" height="22" rx="11" fill="${t.a}" opacity="0.15"/>
  <text x="300" y="161" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="800" fill="${t.a}" letter-spacing="2">${posLabel}</text>
  <text x="300" y="205" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="36" font-weight="900" fill="#ffffff">${word}</text>
  <text x="300" y="235" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#94a3b8">${shortDef}</text>
  <text x="300" y="268" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${t.a}" opacity="0.6" letter-spacing="1">LINGOPRO DICTIONARY</text>
</svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// ── Wikipedia fetch ──────────────────────────────────────────────────
function fetchWiki(word) {
    return new Promise((resolve) => {
        const w = word.includes(' ') ? word.split(' ')[0] : word;
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(w)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        https.get(url, { headers: { 'User-Agent': 'LingoPro/1.0' } }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const pages = json.query?.pages;
                    const page = Object.values(pages)[0];
                    if (page.pageid === -1 || !page.thumbnail) return resolve(null);
                    const src = page.thumbnail.source || '';
                    if (src.includes('Wikipedia-logo') || src.includes('.svg')) return resolve(null);
                    resolve(src);
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

// ── Main ─────────────────────────────────────────────────────────────
async function run() {
    console.log(`\n🚀 Fill images for up to ${LIMIT} words...\n`);

    const { data: rows, error } = await sb.from('global_dictionary')
        .select('word, data, image_url, image_source')
        .or('image_url.is.null,image_source.is.null,image_source.eq.none')
        .limit(LIMIT);

    if (error) { console.error('❌ DB error:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) { console.log('✅ All words already have images!'); return; }

    console.log(`Found ${rows.length} words needing images.\n`);
    let wiki = 0, placeholder = 0, errors = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const definition = row.data?.results?.[0]?.meanings?.[0]?.definition || '';
        const pos = row.data?.results?.[0]?.meanings?.[0]?.pos || '';

        // Try Wikipedia first
        let url = await fetchWiki(row.word);
        let source = 'placeholder';
        if (url) {
            source = 'wikipedia';
            wiki++;
        } else {
            url = buildSvg(row.word, definition, pos);
            placeholder++;
        }

        const { error: upErr } = await sb.from('global_dictionary')
            .update({ image_url: url, image_source: source })
            .eq('word', row.word);

        if (upErr) {
            console.error(`✗ ${row.word}:`, upErr.message);
            errors++;
        } else {
            const pct = Math.round(((i + 1) / rows.length) * 100);
            process.stdout.write(`\r  [${pct}%] ${i + 1}/${rows.length} | wiki:${wiki} svg:${placeholder} err:${errors}  `);
        }

        // Small delay to avoid hitting limits
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n\n✅ Done! wiki:${wiki} | svg:${placeholder} | errors:${errors}`);
}

run().catch(e => { console.error(e); process.exit(1); });
