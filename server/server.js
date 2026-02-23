require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Core middleware ──
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// ── Auth (JWT token parsing on all /api routes) ──
app.use('/api', authMiddleware);

// ── Auth routes (public: register, login, status) ──
app.use('/api/auth', require('./routes/auth'));

// ── API routes ──
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/imports', require('./routes/imports'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/folders', require('./routes/collaborators'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/network', require('./routes/network'));

// ── Serve static frontend files from the project root ──
const webRoot = path.join(__dirname, '..');
app.use(express.static(webRoot, {
  index: 'index.html',
  extensions: ['html']
}));

// ── SPA fallback ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(webRoot, 'index.html'));
});

// ── Error handler ──
app.use(errorHandler);

// ── Periodic backup to Supabase ──
const backupMs = parseInt(process.env.BACKUP_INTERVAL_MS, 10) || 30 * 60 * 1000;
const backupInterval = setInterval(() => {
  store.createBackup().catch(err => console.error('[backup] interval error:', err));
}, backupMs);

// ── Graceful shutdown ──
function shutdown() {
  console.log('\nShutting down…');
  clearInterval(backupInterval);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Start ──
const server = app.listen(PORT, () => {
  console.log(`\n  MonoStock server running at http://localhost:${PORT}`);
  console.log(`  API base: http://localhost:${PORT}/api`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} is already in use.`);
    console.error(`  Fix: kill the other process, or set a different port:\n`);
    console.error(`    $env:PORT=3001; node server.js      # PowerShell`);
    console.error(`    PORT=3001 node server.js             # bash\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = app;
