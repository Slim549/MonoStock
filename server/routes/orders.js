const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { validateOrder, sanitizeOrder } = require('../services/validation');
const { calculateBudget } = require('../services/budget');

router.get('/', async (req, res) => {
  try {
    let orders = await store.getAll('orders');
    const { status, search, folderId } = req.query;

    if (folderId) {
      orders = orders.filter(o => o.folderId === folderId);
    }
    if (status) {
      orders = orders.filter(o => (o.status || '').toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        [o.orderNumber, o.customerName, o.customerCompany, o.location, o.status, o.notes]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error('[orders] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await store.getById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('[orders] get error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

router.post('/', async (req, res) => {
  try {
    const orderInput = req.body;
    const allOrders = await store.getAll('orders');

    const validation = validateOrder(orderInput, allOrders);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const order = sanitizeOrder({ ...orderInput, id: uuidv4() });
    await store.upsertRow('orders', order.id, order);

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('[orders] create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await store.getById('orders', req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Order not found' });

    const allOrders = await store.getAll('orders');
    const validation = validateOrder(req.body, allOrders);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const updated = sanitizeOrder({ ...existing, ...req.body, id: req.params.id });
    await store.upsertRow('orders', updated.id, updated);

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('[orders] update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const order = await store.getById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const trashItem = {
      id: uuidv4(),
      type: 'order',
      data: order,
      deletedAt: Date.now(),
      meta: { folderName: '', originalFolderId: order.folderId || null }
    };
    await store.upsertRow('trash', trashItem.id, trashItem);
    await store.deleteRow('orders', req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[orders] delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await store.getById('orders', req.params.id);
    if (!original) return res.status(404).json({ success: false, error: 'Order not found' });

    const clone = JSON.parse(JSON.stringify(original));
    clone.id = uuidv4();
    clone.orderNumber = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    clone.createdAt = Date.now();
    clone.status = 'Pending';
    clone.dateTime = new Date().toLocaleDateString('en-US');
    delete clone.budget;

    await store.upsertRow('orders', clone.id, clone);

    res.status(201).json({ success: true, order: clone });
  } catch (err) {
    console.error('[orders] duplicate error:', err);
    res.status(500).json({ success: false, error: 'Failed to duplicate order' });
  }
});

router.post('/:id/budget', async (req, res) => {
  try {
    const order = await store.getById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const budgetResult = calculateBudget(order, req.body);
    order.budget = budgetResult;
    if (budgetResult.orderProducts) {
      order.orderProducts = budgetResult.orderProducts;
      order.quantity = budgetResult.qty;
    }

    await store.upsertRow('orders', order.id, order);

    res.json({ success: true, budget: budgetResult });
  } catch (err) {
    console.error('[orders] budget error:', err);
    res.status(500).json({ success: false, error: 'Failed to save budget' });
  }
});

module.exports = router;
