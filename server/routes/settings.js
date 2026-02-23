const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { requireAuth } = require('../middleware/auth');

// GET /api/settings — load preferences for the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const preferences = await store.getUserPreferences(req.user.id);
    res.json({ success: true, preferences });
  } catch (err) {
    console.error('[settings] load error:', err);
    res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
});

// POST /api/settings — save preferences for the authenticated user
router.post('/', requireAuth, async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return res.status(400).json({ success: false, error: 'Invalid preferences object' });
    }
    await store.setUserPreferences(req.user.id, preferences);
    res.json({ success: true });
  } catch (err) {
    console.error('[settings] save error:', err);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

module.exports = router;
