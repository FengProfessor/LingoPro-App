const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateToFSRS() {
  console.log('--- FSRS Data Migration Start ---');
  
  // 1. Fetch all records that have intervals but no stability
  const { data: records, error } = await supabase
    .from('srs_progress')
    .select('id, interval_days, difficulty, stability')
    .or('stability.eq.0,stability.is.null');

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  console.log(`Migrating ${records.length} records...`);

  for (const record of records) {
    // Initial guess: stability = current interval
    // Default difficulty = 5.0 (neutral)
    const { error: updateError } = await supabase
      .from('srs_progress')
      .update({
        stability: record.interval_days || 1,
        difficulty: 5.0,
        algorithm_version: 'fsrs-v5-migrated'
      })
      .eq('id', record.id);

    if (updateError) {
      console.error(`Failed to update ${record.id}:`, updateError.message);
    }
  }

  console.log('--- Migration Finished ---');
}

migrateToFSRS();
