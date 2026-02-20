/**
 * Supabase-backed data store with per-user workspace isolation
 * and folder-level collaboration support.
 */
const { v4: uuidv4 } = require('uuid');
const supabase = require('./supabase');

const TABLES = ['orders', 'customers', 'inventory', 'order_folders', 'trash', 'products'];

// ── Generic helpers (user-scoped) ──

async function getAll(table, userId) {
  const q = supabase.from(table).select('*');
  if (userId) q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(row => row.data);
}

async function getById(table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.data : null;
}

async function getRowById(table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function upsertRow(table, id, obj, userId) {
  const row = { id, data: obj };
  if (userId) row.user_id = userId;
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ── Dashboard load / save (user-scoped) ──

async function load(userId) {
  const [orders, customers, inventory, orderFolders, trash, products, title] = await Promise.all([
    getAll('orders', userId),
    getAll('customers', userId),
    getAll('inventory', userId),
    getAll('order_folders', userId),
    getAll('trash', userId),
    getAll('products', userId),
    getSetting('title')
  ]);
  return { title: title || 'MonoStock', orders, customers, inventory, orderFolders, trash, products };
}

async function save(data, userId) {
  const safe = normalize(data);

  await Promise.all([
    replaceTable('orders', safe.orders, userId),
    replaceTable('customers', safe.customers, userId),
    replaceTable('inventory', safe.inventory, userId),
    replaceTable('order_folders', safe.orderFolders, userId),
    replaceTable('trash', safe.trash, userId),
    replaceTable('products', safe.products, userId),
    setSetting('title', safe.title)
  ]);

  return safe;
}

async function replaceTable(table, items, userId) {
  if (userId) {
    await supabase.from(table).delete().eq('user_id', userId);
  } else {
    await supabase.from(table).delete().neq('id', '');
  }
  if (items.length > 0) {
    const rows = items.map(item => {
      const id = item.id != null ? String(item.id) : uuidv4();
      const row = { id, data: { ...item, id } };
      if (userId) row.user_id = userId;
      return row;
    });
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

// ── Collaboration helpers ──

async function getSharedFolders(userId) {
  const { data, error } = await supabase
    .from('folder_collaborators')
    .select('folder_id, role')
    .eq('user_id', userId);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const folderIds = data.map(r => r.folder_id);
  const roleMap = {};
  data.forEach(r => { roleMap[r.folder_id] = r.role; });

  const { data: folders, error: fErr } = await supabase
    .from('order_folders')
    .select('*')
    .in('id', folderIds);
  if (fErr) throw fErr;

  return (folders || []).map(f => ({
    ...f.data,
    _shared: true,
    _role: roleMap[f.id],
    _ownerId: f.user_id
  }));
}

async function getSharedFolderOwnerNames(folders) {
  const ownerIds = [...new Set(folders.map(f => f._ownerId).filter(Boolean))];
  if (ownerIds.length === 0) return {};
  const { data, error } = await supabase.from('users').select('id, name').in('id', ownerIds);
  if (error) return {};
  const map = {};
  (data || []).forEach(u => { map[u.id] = u.name; });
  return map;
}

async function getSharedOrders(folderIds) {
  if (!folderIds.length) return [];
  const { data, error } = await supabase.from('orders').select('*').in(
    'id',
    await _orderIdsInFolders(folderIds)
  );
  if (error) throw error;
  return (data || []).map(r => r.data);
}

async function _orderIdsInFolders(folderIds) {
  const { data, error } = await supabase.from('orders').select('id, data');
  if (error) throw error;
  return (data || [])
    .filter(r => r.data && folderIds.includes(r.data.folderId))
    .map(r => r.id);
}

async function getOrdersByFolderIds(folderIds) {
  if (!folderIds.length) return [];
  const { data, error } = await supabase.from('orders').select('*');
  if (error) throw error;
  return (data || [])
    .filter(r => r.data && folderIds.includes(r.data.folderId))
    .map(r => r.data);
}

async function getReferencedCustomers(orders, ownerUserIds) {
  if (!ownerUserIds.length) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .in('user_id', ownerUserIds);
  if (error) throw error;

  const customerNames = new Set();
  orders.forEach(o => { if (o.customerName) customerNames.add(o.customerName.toLowerCase()); });

  return (data || [])
    .filter(r => r.data && r.data.name && customerNames.has(r.data.name.toLowerCase()))
    .map(r => r.data);
}

async function addCollaborator(folderId, userId, role, invitedBy) {
  const id = uuidv4();
  const { error } = await supabase.from('folder_collaborators').upsert(
    { id, folder_id: folderId, user_id: userId, role, invited_by: invitedBy },
    { onConflict: 'folder_id,user_id' }
  );
  if (error) throw error;
}

async function removeCollaborator(folderId, userId) {
  const { error } = await supabase
    .from('folder_collaborators')
    .delete()
    .eq('folder_id', folderId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function updateCollaboratorRole(folderId, userId, role) {
  const { error } = await supabase
    .from('folder_collaborators')
    .update({ role })
    .eq('folder_id', folderId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function getCollaborators(folderId) {
  const { data, error } = await supabase
    .from('folder_collaborators')
    .select('user_id, role, created_at')
    .eq('folder_id', folderId);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const userIds = data.map(r => r.user_id);
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);
  if (uErr) throw uErr;

  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  return data.map(r => ({
    userId: r.user_id,
    role: r.role,
    createdAt: r.created_at,
    name: userMap[r.user_id]?.name || '',
    email: userMap[r.user_id]?.email || ''
  }));
}

async function getFolderRole(folderId, userId) {
  const row = await getRowById('order_folders', folderId);
  if (!row) return null;
  if (row.user_id === userId) return 'owner';

  const { data, error } = await supabase
    .from('folder_collaborators')
    .select('role')
    .eq('folder_id', folderId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.role : null;
}

// ── Backup helpers ──

async function createBackup(userId) {
  try {
    const snapshot = userId ? await load(userId) : await _loadAll();
    const row = { data: snapshot };
    if (userId) row.user_id = userId;
    const { error } = await supabase.from('backups').insert(row);
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

async function _loadAll() {
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
  getRowById,
  upsertRow,
  deleteRow,
  createBackup,
  listBackups,
  restoreBackup,
  getBackupData,
  normalize,
  getSharedFolders,
  getSharedFolderOwnerNames,
  getOrdersByFolderIds,
  getReferencedCustomers,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  getCollaborators,
  getFolderRole
};
