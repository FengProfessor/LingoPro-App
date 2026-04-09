const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- Checking srs_progress Table Schema ---');
  
  // Method 1: Try to insert a float and see the error (already done by browser, it failed)
  // Method 2: Query information_schema via RPC if available, or just check types by reading row
  const { data, error } = await supabase
    .from('srs_progress')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error reading table:', error);
    return;
  }

  console.log('Data sample:', data);
  
  // I'll try to find columns via a raw query if I had one, but I'll assume it's integer based on the error.
  // The error: "invalid input syntax for type integer: \"0.00034722222222222224\""
  // This PROVES interval_days (or another column) is integer.
}

checkSchema();
