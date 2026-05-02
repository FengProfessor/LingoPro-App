require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { imageSearch } = require('@mudbill/duckduckgo-images-api');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_WORDS = ['love', 'like', 'many', 'dog', 'abundant', 'anxiety'];

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

async function run() {
    for (const word of TARGET_WORDS) {
        const { data, error } = await sb.from('global_dictionary').select('word').eq('word', word);
        
        if (error || !data || data.length === 0) {
            console.log(word + ': not in DB');
            continue;
        }
        
        const url = await fetchDDG(word);
        if (url) {
            const { error: upErr } = await sb.from('global_dictionary')
                .update({ image_url: url, image_source: 'duckduckgo' })
                .eq('word', word);
            console.log(word + ' -> ' + url);
        } else {
            console.log(word + ' -> Failed to find image');
        }
    }
    console.log('\nDone!');
}

run();
