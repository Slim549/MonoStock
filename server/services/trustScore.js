const supabase = require('../data/supabase');

// ═══════════════════════════════════════════════════════════
// Category caps — total must equal 100
// ═══════════════════════════════════════════════════════════

const CAPS = Object.freeze({
  identity:   40,
  business:   30,
  behavior:   20,
  reputation: 10
});

const PENALTY_SEVERITY = Object.freeze({
  low:      3,
  medium:   7,
  high:     15,
  critical: 30
});

// ═══════════════════════════════════════════════════════════
// Data collectors — each gathers raw data from Supabase
// ═══════════════════════════════════════════════════════════

async function safeFetch(query) {
  const result = await query;
  if (result.error && (result.error.code === 'PGRST205' || result.error.code === 'PGRST116')) {
    return { data: null, count: 0 };
  }
  return result;
}

async function fetchUserData(userId) {
  const { data: user } = await supabase
    .from('users').select('*').eq('id', userId).single();
  if (!user) return null;

  const [profileRes, connRes, msgSentRes, msgRecvRes, flagsRes, ordersRes] = await Promise.all([
    safeFetch(supabase.from('business_profiles').select('*').eq('user_id', userId).single()),
    safeFetch(supabase.from('connections').select('*')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)),
    safeFetch(supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)),
    safeFetch(supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)),
    safeFetch(supabase.from('user_flags').select('*').eq('user_id', userId).eq('resolved', false)),
    safeFetch(supabase.from('orders').select('id, data'))
  ]);

  return {
    user,
    profile: profileRes.data,
    connections: connRes.data || [],
    msgSent: msgSentRes.count || 0,
    msgReceived: msgRecvRes.count || 0,
    flags: flagsRes.data || [],
    orders: ordersRes.data || []
  };
}

// ═══════════════════════════════════════════════════════════
// Scoring functions — each returns { score, max, details }
// ═══════════════════════════════════════════════════════════

function clamp(val, max) {
  return Math.min(Math.max(Math.round(val), 0), max);
}

function scoreIdentity(data) {
  const { user } = data;
  const cap = CAPS.identity;
  const details = {};
  let raw = 0;

  // Email verified: 12 pts
  if (user.email_verified) { raw += 12; details.email_verified = 12; }
  else details.email_verified = 0;

  // Domain verified: 12 pts
  if (user.domain_verified) { raw += 12; details.domain_verified = 12; }
  else details.domain_verified = 0;

  // Verification badge: 6 pts
  if (user.verification_badge) { raw += 6; details.verification_badge = 6; }
  else details.verification_badge = 0;

  // Account age: up to 6 pts (1pt per 30 days, max 6)
  const ageDays = (Date.now() - Number(user.created_at)) / (1000 * 60 * 60 * 24);
  const ageScore = Math.min(Math.floor(ageDays / 30), 6);
  raw += ageScore;
  details.account_age = ageScore;

  // Avatar set: 4 pts
  if (user.avatar) { raw += 4; details.avatar = 4; }
  else details.avatar = 0;

  return { score: clamp(raw, cap), max: cap, details };
}

function scoreBusiness(data) {
  const { profile, connections } = data;
  const cap = CAPS.business;
  const details = {};
  let raw = 0;

  if (!profile) {
    return { score: 0, max: cap, details: { profile_exists: 0 } };
  }

  // Company name: 3 pts
  if (profile.company_name && profile.company_name.trim()) { raw += 3; details.company_name = 3; }
  else details.company_name = 0;

  // Logo: 3 pts
  if (profile.logo) { raw += 3; details.logo = 3; }
  else details.logo = 0;

  // Description (>50 chars = 2pts, >200 chars = 4pts)
  const descLen = (profile.description || '').length;
  if (descLen > 200) { raw += 4; details.description = 4; }
  else if (descLen > 50) { raw += 2; details.description = 2; }
  else details.description = 0;

  // Industry tags: 1pt per tag, max 3
  const tagScore = Math.min((profile.industry_tags || []).length, 3);
  raw += tagScore;
  details.industry_tags = tagScore;

  // Location (city + state + country): 1pt each, max 3
  let locScore = 0;
  if (profile.city && profile.city.trim()) locScore++;
  if (profile.state && profile.state.trim()) locScore++;
  if (profile.country && profile.country.trim()) locScore++;
  raw += locScore;
  details.location = locScore;

  // Business type set: 2 pts
  if (profile.business_type && profile.business_type !== 'Service') { raw += 2; details.business_type = 2; }
  else if (profile.business_type) { raw += 1; details.business_type = 1; }
  else details.business_type = 0;

  // Connections: 2pts per connection, max 12
  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const connScore = Math.min(connectedCount * 2, 12);
  raw += connScore;
  details.connections = connScore;

  return { score: clamp(raw, cap), max: cap, details };
}

