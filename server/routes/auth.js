const { Router } = require('express');
const jwt = require('jsonwebtoken');
const users = require('../data/users');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'monostock-dev-secret-change-me';
const JWT_EXPIRES = '7d';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES
  });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await users.createUser({ name: name.trim(), email: email.trim(), password });
    if (result.error) return res.status(409).json({ error: result.error });

    try {
      await users.createVerificationToken(result.user.id, 'email');
    } catch (tokenErr) {
      console.warn('[auth] could not create verification token on signup:', tokenErr.message);
    }

    const token = signToken(result.user);
    res.status(201).json({ success: true, token, user: result.user });
  } catch (err) {
    console.error('[auth] register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await users.verifyPassword(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const user = await users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    console.error('[auth] me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { name, email, avatar } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) {
      const existing = await users.findByEmail(email);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = email.trim();
    }
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = await users.updateUser(req.user.id, updates);
    if (!updated) return res.status(404).json({ error: 'User not found' });

    const token = signToken(updated);
    res.json({ success: true, user: updated, token });
  } catch (err) {
    console.error('[auth] profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/password', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await users.changePassword(req.user.id, currentPassword, newPassword);
    if (result.error) return res.status(400).json({ error: result.error });

    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    console.error('[auth] password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', async (_req, res) => {
  try {
    const has = await users.hasUsers();
    res.json({ hasUsers: has });
  } catch (err) {
    console.error('[auth] status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
