const { Router } = require('express');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const users = require('../data/users');
const { requireAuth } = require('../middleware/auth');
const trustScore = require('../services/trustScore');

const router = Router();

// ── Email transporter (configure via env vars) ──

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  return transporter;
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@monostock.app';
}

function getBaseUrl() {
  return process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

// ── Send verification email ──

router.post('/send-email', requireAuth, async (req, res) => {
  try {
    const user = await users.getRawUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.email_verified) {
      return res.json({ success: true, already_verified: true });
    }

    const token = await users.createVerificationToken(user.id, 'email');
    const verifyUrl = `${getBaseUrl()}/api/verification/verify-email?token=${token}`;

    const mailer = getTransporter();
    if (mailer) {
      await mailer.sendMail({
        from: getFromAddress(),
        to: user.email,
        subject: 'Verify your MonoStock email',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="margin:0 0 16px;">Verify your email</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#4F8EF7;color:#fff;
              text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0;">Verify Email</a>
            <p style="opacity:0.5;font-size:0.85em;">Or copy this link: ${verifyUrl}</p>
          </div>`
      });
      res.json({ success: true, sent: true });
    } else {
      res.json({ success: true, sent: false, token, message: 'SMTP not configured — token returned for manual verification' });
    }
  } catch (err) {
    console.error('[verification] send email error:', err);
    res.status(500).json({ success: false, error: 'Failed to send verification email' });
  }
});

// ── Verify email token ──

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send(verifyPage('Missing token', false));

    const record = await users.consumeVerificationToken(token, 'email');
    if (!record) return res.status(400).send(verifyPage('Invalid or expired token', false));

    await users.setEmailVerified(record.user_id);
    trustScore.recalculate(record.user_id).catch(() => {});
    res.send(verifyPage('Your email has been verified!', true));
  } catch (err) {
    console.error('[verification] verify email error:', err);
    res.status(500).send(verifyPage('Something went wrong', false));
  }
});

// ── Get verification status ──

router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await users.getRawUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const domainToken = await users.getDomainToken(req.user.id);

    res.json({
      success: true,
      email_verified: !!user.email_verified,
      verification_level: user.verification_level || 'none',
      domain: user.domain || null,
      domain_verified: !!user.domain_verified,
      verification_badge: !!user.verification_badge,
      domain_txt: domainToken ? `monostock-verify=${domainToken}` : null
    });
  } catch (err) {
    console.error('[verification] status error:', err);
    res.status(500).json({ success: false, error: 'Failed to get verification status' });
  }
});

// ── Start domain verification (set domain + get TXT record) ──

router.post('/start-domain', requireAuth, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || !domain.trim()) {
      return res.status(400).json({ success: false, error: 'Domain is required' });
    }

    const cleaned = domain.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '');

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)) {
      return res.status(400).json({ success: false, error: 'Invalid domain format' });
    }

    const user = await users.getRawUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (!user.email_verified) {
      return res.status(400).json({ success: false, error: 'You must verify your email first' });
    }

    const supabase = require('../data/supabase');
    await supabase.from('users')
      .update({ domain: cleaned, domain_verified: false, verification_badge: false, updated_at: Date.now() })
      .eq('id', req.user.id);

    const token = await users.createVerificationToken(req.user.id, 'domain');
    const txtRecord = `monostock-verify=${token}`;

    res.json({ success: true, domain: cleaned, txt_record: txtRecord });
  } catch (err) {
    console.error('[verification] start domain error:', err);
    res.status(500).json({ success: false, error: 'Failed to start domain verification' });
  }
});

// ── Check domain TXT record ──

router.post('/verify-domain', requireAuth, async (req, res) => {
  try {
    const user = await users.getRawUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (!user.domain) return res.status(400).json({ success: false, error: 'No domain set' });
    if (user.domain_verified) return res.json({ success: true, already_verified: true });

    const domainToken = await users.getDomainToken(req.user.id);
    if (!domainToken) return res.status(400).json({ success: false, error: 'No pending domain verification — start the process first' });

    const expectedTxt = `monostock-verify=${domainToken}`;

    let records;
    try {
      records = await dns.resolveTxt(user.domain);
    } catch (dnsErr) {
      return res.json({ success: false, error: `DNS lookup failed for ${user.domain} — make sure the TXT record is published` });
    }

    const flat = records.map(r => r.join('')).map(s => s.trim());
    const found = flat.some(r => r === expectedTxt);

    if (!found) {
      return res.json({
        success: false,
        error: 'TXT record not found. Please add the record and wait for DNS propagation (can take up to 48 hours).',
        expected: expectedTxt,
        found: flat
      });
    }

    await users.setDomainVerified(req.user.id);
    await users.consumeVerificationToken(domainToken, 'domain');
    trustScore.recalculate(req.user.id).catch(() => {});

    res.json({ success: true, domain_verified: true, verification_badge: true });
  } catch (err) {
    console.error('[verification] verify domain error:', err);
    res.status(500).json({ success: false, error: 'Domain verification failed' });
  }
});

// ── HTML page for email verification redirect ──

function verifyPage(message, success) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email Verification</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;
    margin:0;background:#f5f7fa;color:#1a1a2e;}
  .card{background:#fff;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:420px;}
  .icon{font-size:48px;margin-bottom:16px;}
  h2{margin:0 0 8px;}
  p{opacity:0.6;margin:0 0 24px;}
  a{display:inline-block;padding:12px 28px;background:#4F8EF7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;}
</style></head><body>
<div class="card">
  <div class="icon">${success ? '✅' : '❌'}</div>
  <h2>${message}</h2>
  <p>${success ? 'You can close this page and return to MonoStock.' : 'Please try again or request a new verification link.'}</p>
  <a href="/">Go to MonoStock</a>
</div></body></html>`;
}

module.exports = router;