function scoreBehavior(data) {
  const { user, msgSent, msgReceived, orders } = data;
  const cap = CAPS.behavior;
  const details = {};
  let raw = 0;

  // Messaging activity: up to 6 pts (1pt per 5 msgs sent, max 6)
  const msgScore = Math.min(Math.floor(msgSent / 5), 6);
  raw += msgScore;
  details.messages_sent = msgScore;

  // Responsiveness: up to 4 pts (based on receiving msgs — implies engagement)
  const respScore = Math.min(Math.floor(msgReceived / 5), 4);
  raw += respScore;
  details.responsiveness = respScore;

  // Order activity: up to 6 pts (1pt per 2 orders, max 6)
  const orderCount = orders.length;
  const orderScore = Math.min(Math.floor(orderCount / 2), 6);
  raw += orderScore;
  details.order_activity = orderScore;

  // Recent activity: up to 4 pts (logged in within last 7d=4, 30d=2, 90d=1)
  const lastActive = Number(user.updated_at);
  const daysSince = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);
  let actScore = 0;
  if (daysSince <= 7) actScore = 4;
  else if (daysSince <= 30) actScore = 2;
  else if (daysSince <= 90) actScore = 1;
  raw += actScore;
  details.recent_activity = actScore;

  return { score: clamp(raw, cap), max: cap, details };
}

function scoreReputation(data) {
  const { connections, flags } = data;
  const cap = CAPS.reputation;
  const details = {};
  let raw = 0;

  // Connection acceptance rate: up to 5 pts
  const received = connections.filter(c => c.receiver_id === data.user.id);
  const accepted = received.filter(c => c.status === 'connected').length;
  const declined = received.filter(c => c.status === 'declined').length;
  const total = accepted + declined;
  if (total > 0) {
    const rate = accepted / total;
    const accScore = Math.round(rate * 5);
    raw += accScore;
    details.acceptance_rate = accScore;
  } else {
    raw += 3; // neutral default
    details.acceptance_rate = 3;
  }

  // Not blocked by others: 3 pts (lose points per block)
  const blockedBy = connections.filter(c =>
    c.status === 'blocked' && c.requester_id !== data.user.id
  ).length;
  const blockPenalty = Math.min(blockedBy * 2, 3);
  const blockScore = 3 - blockPenalty;
  raw += blockScore;
  details.no_blocks = blockScore;

  // Clean flag record: 2 pts (no unresolved flags)
  if (flags.length === 0) { raw += 2; details.clean_record = 2; }
  else details.clean_record = 0;

  return { score: clamp(raw, cap), max: cap, details };
}

// ═══════════════════════════════════════════════════════════
// Penalty calculator
// ═══════════════════════════════════════════════════════════

function calculatePenalties(flags) {
  let totalPenalty = 0;
  const items = [];

  for (const flag of flags) {
    const pts = PENALTY_SEVERITY[flag.severity] || PENALTY_SEVERITY.low;
    totalPenalty += pts;
    items.push({ id: flag.id, type: flag.type, severity: flag.severity, points: pts, reason: flag.reason });
  }

  return { total: totalPenalty, items };
}

