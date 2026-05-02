const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260421_analytics_view.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing SQL migration...');
  
  // Using a known RPC if exists, or trying a workaround
  // Note: Standard Supabase JS doesn't have .sql(), so we rely on a pre-existing RPC 'exec_sql'
  // if it's missing, we suggest the user to run it manually.
  
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error executing SQL:', error);
    console.log('\n--- MANUAL ACTION REQUIRED ---');
    console.log('Please copy and run the contents of supabase/migrations/20260421_analytics_view.sql in your Supabase SQL Editor.');
    process.exit(1);
  }

  console.log('Migration successful!');
}

run();
