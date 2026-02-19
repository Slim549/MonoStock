const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('\n  FATAL: SUPABASE_URL and SUPABASE_KEY environment variables are required.');
  console.error('  Set them in Render\'s Environment tab or in your local .env file.\n');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = supabase;
