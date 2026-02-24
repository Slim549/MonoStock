const { Router } = require('express');
const trustScore = require('../services/trustScore');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// GET /api/trust-score/:userId — full breakdown (public)
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const result = await trustScore.get(req.params.userId);
    if (!result) return res.status(404).json({ success: false, error: 'User not found' });
    res.json(result);
  } catch (err) {
    console.error('[trust-score] get error:', err);
    res.status(500).json({ success: false, error: 'Failed to get trust score' });
  }
});

// POST /api/trust-score/:userId/recalculate — force recalc (own score only)
router.post('/:userId/recalculate', requireAuth, async (req, res) => {
  try {
    if (req.user.id !== req.params.userId) {
      return res.status(403).json({ success: false, error: 'Can only recalculate your own score' });
    }
    const result = await trustScore.recalculate(req.params.userId);
    if (!result) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[trust-score] recalculate error:', err);
    res.status(500).json({ success: false, error: 'Recalculation failed' });
  }
});

// POST /api/trust-score/:userId/flag — add a flag/dispute
router.post('/:userId/flag', requireAuth, async (req, res) => {
  try {
    if (req.user.id === req.params.userId) {
      return res.status(400).json({ success: false, error: 'Cannot flag yourself' });
    }
    const { type, reason, severity } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }
    const flag = await trustScore.addFlag(req.params.userId, {
      type: type || 'flag',
      reason: reason.trim(),
      severity: severity || 'low',
      createdBy: req.user.id
    });
    res.json({ success: true, flag });
  } catch (err) {
    console.error('[trust-score] flag error:', err);
    res.status(500).json({ success: false, error: 'Failed to add flag' });
  }
});

// POST /api/trust-score/flags/:flagId/resolve — resolve a flag
router.post('/flags/:flagId/resolve', requireAuth, async (req, res) => {
  try {
    const result = await trustScore.resolveFlag(req.params.flagId);
    res.json(result);
  } catch (err) {
    console.error('[trust-score] resolve flag error:', err);
    res.status(500).json({ success: false, error: 'Failed to resolve flag' });
  }
});

// GET /api/trust-score/:userId/flags — get user's flags
router.get('/:userId/flags', requireAuth, async (req, res) => {
  try {
    const includeResolved = req.query.all === 'true';
    const flags = await trustScore.getFlags(req.params.userId, includeResolved);
    res.json({ success: true, flags });
  } catch (err) {
    console.error('[trust-score] get flags error:', err);
    res.status(500).json({ success: false, error: 'Failed to get flags' });
  }
});

module.exports = router;
