const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const store = require('../data/store');

router.post('/:orderId', async (req, res) => {
  try {
    const order = await store.getById('orders', req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (!order.budget) {
      return res.status(400).json({ success: false, error: 'Order has no budget — create a budget first' });
    }

    const invoiceData = { ...order, ...req.body };
    generatePDF(invoiceData, res);
  } catch (err) {
    console.error('[invoices] generate error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate invoice' });
  }
});

router.post('/', (req, res) => {
  generatePDF(req.body, res);
});

function generatePDF(data, res) {
  const fmt = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const doc = new PDFDocument({ margin: 50 });

  const safeCustomer = (data.customerName || 'Customer').replace(/[^a-z0-9]/gi, '_');
  const fileName = `Invoice_${data.orderNumber || 'Unknown'}_${safeCustomer}_${data.quantity || 0}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  const logoPath = path.join(__dirname, '..', '..', 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, (doc.page.width - 225) / 2, 20, {
        fit: [225, 80], align: 'center', valign: 'center'
      });
    } catch (_) {}
  }
  doc.moveDown(4);

  doc.fontSize(10)
    .text('17603 Howling Wolf Run', { align: 'center' })
    .text('Parrish, Florida 34219', { align: 'center' })
    .text('(941) 799-1019', { align: 'center' });
  doc.moveDown(2);

  doc.font('Helvetica-Bold').fontSize(10).text('INVOICE', { align: 'left' }).moveDown(1);

  const formattedDate = data.dateTime || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const accountingInfo = data.AccountingNameAccountingNum || '';

  doc.font('Helvetica')
    .text(`Invoice #: ${data.orderNumber || 'N/A'}: ${accountingInfo}`, { align: 'left' })
    .text(`Date: ${formattedDate}`, { align: 'right' })
    .moveDown(1);

  doc.font('Helvetica-Bold').text('Order Information', { underline: true }).moveDown(0.5);
  doc.font('Helvetica')
    .text(`Location: ${data.location || ''}`)
    .text(`Unit: ${data.unitType || ''}`)
    .text(`Qty: ${data.quantity || ''}`)
    .text(`Status: ${data.status || ''}`)
    .moveDown(0.5);

  doc.font('Helvetica-Bold').text('Customer Information', { underline: true }).moveDown(0.5);
  doc.font('Helvetica')
    .text(`Customer: ${data.customerName || ''}`)
    .text(`Company: ${data.customerCompany || ''}`)
    .text(`Phone: ${data.customerPhone || ''}`)
    .text(`Email: ${data.customerEmail || ''}`)
    .moveDown(0.5);

  doc.font('Helvetica-Bold').text('Billing & Shipping', { underline: true }).moveDown(0.5);
  doc.font('Helvetica')
    .text(`Billing Address: ${data.billingAddress || ''}`)
    .text(`Shipping Address: ${data.shipTo || ''}`)
    .moveDown(0.5);

  if (data.notes) {
    doc.font('Helvetica-Bold').text('Notes:', { underline: true }).moveDown(0.2);
    doc.font('Helvetica').text(data.notes);
    doc.moveDown(1);
  }

  doc.font('Helvetica-Bold').text('Description:', { underline: true }).moveDown(0.2);
  doc.font('Helvetica').text(
    data.description ||
    'Provide temporary tankless gravity flushing sanitary waste assemblies. BrandSafway Part #M6474.'
  ).moveDown(1);

  doc.font('Helvetica-Bold').text('Invoice Sum:', { underline: true }).moveDown(0.2);

  const budget = data.budget || {};
  if (budget.qty && budget.productSubtotal !== undefined) {
    const items = Array.isArray(budget.lineItems) ? budget.lineItems : [];
    const beforeTaxItems = items.filter(li => (li.taxOption || 'before') === 'before');
    const noTaxItems = items.filter(li => li.taxOption === 'none');
    const afterTaxItems = items.filter(li => li.taxOption === 'after');

    function renderLineItem(li) {
      const label = li.label || 'Other';
      const amt = Math.abs(li.amount || 0);
      doc.text(li.type === 'deduct' ? `${label}: ($${fmt(amt)})` : `${label}: $${fmt(amt)}`);
    }

    doc.font('Helvetica')
      .text('Complete Temporary Toilet Assembly:')
      .text(`Quantity ${budget.qty}: $${fmt(budget.productSubtotal)}`)
      .text(`Freight: $${fmt(budget.freight)}`);

    beforeTaxItems.forEach(renderLineItem);
    noTaxItems.forEach(renderLineItem);
    doc.text(`Sales Tax: $${fmt(budget.taxAmount)}`);
    afterTaxItems.forEach(renderLineItem);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text(`Total Amount: $${fmt(budget.total || budget.totalWithTax)}`);
    doc.font('Helvetica');
  } else {
    doc.font('Helvetica').text('No budget information available.');
  }

  doc.moveDown(1);
  doc.font('Helvetica-Bold').text('Terms & Conditions:', { underline: true }).moveDown(0.2);
  doc.font('Helvetica').text(data.terms || 'No terms specified.');
  doc.moveDown(2);

  doc.text('Thank you for your business.', { align: 'left' });
  doc.text(data.companyName || 'MonoStock', { align: 'left' });

  doc.end();
}

module.exports = router;
