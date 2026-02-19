const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { validateInventoryItem, checkInventoryAvailability } = require('../services/validation');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    let inventory = await store.getAll('inventory', req.user.id);
    const { filter, search } = req.query;

    if (search) {
      const q = search.toLowerCase();
      inventory = inventory.filter(i => (i.material || '').toLowerCase().includes(q));
    }
    if (filter === 'low') {
      inventory = inventory.filter(i => (i.required || 0) - (i.inStock || 0) > 0);
    } else if (filter === 'surplus') {
      inventory = inventory.filter(i => (i.required || 0) - (i.inStock || 0) < 0);
    } else if (filter === 'balanced') {
      inventory = inventory.filter(i => (i.required || 0) - (i.inStock || 0) === 0);
    }

    res.json({ success: true, inventory });
  } catch (err) {
    console.error('[inventory] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const input = req.body;

    const validation = validateInventoryItem(input);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const item = {
      id: input.id || uuidv4(),
      material: (input.material || '').trim(),
      inStock: Number(input.inStock) || 0,
      required: Number(input.required) || 0
    };

    await store.upsertRow('inventory', item.id, item, req.user.id);

    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error('[inventory] create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create inventory item' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await store.getById('inventory', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    const row = await store.getRowById('inventory', req.params.id);
    if (row.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updated = { ...existing, ...req.body };
    await store.upsertRow('inventory', req.params.id, updated, req.user.id);

    res.json({ success: true, item: updated });
  } catch (err) {
    console.error('[inventory] update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update inventory item' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await store.getById('inventory', req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Inventory item not found' });

    const row = await store.getRowById('inventory', req.params.id);
    if (row.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await store.deleteRow('inventory', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[inventory] delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete inventory item' });
  }
});

router.post('/check-availability', requireAuth, async (req, res) => {
  try {
    const inventory = await store.getAll('inventory', req.user.id);
    const { materials } = req.body;
    if (!Array.isArray(materials)) {
      return res.status(400).json({ success: false, error: 'materials array required' });
    }
    const result = checkInventoryAvailability(inventory, materials);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[inventory] check-availability error:', err);
    res.status(500).json({ success: false, error: 'Failed to check availability' });
  }
});

module.exports = router;
