/**
 * Server-side validation for orders, customers, inventory.
 * Prevents invalid data and overselling.
 */
const { v4: uuidv4 } = require('uuid');

// ── Order validation ──

function validateOrder(order, existingOrders = []) {
  const errors = [];

  if (!order.customerName || !order.customerName.trim()) {
    errors.push('Customer name is required');
  }

  const qty = Number(order.quantity);
  if (!qty || qty < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (order.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customerEmail)) {
    errors.push('Invalid email format');
  }

  if (order.orderNumber) {
    const duplicate = existingOrders.find(
      o => o.orderNumber === order.orderNumber && o.id !== order.id
    );
    if (duplicate) {
      errors.push(`Order number "${order.orderNumber}" already exists`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function sanitizeOrder(order) {
  return {
    id: order.id || uuidv4(),
    orderNumber: (order.orderNumber || '').trim() || ('ORD-' + Math.floor(1000 + Math.random() * 9000)),
    dateTime: order.dateTime || new Date().toLocaleDateString('en-US'),
    status: order.status || 'Pending',
    AccountingNameAccountingNum: (order.AccountingNameAccountingNum || '').trim(),
    customerName: (order.customerName || '').trim(),
    customerCompany: (order.customerCompany || '').trim(),
    customerPhone: (order.customerPhone || '').trim(),
    customerEmail: (order.customerEmail || '').trim(),
    billingAddress: (order.billingAddress || '').trim(),
    shipTo: (order.shipTo || '').trim(),
    location: (order.location || '').trim(),
    unitType: (order.unitType || '').trim(),
    quantity: Number(order.quantity) || 1,
    notes: (order.notes || '').trim(),
    folderId: order.folderId || null,
    budget: order.budget || null,
    orderProducts: Array.isArray(order.orderProducts) ? order.orderProducts : undefined,
    createdAt: order.createdAt || Date.now()
  };
}

// ── Inventory oversell check ──

function checkInventoryAvailability(inventory, requiredMaterials) {
  const warnings = [];
  for (const req of requiredMaterials) {
    const item = inventory.find(i =>
      (i.material || '').toLowerCase() === (req.material || '').toLowerCase()
    );
    if (!item) {
      warnings.push(`Material "${req.material}" not found in inventory`);
      continue;
    }
    const available = (item.inStock || 0);
    if (available < (req.quantity || 0)) {
      warnings.push(
        `Insufficient stock for "${req.material}": need ${req.quantity}, have ${available}`
      );
    }
  }
  return { sufficient: warnings.length === 0, warnings };
}

// ── Customer validation ──

function validateCustomer(customer) {
  const errors = [];
  if (!customer.name || !customer.name.trim()) {
    errors.push('Customer name is required');
  }
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    errors.push('Invalid email format');
  }
  return { valid: errors.length === 0, errors };
}

// ── Inventory validation ──

function validateInventoryItem(item) {
  const errors = [];
  if (!item.material || !item.material.trim()) {
    errors.push('Material name is required');
  }
  if (item.inStock != null && Number(item.inStock) < 0) {
    errors.push('In-stock quantity cannot be negative');
  }
  if (item.required != null && Number(item.required) < 0) {
    errors.push('Required quantity cannot be negative');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateOrder,
  sanitizeOrder,
  checkInventoryAvailability,
  validateCustomer,
  validateInventoryItem
};
