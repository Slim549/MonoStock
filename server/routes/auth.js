const { Router } = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const users = require('../data/users');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'monostock-dev-secret-change-me';
const JWT_EXPIRES = '7d';

let _mailer = null;
function getMailer() {
  if (_mailer) return _mailer;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  _mailer = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return _mailer;
}
function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@monostock.app';
}
function getBaseUrl() {
  return process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

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

// ── Forgot password: send reset link via email ──

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await users.findByEmail(email.trim());
    if (!user) {
      // Don't reveal whether the account exists
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    const token = await users.createVerificationToken(user.id, 'password_reset');
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

    const mailer = getMailer();
    if (mailer) {
      await mailer.sendMail({
        from: getFromAddress(),
        to: user.email,
        subject: 'Reset your MonoStock password',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="margin:0 0 16px;">Password Reset</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 24 hours.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#4F8EF7;color:#fff;
              text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0;">Reset Password</a>
            <p style="opacity:0.5;font-size:0.85em;">If you didn't request this, you can safely ignore this email.</p>
            <p style="opacity:0.4;font-size:0.8em;">Or copy this link: ${resetUrl}</p>
          </div>`
      });
      res.json({ success: true, sent: true, message: 'If that email is registered, a reset link has been sent.' });
    } else {
      res.json({ success: true, sent: false, message: 'SMTP not configured. Contact the administrator.' });
    }
  } catch (err) {
    console.error('[auth] forgot-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reset password with token ──

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) return res.status(400).json({ error: 'Reset token is required' });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await users.resetPasswordWithToken(token, newPassword);
    if (result.error) return res.status(400).json({ error: result.error });

    res.json({ success: true, message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('[auth] reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
