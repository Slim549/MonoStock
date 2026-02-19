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
 * Check a user's access level to a folder.
 * Returns 'owner' | 'editor' | 'viewer' | null.
 */
async function checkFolderAccess(userId, folderId) {
  return store.getFolderRole(folderId, userId);
}

module.exports = { authMiddleware, requireAuth, checkFolderAccess };
