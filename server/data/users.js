const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./supabase');

async function findByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function findById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? toPublic(data) : null;
}

async function createUser({ name, email, password }) {
  const existing = await findByEmail(email);
  if (existing) return { error: 'An account with this email already exists' };

  const hash = await bcrypt.hash(password, 12);
  const now = Date.now();
  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    password_hash: hash,
    avatar: null,
    created_at: now,
    updated_at: now
  };

  const { error } = await supabase.from('users').insert(user);
  if (error) throw error;

  return { user: toPublic(user) };
}

async function verifyPassword(email, password) {
  const user = await findByEmail(email);
  if (!user) return null;

  const match = await bcrypt.compare(password, user.password_hash);
  return match ? toPublic(user) : null;
}

async function updateUser(id, updates) {
  const patch = { updated_at: Date.now() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.email !== undefined) patch.email = updates.email.toLowerCase();
  if (updates.avatar !== undefined) patch.avatar = updates.avatar;

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data ? toPublic(data) : null;
}

async function changePassword(id, currentPassword, newPassword) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !user) return { error: 'User not found' };

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return { error: 'Current password is incorrect' };

  const newHash = await bcrypt.hash(newPassword, 12);
  await supabase.from('users').update({ password_hash: newHash, updated_at: Date.now() }).eq('id', id);

  return { success: true };
}

async function hasUsers() {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });
  if (error) return false;
  return count > 0;
}

function toPublic(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
    createdAt: user.created_at
  };
}

async function searchUsers(query, excludeUserId) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10);
  if (error) throw error;
  return (data || []).filter(u => u.id !== excludeUserId);
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  verifyPassword,
  updateUser,
  changePassword,
  hasUsers,
  searchUsers
};
