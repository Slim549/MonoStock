/**
 * Budget calculation service — extracted from renderer.js calculateTotal().
 * Server-authoritative: the frontend can preview, but final numbers come from here.
 */

function calculateBudget(order, budgetInput) {
  const qty = Number(order.quantity) || 1;
  const multiMode = Array.isArray(budgetInput.orderProducts) && budgetInput.orderProducts.length > 0;

  let unitPrice, productSubtotal, effectiveQty;

  if (multiMode) {
    effectiveQty = budgetInput.orderProducts.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    productSubtotal = budgetInput.orderProducts.reduce(
      (s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0
    );
    unitPrice = effectiveQty > 0 ? productSubtotal / effectiveQty : 0;
  } else {
    unitPrice = Number(budgetInput.unitPrice) || 0;
    effectiveQty = qty;
    productSubtotal = unitPrice * qty;
  }

  const taxPercent = Number(budgetInput.taxRate != null ? budgetInput.taxRate * 100 : budgetInput.taxPercent) || 7;
  const freight = Number(budgetInput.freight) || 0;
  const lineItems = Array.isArray(budgetInput.lineItems) ? budgetInput.lineItems : [];

  const beforeTaxItems = lineItems.filter(li => (li.taxOption || 'before') === 'before');
  const noTaxItems = lineItems.filter(li => li.taxOption === 'none');
  const afterTaxItems = lineItems.filter(li => li.taxOption === 'after');

  let taxableSubtotal = productSubtotal + freight;
  beforeTaxItems.forEach(li => {
    const amt = Math.abs(Number(li.amount) || 0);
    taxableSubtotal += li.type === 'deduct' ? -amt : amt;
  });
  taxableSubtotal = Math.max(taxableSubtotal, 0);

  const taxRate = taxPercent / 100;
  const taxAmount = taxableSubtotal * taxRate;

  let noTaxTotal = 0;
  noTaxItems.forEach(li => {
    const amt = Math.abs(Number(li.amount) || 0);
    noTaxTotal += li.type === 'deduct' ? -amt : amt;
  });

  let afterTaxTotal = 0;
  afterTaxItems.forEach(li => {
    const amt = Math.abs(Number(li.amount) || 0);
    afterTaxTotal += li.type === 'deduct' ? -amt : amt;
  });

  const total = taxableSubtotal + noTaxTotal + taxAmount + afterTaxTotal;

  const costPerUnit = Number(budgetInput.costPerUnit) || 0;
  const totalCost = costPerUnit * effectiveQty;
  const profit = total - totalCost;
  const margin = total > 0 ? (profit / total) * 100 : 0;

  return {
    qty: effectiveQty,
    unitPrice: round2(unitPrice),
    productSubtotal: round2(productSubtotal),
    freight: round2(freight),
    costPerUnit: round2(costPerUnit),
    cost: round2(totalCost),
    lineItems: lineItems.map(li => ({
      label: li.label || '',
      type: li.type || 'add',
      taxOption: li.taxOption || 'before',
      amount: round2(Math.abs(Number(li.amount) || 0))
    })),
    taxableSubtotal: round2(taxableSubtotal),
    taxRate,
    taxAmount: round2(taxAmount),
    totalWithTax: round2(total),
    total: round2(total),
    profit: round2(profit),
    margin: round2(margin),
    orderProducts: multiMode ? budgetInput.orderProducts : undefined,
    lastUpdated: new Date().toISOString()
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { calculateBudget };
