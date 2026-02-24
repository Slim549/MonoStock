const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('\n  FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  console.error('  Set them in Render\'s Environment tab or in your local .env file.\n');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('  WARN: Using SUPABASE_KEY — set SUPABASE_SERVICE_ROLE_KEY for the service-role key.');
  console.warn('  The server requires the service-role key to bypass Row Level Security.\n');
}

const supabase = createClient(url, key);

module.exports = supabase;
