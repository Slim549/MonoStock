const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const trustScore = require('../services/trustScore');

const VALID_BUSINESS_TYPES = ['Manufacturer', 'Supplier', 'Distributor', 'Retailer', 'Service'];
const VALID_VISIBILITIES = ['public', 'private'];
const VALID_REQUEST_SETTINGS = ['everyone', 'connected_only', 'none'];

// ── Business Profile ──

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await store.getBusinessProfile(req.user.id);
    res.json({ success: true, profile });
  } catch (err) {
    console.error('[network] get profile error:', err);
    if (err.message && err.message.includes('does not exist')) {
      return res.json({ success: true, profile: null });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load profile' });
  }
});

router.get('/profile/:userId', requireAuth, async (req, res) => {
  try {
    const profile = await store.getBusinessProfileByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    if (profile.visibility === 'private' && profile.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Profile is private' });
    }
    if (profile.hide_location) {
      profile.city = '';
      profile.state = '';
      profile.country = '';
    }
    const connStatus = await store.getConnectionStatus(req.user.id, req.params.userId);
    const users = require('../data/users');
    try {
      const owner = await users.getRawUser(req.params.userId);
      if (owner) profile.verification_badge = !!owner.verification_badge;
    } catch (_) {}
    res.json({ success: true, profile, connection: connStatus });
  } catch (err) {
    console.error('[network] get profile by user error:', err);
    res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
});

router.post('/profile', requireAuth, async (req, res) => {
  try {
    const p = req.body;
    if (!p.company_name || !p.company_name.trim()) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }
    if (p.business_type && !VALID_BUSINESS_TYPES.includes(p.business_type)) {
      return res.status(400).json({ success: false, error: 'Invalid business type' });
    }
    if (p.visibility && !VALID_VISIBILITIES.includes(p.visibility)) {
      return res.status(400).json({ success: false, error: 'Invalid visibility' });
    }
    if (p.allow_requests && !VALID_REQUEST_SETTINGS.includes(p.allow_requests)) {
      return res.status(400).json({ success: false, error: 'Invalid request setting' });
    }
    if (p.industry_tags && !Array.isArray(p.industry_tags)) {
      return res.status(400).json({ success: false, error: 'Industry tags must be an array' });
    }
    if (p.description && p.description.length > 2000) {
      return res.status(400).json({ success: false, error: 'Description too long (max 2000 chars)' });
    }
    if (p.logo && p.logo.length > 500000) {
      return res.status(400).json({ success: false, error: 'Logo too large' });
    }

    const profile = await store.upsertBusinessProfile(req.user.id, p);
    trustScore.recalculate(req.user.id).catch(() => {});
    res.json({ success: true, profile });
  } catch (err) {
    console.error('[network] save profile error:', err);
    const msg = err.message || err.details || 'Failed to save profile';
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Directory Search ──

router.get('/directory', requireAuth, async (req, res) => {
  try {
    const { keyword, industry, industry_custom, business_type, location, limit, offset } = req.query;
    const profiles = await store.searchBusinessProfiles({
      keyword, industry, industry_custom, business_type, location,
      exclude_user_id: req.user.id,
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0
    });

    const userConns = await store.getUserConnections(req.user.id);
    const connMap = {};
    userConns.forEach(c => {
      const otherId = c.requester_id === req.user.id ? c.receiver_id : c.requester_id;
      connMap[otherId] = { status: c.status, direction: c.requester_id === req.user.id ? 'sent' : 'received' };
    });
    const enriched = profiles.map(p => ({
      ...p,
      connection_status: connMap[p.user_id] || { status: 'none' }
    }));

    res.json({ success: true, profiles: enriched });
  } catch (err) {
    console.error('[network] directory error:', err);
    if (err.message && err.message.includes('does not exist')) {
      return res.json({ success: true, profiles: [] });
    }
    res.status(500).json({ success: false, error: err.message || 'Search failed' });
  }
});

// ── Connections ──

router.post('/connect/:userId', requireAuth, async (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot connect with yourself' });
    }
    const result = await store.sendConnectionRequest(req.user.id, req.params.userId);
    res.json(result);
  } catch (err) {
    console.error('[network] connect error:', err);
    res.status(500).json({ success: false, error: 'Failed to send request' });
  }
});

router.post('/connections/:id/respond', requireAuth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    const result = await store.respondToConnection(req.params.id, req.user.id, action);
    if (result.success) trustScore.recalculate(req.user.id).catch(() => {});
    res.json(result);
  } catch (err) {
    console.error('[network] respond error:', err);
    res.status(500).json({ success: false, error: 'Failed to respond' });
  }
});

router.delete('/connections/:id', requireAuth, async (req, res) => {
  try {
    const result = await store.removeConnection(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[network] remove connection error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove connection' });
  }
});

router.post('/block/:userId', requireAuth, async (req, res) => {
  try {
    const result = await store.blockConnection(req.user.id, req.params.userId);
    res.json(result);
  } catch (err) {
    console.error('[network] block error:', err);
    res.status(500).json({ success: false, error: 'Failed to block user' });
  }
});

router.get('/connections', requireAuth, async (req, res) => {
  try {
    const connections = await store.getConnectedProfiles(req.user.id);
    res.json({ success: true, connections });
  } catch (err) {
    console.error('[network] get connections error:', err);
    res.status(500).json({ success: false, error: 'Failed to load connections' });
  }
});

router.get('/requests', requireAuth, async (req, res) => {
  try {
    const requests = await store.getPendingRequests(req.user.id);
    res.json({ success: true, requests });
  } catch (err) {
    console.error('[network] get requests error:', err);
    res.status(500).json({ success: false, error: 'Failed to load requests' });
  }
});

// ── Messages ──

router.post('/messages/:userId', requireAuth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: 'Message body required' });
    }
    if (body.length > 5000) {
      return res.status(400).json({ success: false, error: 'Message too long' });
    }
    const result = await store.sendMessage(req.user.id, req.params.userId, body);
    res.json(result);
  } catch (err) {
    console.error('[network] send message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

router.get('/messages/:userId', requireAuth, async (req, res) => {
  try {
    const messages = await store.getConversation(req.user.id, req.params.userId);
    res.json({ success: true, messages });
  } catch (err) {
    console.error('[network] get messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
});

router.get('/unread', requireAuth, async (req, res) => {
  try {
    const count = await store.getUnreadMessageCount(req.user.id);
    res.json({ success: true, count });
  } catch (err) {
    res.json({ success: true, count: 0 });
  }
});

module.exports = router;
