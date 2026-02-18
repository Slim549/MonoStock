const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { validateCustomer } = require('../services/validation');

router.get('/', async (req, res) => {
  try {
    let customers = await store.getAll('customers');
    const { search } = req.query;

    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(c =>
        [c.name, c.company, c.email, c.phone].filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, customers });
  } catch (err) {
    console.error('[customers] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

router.post('/', async (req, res) => {
  try {
    const input = req.body;

    const validation = validateCustomer(input);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const customer = {
      id: input.id || uuidv4(),
      name: (input.name || '').trim(),
      company: (input.company || '').trim(),
      phone: (input.phone || '').trim(),
      email: (input.email || '').trim(),
      billingAddress: (input.billingAddress || '').trim(),
      shipTo: (input.shipTo || '').trim()
    };

    await store.upsertRow('customers', customer.id, customer);

    res.status(201).json({ success: true, customer });
  } catch (err) {
    console.error('[customers] create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create customer' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await store.getById('customers', req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Customer not found' });

    const validation = validateCustomer(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const updated = { ...existing, ...req.body, id: req.params.id };
    await store.upsertRow('customers', updated.id, updated);

    res.json({ success: true, customer: updated });
  } catch (err) {
    console.error('[customers] update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update customer' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await store.getById('customers', req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Customer not found' });

    await store.deleteRow('customers', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[customers] delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete customer' });
  }
});

module.exports = router;
