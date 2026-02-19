const express = require('express');
const router = express.Router();
const store = require('../data/store');
const users = require('../data/users');
const { requireAuth } = require('../middleware/auth');

router.get('/shared', requireAuth, async (req, res) => {
  try {
    const sharedFolders = await store.getSharedFolders(req.user.id);
    const ownerNames = await store.getSharedFolderOwnerNames(sharedFolders);
    sharedFolders.forEach(f => { f._ownerName = ownerNames[f._ownerId] || 'Unknown'; });
    res.json({ success: true, folders: sharedFolders });
  } catch (err) {
    console.error('[collaborators] shared folders error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shared folders' });
  }
});

router.get('/:folderId/collaborators', requireAuth, async (req, res) => {
  try {
    const role = await store.getFolderRole(req.params.folderId, req.user.id);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the folder owner can view collaborators' });
    }

    const collaborators = await store.getCollaborators(req.params.folderId);
    res.json({ success: true, collaborators });
  } catch (err) {
    console.error('[collaborators] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch collaborators' });
  }
});

router.post('/:folderId/collaborators', requireAuth, async (req, res) => {
  try {
    const role = await store.getFolderRole(req.params.folderId, req.user.id);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the folder owner can add collaborators' });
    }

    const { email, role: collabRole } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    if (!['viewer', 'editor'].includes(collabRole)) {
      return res.status(400).json({ success: false, error: 'Role must be viewer or editor' });
    }

    const user = await users.findByEmail(email);
    if (!user) return res.status(404).json({ success: false, error: 'No user found with that email' });
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot add yourself as a collaborator' });
    }

    await store.addCollaborator(req.params.folderId, user.id, collabRole, req.user.id);

    res.status(201).json({
      success: true,
      collaborator: { userId: user.id, name: user.name, email: user.email, role: collabRole }
    });
  } catch (err) {
    console.error('[collaborators] add error:', err);
    res.status(500).json({ success: false, error: 'Failed to add collaborator' });
  }
});

router.put('/:folderId/collaborators/:userId', requireAuth, async (req, res) => {
  try {
    const role = await store.getFolderRole(req.params.folderId, req.user.id);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the folder owner can update roles' });
    }

    const { role: newRole } = req.body;
    if (!['viewer', 'editor'].includes(newRole)) {
      return res.status(400).json({ success: false, error: 'Role must be viewer or editor' });
    }

    await store.updateCollaboratorRole(req.params.folderId, req.params.userId, newRole);
    res.json({ success: true });
  } catch (err) {
    console.error('[collaborators] update role error:', err);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

router.delete('/:folderId/collaborators/:userId', requireAuth, async (req, res) => {
  try {
    const role = await store.getFolderRole(req.params.folderId, req.user.id);
    if (role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the folder owner can remove collaborators' });
    }

    await store.removeCollaborator(req.params.folderId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[collaborators] remove error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove collaborator' });
  }
});

router.get('/users/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const results = await users.searchUsers(q, req.user.id);
    res.json({ success: true, users: results });
  } catch (err) {
    console.error('[collaborators] user search error:', err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

module.exports = router;
