/**
 * Script chạy trực tiếp để fill ảnh thật (real photos) cho TẤT CẢ từ trong DB
 * Dùng DuckDuckGo Images để lấy ảnh thật theo yêu cầu của user.
 * node scripts/fill-all-images.js [--limit=N]
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { imageSearch } = require('@mudbill/duckduckgo-images-api');
const https = require('https');

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Parse CLI args
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 500;

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchDDG(word) {
    try {
        const query = `${word} stock photo`;
        const res = await imageSearch({ query, moderate: true });
        if (res && res.length > 0) {
            const validImage = res.find(r => r.image && !r.image.includes('koala.sh')) || res[0];
            return validImage.image;
        }
    } catch (e) { }
    return null;
}

// ── Main ─────────────────────────────────────────────────────────────
async function run() {
    console.log(`\n🚀 Fill real photos for up to ${LIMIT} words...\n`);

    // Lấy các từ đang dùng placeholder hoặc none
    const { data: rows, error } = await sb.from('global_dictionary')
        .select('word, data, image_url, image_source')
        .in('image_source', ['placeholder', 'none', 'wikipedia']) // Lấy cả wiki để đảm bảo ảnh đẹp nhất
        .limit(LIMIT);

    if (error) { console.error('❌ DB error:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) { console.log('✅ All words already have images!'); return; }

    console.log(`Found ${rows.length} words needing real photos.\n`);
    let ddg = 0, errors = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        let url = await fetchDDG(row.word);
        let source = 'duckduckgo';

        if (!url) {
            // Fallback to what we had or empty if really nothing
            console.log(`\n⚠️ ${row.word}: DDG failed to find image.`);
            errors++;
            continue;
        }

        const { error: upErr } = await sb.from('global_dictionary')
            .update({ image_url: url, image_source: source })
            .eq('word', row.word);

        if (upErr) {
            console.error(`\n✗ ${row.word}:`, upErr.message);
            errors++;
        } else {
            ddg++;
            const pct = Math.round(((i + 1) / rows.length) * 100);
            process.stdout.write(`\r  [${pct}%] ${i + 1}/${rows.length} | ddg:${ddg} err:${errors}  `);
        }

        // Delay 1.5s để tránh bị DuckDuckGo block (Rate Limit)
        await delay(1500);
    }

    console.log(`\n\n✅ Done! ddg:${ddg} | errors:${errors}`);
}

run().catch(e => { console.error(e); process.exit(1); });
