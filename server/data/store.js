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

// ── User preferences (per-user settings sync) ──

async function getUserPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.preferences : {};
}

async function setUserPreferences(userId, prefs) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, preferences: prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
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

// ── Business Profile helpers ──

async function getBusinessProfile(userId) {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function upsertBusinessProfile(userId, profile) {
  let existing = null;
  try { existing = await getBusinessProfile(userId); } catch (_) { /* table may not exist yet */ }

  const now = new Date().toISOString();
  const fields = {
    user_id: userId,
    company_name: profile.company_name || '',
    logo: profile.logo || null,
    description: profile.description || '',
    industry_tags: profile.industry_tags || [],
    business_type: profile.business_type || 'Service',
    city: profile.city || '',
    state: profile.state || '',
    country: profile.country || '',
    visibility: profile.visibility || 'public',
    allow_requests: profile.allow_requests || 'everyone',
    hide_location: !!profile.hide_location,
    updated_at: now
  };

  if (existing) {
    const { error } = await supabase
      .from('business_profiles')
      .update(fields)
      .eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, ...fields };
  } else {
    const row = { id: uuidv4(), ...fields, created_at: now };
    const { error } = await supabase
      .from('business_profiles')
      .insert(row);
    if (error) throw error;
    return row;
  }
}

async function searchBusinessProfiles({ keyword, industry, business_type, location, exclude_user_id, limit = 50, offset = 0 }) {
  let q = supabase
    .from('business_profiles')
    .select('*')
    .eq('visibility', 'public');

  if (exclude_user_id) q = q.neq('user_id', exclude_user_id);
  if (industry) q = q.contains('industry_tags', [industry]);
  if (business_type) q = q.eq('business_type', business_type);
  if (location) {
    q = q.or(`city.ilike.%${location}%,state.ilike.%${location}%,country.ilike.%${location}%`);
  }
  if (keyword) {
    q = q.or(`company_name.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  q = q.range(offset, offset + limit - 1).order('company_name');
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(p => {
    if (p.hide_location) { p.city = ''; p.state = ''; p.country = ''; }
    return p;
  });
}

async function getBusinessProfileByUserId(userId) {
  return getBusinessProfile(userId);
}

// ── Connection helpers ──

async function sendConnectionRequest(requesterId, receiverId) {
  const { data: existing } = await supabase
    .from('connections')
    .select('*')
    .or(`and(requester_id.eq.${requesterId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${requesterId})`)
    .limit(1);

  if (existing && existing.length > 0) {
    const conn = existing[0];
    if (conn.status === 'blocked') return { success: false, error: 'Cannot send request' };
    if (conn.status === 'connected') return { success: false, error: 'Already connected' };
    if (conn.status === 'pending') return { success: false, error: 'Request already pending' };
  }

  const receiverProfile = await getBusinessProfile(receiverId);
  if (receiverProfile && receiverProfile.allow_requests === 'none') {
    return { success: false, error: 'This user is not accepting connection requests' };
  }
  if (receiverProfile && receiverProfile.allow_requests === 'connected_only') {
    return { success: false, error: 'This user only accepts requests from mutual connections' };
  }

  const row = {
    id: uuidv4(),
    requester_id: requesterId,
    receiver_id: receiverId,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('connections').insert(row);
  if (error) throw error;
  return { success: true, connection: row };
}

async function respondToConnection(connectionId, userId, action) {
  const { data: conn, error: fetchErr } = await supabase
    .from('connections').select('*').eq('id', connectionId).single();
  if (fetchErr) throw fetchErr;
  if (!conn) return { success: false, error: 'Connection not found' };
  if (conn.receiver_id !== userId) return { success: false, error: 'Not authorized' };
  if (conn.status !== 'pending') return { success: false, error: 'Request is not pending' };

  const newStatus = action === 'accept' ? 'connected' : 'declined';
  const { error } = await supabase
    .from('connections')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', connectionId);
  if (error) throw error;
  return { success: true, status: newStatus };
}

async function removeConnection(connectionId, userId) {
  const { data: conn } = await supabase
    .from('connections').select('*').eq('id', connectionId).single();
  if (!conn) return { success: false, error: 'Not found' };
  if (conn.requester_id !== userId && conn.receiver_id !== userId) {
    return { success: false, error: 'Not authorized' };
  }
  const { error } = await supabase.from('connections').delete().eq('id', connectionId);
  if (error) throw error;
  return { success: true };
}

async function blockConnection(userId, targetId) {
  const { data: existing } = await supabase
    .from('connections')
    .select('*')
    .or(`and(requester_id.eq.${userId},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${userId})`)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('connections')
      .update({ status: 'blocked', updated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('connections').insert({
      id: uuidv4(), requester_id: userId, receiver_id: targetId,
      status: 'blocked', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }
  return { success: true };
}

async function getUserConnections(userId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getPendingRequests(userId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!data || data.length === 0) return [];
  const requesterIds = data.map(c => c.requester_id);
  const { data: profiles } = await supabase
    .from('business_profiles')
    .select('*')
    .in('user_id', requesterIds);
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', requesterIds);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  return data.map(c => ({
    ...c,
    requester_profile: profileMap[c.requester_id] || null,
    requester_user: userMap[c.requester_id] || null
  }));
}

async function getConnectedProfiles(userId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'connected');
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const otherIds = data.map(c => c.requester_id === userId ? c.receiver_id : c.requester_id);
  const { data: profiles } = await supabase
    .from('business_profiles')
    .select('*')
    .in('user_id', otherIds);
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', otherIds);

  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  return (profiles || []).map(p => ({
    ...p,
    user: userMap[p.user_id] || null,
    connection_id: data.find(c => c.requester_id === p.user_id || c.receiver_id === p.user_id)?.id
  }));
}

async function getConnectionStatus(userId, targetId) {
  const { data } = await supabase
    .from('connections')
    .select('*')
    .or(`and(requester_id.eq.${userId},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${userId})`)
    .limit(1);
  if (!data || data.length === 0) return { status: 'none' };
  return { status: data[0].status, connection_id: data[0].id, direction: data[0].requester_id === userId ? 'sent' : 'received' };
}

// ── Message helpers ──

async function sendMessage(senderId, receiverId, body) {
  const connStatus = await getConnectionStatus(senderId, receiverId);
  if (connStatus.status !== 'connected') {
    return { success: false, error: 'You must be connected to send messages' };
  }
  const row = {
    id: uuidv4(),
    sender_id: senderId,
    receiver_id: receiverId,
    body: body.trim(),
    read: false,
    created_at: new Date().toISOString()
  };
  const { error } = await supabase.from('messages').insert(row);
  if (error) throw error;
  return { success: true, message: row };
}

async function getConversation(userId, partnerId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;

  await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', partnerId)
    .eq('receiver_id', userId)
    .eq('read', false);

  return data || [];
}

async function getUnreadMessageCount(userId) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count || 0;
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
  getUserPreferences,
  setUserPreferences,
  getSharedFolders,
  getSharedFolderOwnerNames,
  getOrdersByFolderIds,
  getReferencedCustomers,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  getCollaborators,
  getFolderRole,
  // Network
  getBusinessProfile,
  upsertBusinessProfile,
  searchBusinessProfiles,
  getBusinessProfileByUserId,
  sendConnectionRequest,
  respondToConnection,
  removeConnection,
  blockConnection,
  getUserConnections,
  getPendingRequests,
  getConnectedProfiles,
  getConnectionStatus,
  sendMessage,
  getConversation,
  getUnreadMessageCount
};
