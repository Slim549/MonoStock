const express = require('express');
const router = express.Router();
const store = require('../data/store');

router.get('/', async (req, res) => {
  try {
    const backups = await store.listBackups();
    res.json({ success: true, backups });
  } catch (err) {
    console.error('[backups] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to list backups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await store.createBackup();
    if (result) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Backup creation failed' });
    }
  } catch (err) {
    console.error('[backups] create error:', err);
    res.status(500).json({ success: false, error: 'Backup creation failed' });
  }
});

router.post('/restore', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Backup name required' });

    const result = await store.restoreBackup(name);
    res.json(result);
  } catch (err) {
    console.error('[backups] restore error:', err);
    res.status(500).json({ success: false, error: 'Restore failed' });
  }
});

router.get('/download/:name', async (req, res) => {
  try {
    const data = await store.getBackupData(req.params.name);
    if (!data) return res.status(404).json({ success: false, error: 'Backup not found' });

    const jsonStr = JSON.stringify(data, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.json"`);
    res.send(jsonStr);
  } catch (err) {
    console.error('[backups] download error:', err);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

module.exports = router;
