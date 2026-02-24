const jwt = require('jsonwebtoken');
const store = require('../data/store');

function getSecret() {
  return process.env.JWT_SECRET || process.env.AUTH_SECRET || 'monostock-dev-secret-change-me';
}

/**
 * Soft auth — always calls next() but attaches req.user if a valid token is present.
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), getSecret());
    } catch {
      req.user = null;
    }
  }
  next();
}

/**
 * Hard auth gate — returns 401 if no valid user on request.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Requires the user to have at least the specified verification level.
 * Levels: 'email_verified'
 */
function requireVerification(level) {
  const users = require('../data/users');
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    try {
      const user = await users.getRawUser(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (level === 'email_verified' && !user.email_verified) {
        return res.status(403).json({ error: 'Email verification required', verification_required: 'email' });
      }
      if (level === 'domain_verified' && !user.domain_verified) {
        return res.status(403).json({ error: 'Domain verification required', verification_required: 'domain' });
      }

      req.verifiedUser = user;
      next();
    } catch (err) {
      console.error('[auth] verification check error:', err);
      res.status(500).json({ error: 'Verification check failed' });
    }
  };
}

/**
 * Check a user's access level to a folder.
 * Returns 'owner' | 'editor' | 'viewer' | null.
 */
async function checkFolderAccess(userId, folderId) {
  return store.getFolderRole(folderId, userId);
}

module.exports = { authMiddleware, requireAuth, requireVerification, checkFolderAccess };
