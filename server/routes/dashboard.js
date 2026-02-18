const express = require('express');
const router = express.Router();
const store = require('../data/store');

router.get('/', async (req, res) => {
  try {
    const data = await store.load();
    res.json(data);
  } catch (err) {
    console.error('[dashboard] load error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid data structure' });
    }
    const saved = await store.save(data);
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error('[dashboard] save error:', err);
    res.status(500).json({ success: false, error: 'Failed to save dashboard' });
  }
});

router.get('/kpi', async (req, res) => {
  try {
    const data = await store.load();
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
