const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMoreWords() {
  const { data, error } = await supabase
    .from('words')
    .select('word, translation, example, pos')
    .limit(5);

  if (error) {
    console.error(error);
  } else {
    console.log('Words sample:', JSON.stringify(data, null, 2));
  }
}

checkMoreWords();
