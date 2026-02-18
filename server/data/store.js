/**
 * Supabase-backed data store.
 * Replaces the old JSON-file persistence with per-table Supabase operations.
 * Every public function is async.
 */
const supabase = require('./supabase');

const TABLES = ['orders', 'customers', 'inventory', 'order_folders', 'trash', 'products'];

// ── Generic helpers ──

async function getAll(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data || []).map(row => row.data);
}

async function getById(table, id) {
  const { data, error } = await supabase.from(table).select('data').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.data : null;
}

async function upsertRow(table, id, obj) {
  const { error } = await supabase.from(table).upsert({ id, data: obj }, { onConflict: 'id' });
  if (error) throw error;
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ── Dashboard-level load / save (used by dashboard & full-state endpoints) ──

async function load() {
  const [orders, customers, inventory, orderFolders, trash, products, title] = await Promise.all([
    getAll('orders'),
    getAll('customers'),
    getAll('inventory'),
    getAll('order_folders'),
    getAll('trash'),
    getAll('products'),
    getSetting('title')
  ]);
  return { title: title || 'MonoStock', orders, customers, inventory, orderFolders, trash, products };
}

async function save(data) {
  const safe = normalize(data);

  await Promise.all([
    replaceTable('orders', safe.orders),
    replaceTable('customers', safe.customers),
    replaceTable('inventory', safe.inventory),
    replaceTable('order_folders', safe.orderFolders),
    replaceTable('trash', safe.trash),
    replaceTable('products', safe.products),
    setSetting('title', safe.title)
  ]);

  return safe;
}

async function replaceTable(table, items) {
  await supabase.from(table).delete().neq('id', '');
  if (items.length > 0) {
    const rows = items.map(item => ({ id: item.id, data: item }));
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw error;
  }
}

function normalize(d) {
  if (!d || typeof d !== 'object') return { title: 'MonoStock', orders: [], customers: [], inventory: [], orderFolders: [], trash: [], products: [] };
  return {
    title: d.title || 'MonoStock',
    orders: Array.isArray(d.orders) ? d.orders : [],
    customers: Array.isArray(d.customers) ? d.customers : [],
    inventory: Array.isArray(d.inventory) ? d.inventory : [],
    orderFolders: Array.isArray(d.orderFolders) ? d.orderFolders : [],
    trash: Array.isArray(d.trash) ? d.trash : [],
    products: Array.isArray(d.products) ? d.products : []
  };
}

// ── App settings ──

async function getSetting(key) {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.value : null;
}

async function setSetting(key, value) {
  const { error } = await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

// ── Backup helpers (stored as JSON snapshots in Supabase) ──

async function createBackup() {
  try {
    const snapshot = await load();
    const { error } = await supabase.from('backups').insert({ data: snapshot });
    if (error) throw error;

    const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS, 10) || 20;
    const { data: all } = await supabase.from('backups').select('id').order('created_at', { ascending: false });
    if (all && all.length > MAX_BACKUPS) {
      const toDelete = all.slice(MAX_BACKUPS).map(b => b.id);
      await supabase.from('backups').delete().in('id', toDelete);
    }
    return true;
  } catch (err) {
    console.error('[store] backup failed:', err.message);
    return null;
  }
}

async function listBackups() {
  const { data, error } = await supabase
    .from('backups')
    .select('id, created_at')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(b => ({
    name: `backup_${b.id}`,
    id: b.id,
    date: b.created_at
  }));
}

async function restoreBackup(backupId) {
  const numericId = parseInt(String(backupId).replace('backup_', ''), 10);
  const { data, error } = await supabase.from('backups').select('data').eq('id', numericId).single();
  if (error || !data) return { success: false, error: 'Backup not found' };

  await createBackup();
  await save(data.data);
  return { success: true };
}

async function getBackupData(backupId) {
  const numericId = parseInt(String(backupId).replace('backup_', ''), 10);
  const { data, error } = await supabase.from('backups').select('data').eq('id', numericId).single();
  if (error || !data) return null;
  return data.data;
}

module.exports = {
  load,
  save,
  getAll,
  getById,
  upsertRow,
  deleteRow,
  createBackup,
  listBackups,
  restoreBackup,
  getBackupData,
  normalize
};
