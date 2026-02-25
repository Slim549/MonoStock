/**
 * One-time script to restore local JSON data into Supabase.
 * Run: node restore-local-data.js
 */
require('dotenv').config();

const supabase = require('./data/supabase');
const store = require('./data/store');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Reading local JSON files...');

  const usersPath = path.join(__dirname, 'data', 'users.json');
  const dashPath = path.join(__dirname, 'data', 'dashboard.json');

  if (!fs.existsSync(usersPath) || !fs.existsSync(dashPath)) {
    console.error('Missing users.json or dashboard.json in server/data/');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const dashboard = JSON.parse(fs.readFileSync(dashPath, 'utf8'));

  // 1. Restore users
  console.log(`\nRestoring ${users.length} user(s)...`);
  for (const u of users) {
    const row = {
      id: u.id,
      email: u.email,
      name: u.name || '',
      password_hash: u.passwordHash,
      avatar: u.avatar || null,
      email_verified: u.emailVerified || false,
      verification_level: u.verificationLevel || 'none',
      domain: u.domain || null,
      domain_verified: u.domainVerified || false,
      verification_badge: u.verificationBadge || false,
      created_at: u.createdAt,
      updated_at: u.updatedAt
    };

    const { error } = await supabase
      .from('users')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error(`  FAILED user ${u.email}:`, error.message);
    } else {
      console.log(`  OK: ${u.email} (${u.id})`);
    }
  }

  // 2. Restore dashboard data scoped to the first user
  const userId = users[0]?.id;
  if (!userId) {
    console.error('No user found, cannot scope dashboard data.');
    process.exit(1);
  }

  console.log(`\nRestoring dashboard data for user ${userId}...`);
  console.log(`  Orders: ${(dashboard.orders || []).length}`);
  console.log(`  Customers: ${(dashboard.customers || []).length}`);
  console.log(`  Inventory: ${(dashboard.inventory || []).length}`);
  console.log(`  Folders: ${(dashboard.orderFolders || []).length}`);
  console.log(`  Trash: ${(dashboard.trash || []).length}`);
  console.log(`  Products: ${(dashboard.products || []).length}`);

  try {
    await store.save(dashboard, userId);
    console.log('\n  Dashboard data restored successfully.');
  } catch (err) {
    console.error('\n  FAILED to restore dashboard:', err.message);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
