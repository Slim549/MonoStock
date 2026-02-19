const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await store.load(userId);

    const sharedFolders = await store.getSharedFolders(userId);
    const sharedFolderIds = sharedFolders.map(f => f.id);
    const sharedOrders = await store.getOrdersByFolderIds(sharedFolderIds);
    const ownerIds = [...new Set(sharedFolders.map(f => f._ownerId))];
    const sharedCustomers = await store.getReferencedCustomers(sharedOrders, ownerIds);
    const ownerNames = await store.getSharedFolderOwnerNames(sharedFolders);

    sharedFolders.forEach(f => { f._ownerName = ownerNames[f._ownerId] || 'Unknown'; });

    res.json({
      ...data,
      sharedFolders,
      sharedOrders,
      sharedCustomers
    });
  } catch (err) {
    console.error('[dashboard] load error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid data structure' });
    }
    const saved = await store.save(data, req.user.id);
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error('[dashboard] save error:', err);
    res.status(500).json({ success: false, error: 'Failed to save dashboard' });
  }
});

router.get('/kpi', requireAuth, async (req, res) => {
  try {
    const data = await store.load(req.user.id);
    const orders = data.orders || [];
    const customers = data.customers || [];
    const inventory = data.inventory || [];

    const budgetedOrders = orders.filter(o => o.budget && o.budget.totalWithTax);
    const totalRevenue = budgetedOrders.reduce((s, o) => s + (o.budget.totalWithTax || 0), 0);
    const totalCost = budgetedOrders.reduce((s, o) => s + (o.budget.cost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const totalUnits = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
    const pendingOrders = orders.filter(o => (o.status || '').trim() === 'Pending').length;
    const lowStock = inventory.filter(i => (i.required || 0) - (i.inStock || 0) > 0).length;

    res.json({
      totalOrders: orders.length,
      totalRevenue,
      totalCost,
      totalProfit,
      totalUnits,
      totalCustomers: customers.length,
      avgOrderValue: budgetedOrders.length > 0 ? totalRevenue / budgetedOrders.length : 0,
      pendingOrders,
      lowStockItems: lowStock,
      budgetedOrderCount: budgetedOrders.length,
      margin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0
    });
  } catch (err) {
    console.error('[dashboard] kpi error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute KPIs' });
  }
});

module.exports = router;
