require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getTheme(word, def) {
    const c = (word + ' ' + (def || '')).toLowerCase();
    if (/abundant|plenty|large|quantity|numerous|overflow/.test(c)) return { e: '🌾', c1: '#1a1200', c2: '#3d2b00', a: '#f5a623' };
    if (/anxiety|fear|worry|stress|nervous|emotion/.test(c)) return { e: '💭', c1: '#1a0533', c2: '#2d1b69', a: '#c084fc' };
    if (/academic|analysis|research|study|theory|knowledge/.test(c)) return { e: '📚', c1: '#0a1628', c2: '#1a2f5e', a: '#60a5fa' };
    if (/business|finance|money|profit|market|economy/.test(c)) return { e: '💼', c1: '#0f1c10', c2: '#1a3320', a: '#4ade80' };
    if (/move|action|achieve|accomplish|perform/.test(c)) return { e: '⚡', c1: '#1c0a00', c2: '#3d1a00', a: '#f97316' };
    const d = [
        { e: '📖', c1: '#0f172a', c2: '#1e293b', a: '#4CAF50' },
        { e: '🌟', c1: '#0c1222', c2: '#1e2a4a', a: '#60a5fa' },
        { e: '🎯', c1: '#1a0f0f', c2: '#2d1a1a', a: '#f87171' },
        { e: '💡', c1: '#0a1210', c2: '#1a2420', a: '#2dd4bf' },
    ];
    return d[word.charCodeAt(0) % d.length];
}

function buildSvg(word, definition, pos) {
    const t = getTheme(word, definition);
    const shortDef = (definition || '').length > 55 ? (definition || '').substring(0, 52) + '...' : (definition || '');
    const posLabel = (pos || 'WORD').toUpperCase();
    const lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">',
        '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
        '<stop offset="0%" style="stop-color:' + t.c1 + '"/>',
        '<stop offset="100%" style="stop-color:' + t.c2 + '"/>',
        '</linearGradient></defs>',
        '<rect width="600" height="300" fill="url(#bg)"/>',
        '<circle cx="520" cy="50" r="80" fill="' + t.a + '" opacity="0.06"/>',
        '<circle cx="80" cy="250" r="60" fill="' + t.a + '" opacity="0.05"/>',
        '<text x="300" y="115" text-anchor="middle" font-size="64" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">' + t.e + '</text>',
        '<rect x="245" y="130" width="110" height="22" rx="11" fill="' + t.a + '" opacity="0.15"/>',
        '<text x="300" y="146" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="800" fill="' + t.a + '" letter-spacing="2">' + posLabel + '</text>',
        '<text x="300" y="195" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="36" font-weight="900" fill="#ffffff">' + word + '</text>',
        '<text x="300" y="225" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#94a3b8">' + shortDef + '</text>',
        '<text x="300" y="260" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="' + t.a + '" opacity="0.6" letter-spacing="1">LINGOPRO DICTIONARY</text>',
        '</svg>'
    ];
    return 'data:image/svg+xml;base64,' + Buffer.from(lines.join('')).toString('base64');
}

const TARGET_WORDS = [
    'abundant','anxiety','accumulate','accessible','accurate','acquire','adequate','adjacent',
    'adjust','administration','advocate','aggregate','allocate','alter','alternative','ambiguous',
    'amend','analogy','anticipate','apparent','appreciate','approach','appropriate','approximate',
    'arbitrary','assess','assign','assist','assume','attain','attitude','attribute','available'
];

async function run() {
    for (const word of TARGET_WORDS) {
        const { data, error } = await sb.from('global_dictionary')
            .select('word, data')
            .eq('word', word);
        
        if (error || !data || data.length === 0) {
            console.log(word + ': not in DB');
            continue;
        }
        
        const row = data[0];
        const def = (row.data && row.data.results && row.data.results[0] && row.data.results[0].meanings && row.data.results[0].meanings[0])
            ? row.data.results[0].meanings[0].definition || ''
            : '';
        const pos = (row.data && row.data.results && row.data.results[0] && row.data.results[0].meanings && row.data.results[0].meanings[0])
            ? row.data.results[0].meanings[0].pos || ''
            : '';
        
        const url = buildSvg(word, def, pos);
        const { error: upErr } = await sb.from('global_dictionary')
            .update({ image_url: url, image_source: 'placeholder' })
            .eq('word', word);
        
        if (upErr) {
            console.log(word + ': ERROR - ' + upErr.message);
        } else {
            console.log(word + ': OK (def: ' + def.substring(0, 40) + ')');
        }
    }
    console.log('\nDone!');
}

run();
