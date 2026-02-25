const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
    email_verified: false,
    verification_level: 'none',
    domain: null,
    domain_verified: false,
    verification_badge: false,
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
    email_verified: !!user.email_verified,
    verification_level: user.verification_level || 'none',
    domain: user.domain || null,
    domain_verified: !!user.domain_verified,
    verification_badge: !!user.verification_badge,
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

// ── Email verification tokens ──

async function createVerificationToken(userId, type = 'email') {
  const { error: delErr } = await supabase
    .from('verification_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('type', type);
  if (delErr && delErr.code !== 'PGRST205') console.warn('[users] cleanup token error:', delErr);

  const token = crypto.randomBytes(32).toString('hex');
  const row = {
    id: uuidv4(),
    user_id: userId,
    token,
    type,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from('verification_tokens').insert(row);
  if (error) throw error;
  return token;
}

async function consumeVerificationToken(token, type = 'email') {
  const { data, error } = await supabase
    .from('verification_tokens')
    .select('*')
    .eq('token', token)
    .eq('type', type)
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('verification_tokens').delete().eq('id', data.id);
    return null;
  }

  await supabase.from('verification_tokens').delete().eq('id', data.id);
  return data;
}

async function setEmailVerified(userId) {
  const { error } = await supabase
    .from('users')
    .update({
      email_verified: true,
      verification_level: 'email_verified',
      updated_at: Date.now()
    })
    .eq('id', userId);
  if (error) throw error;
}

// ── Domain verification ──

async function setDomain(userId, domain) {
  const txtValue = 'monostock-verify=' + crypto.randomBytes(16).toString('hex');
  const { error } = await supabase
    .from('users')
    .update({ domain, updated_at: Date.now() })
    .eq('id', userId);
  if (error) throw error;

  const token = await createVerificationToken(userId, 'domain');
  return { txtValue: 'monostock-verify=' + token, domain };
}

async function setDomainVerified(userId) {
  const { error } = await supabase
    .from('users')
    .update({
      domain_verified: true,
      verification_badge: true,
      updated_at: Date.now()
    })
    .eq('id', userId);
  if (error) throw error;
}

async function getRawUser(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function getDomainToken(userId) {
  const { data, error } = await supabase
    .from('verification_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('type', 'domain')
    .single();
  if (error || !data) return null;
  return data.token;
}

async function resetPasswordWithToken(token, newPassword) {
  const record = await consumeVerificationToken(token, 'password_reset');
  if (!record) return { error: 'Invalid or expired reset link' };

  const newHash = await bcrypt.hash(newPassword, 12);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: newHash, updated_at: Date.now() })
    .eq('id', record.user_id);
  if (error) throw error;
  return { success: true };
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  verifyPassword,
  updateUser,
  changePassword,
  hasUsers,
  searchUsers,
  createVerificationToken,
  consumeVerificationToken,
  setEmailVerified,
  setDomain,
  setDomainVerified,
  getRawUser,
  getDomainToken,
  resetPasswordWithToken
};