// ═══════════════════════════════════════════════════════════
// Main calculator — computes full breakdown and persists
// ═══════════════════════════════════════════════════════════

async function calculate(userId) {
  const data = await fetchUserData(userId);
  if (!data) return null;

  const identity   = scoreIdentity(data);
  const business   = scoreBusiness(data);
  const behavior   = scoreBehavior(data);
  const reputation = scoreReputation(data);
  const penalties  = calculatePenalties(data.flags);

  const rawTotal = identity.score + business.score + behavior.score + reputation.score;
  const total = Math.max(rawTotal - penalties.total, 0);

  const result = {
    user_id: userId,
    total: Math.min(total, 100),
    identity_score: identity.score,
    business_score: business.score,
    behavior_score: behavior.score,
    reputation_score: reputation.score,
    penalties: penalties.total,
    breakdown: {
      identity:   { score: identity.score, max: identity.max, details: identity.details },
      business:   { score: business.score, max: business.max, details: business.details },
      behavior:   { score: behavior.score, max: behavior.max, details: behavior.details },
      reputation: { score: reputation.score, max: reputation.max, details: reputation.details },
      penalties:  { total: penalties.total, items: penalties.items }
    },
    calculated_at: new Date().toISOString()
  };

  await persist(userId, result);
  return result;
}

async function persist(userId, result) {
  const row = {
    user_id: userId,
    total: result.total,
    identity_score: result.identity_score,
    business_score: result.business_score,
    behavior_score: result.behavior_score,
    reputation_score: result.reputation_score,
    penalties: result.penalties,
    breakdown: result.breakdown,
    calculated_at: result.calculated_at
  };

  const { error } = await supabase
    .from('trust_scores')
    .upsert(row, { onConflict: 'user_id' });

  if (error && error.code === 'PGRST205') {
    console.warn('[trust-score] trust_scores table missing — run migration');
    return;
  }
  if (error) console.error('[trust-score] persist error:', error);
}

// ═══════════════════════════════════════════════════════════
// Cached retrieval — returns last calculation or recalculates
// ═══════════════════════════════════════════════════════════

async function get(userId, maxAgeMs = 5 * 60 * 1000) {
  try {
    const { data, error } = await supabase
      .from('trust_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      const age = Date.now() - new Date(data.calculated_at).getTime();
      if (age < maxAgeMs) {
        return { success: true, ...data };
      }
    }
  } catch (_) { /* table may not exist yet */ }

  const result = await calculate(userId);
  if (!result) return null;
  return { success: true, ...result };
}

// ═══════════════════════════════════════════════════════════
// Flag management
// ═══════════════════════════════════════════════════════════

async function addFlag(userId, { type = 'flag', reason = '', severity = 'low', createdBy = null }) {
  const validSeverities = Object.keys(PENALTY_SEVERITY);
  if (!validSeverities.includes(severity)) severity = 'low';

  const { v4: uuidv4 } = require('uuid');
  const row = {
    id: uuidv4(),
    user_id: userId,
    type,
    reason,
    severity,
    resolved: false,
    created_by: createdBy,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from('user_flags').insert(row);
  if (error) throw error;

  await calculate(userId);
  return row;
}

async function resolveFlag(flagId) {
  const { data: flag, error: fetchErr } = await supabase
    .from('user_flags').select('*').eq('id', flagId).single();
  if (fetchErr || !flag) return { success: false, error: 'Flag not found' };

  const { error } = await supabase.from('user_flags')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', flagId);
  if (error) throw error;

  await calculate(flag.user_id);
  return { success: true };
}

async function getFlags(userId, includeResolved = false) {
  let q = supabase.from('user_flags').select('*').eq('user_id', userId);
  if (!includeResolved) q = q.eq('resolved', false);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════
// Recalculation trigger — call after mutations
// ═══════════════════════════════════════════════════════════

async function recalculate(userId) {
  return calculate(userId);
}

module.exports = {
  calculate,
  get,
  recalculate,
  addFlag,
  resolveFlag,
  getFlags,
  CAPS,
  PENALTY_SEVERITY
};
