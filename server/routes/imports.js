/**
 * Excel import route — moved from main.js ipcMain.handle('import-orders-excel').
 * Accepts file upload, parses with exceljs, returns structured order data.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/orders', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, error: 'No worksheet found in file' });
    }

    const headers = [];
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      headers[colNumber] = (cell.value || '').toString().trim().toLowerCase();
    });

    const headerMap = {};
    headers.forEach((h, i) => {
      if (!h) return;
      if ((h.includes('order') && h.includes('#')) || h === 'order #' || h === 'order number') headerMap.orderNumber = i;
      else if (h === 'date' || h === 'datetime' || h === 'date/time') headerMap.dateTime = i;
      else if (h === 'status') headerMap.status = i;
      else if (h === 'accounting' || h.includes('accounting')) headerMap.AccountingNameAccountingNum = i;
      else if (h === 'customer' || h === 'customer name') headerMap.customerName = i;
      else if (h === 'company' || h === 'customer company') headerMap.customerCompany = i;
      else if (h === 'phone' || h === 'customer phone') headerMap.customerPhone = i;
      else if (h === 'email' || h === 'customer email') headerMap.customerEmail = i;
      else if (h === 'location') headerMap.location = i;
      else if (h === 'unit type' || h === 'unittype') headerMap.unitType = i;
      else if (h === 'quantity' || h === 'qty') headerMap.quantity = i;
      else if (h === 'billing address') headerMap.billingAddress = i;
      else if (h === 'ship to' || h === 'shipto' || h === 'ship-to') headerMap.shipTo = i;
      else if (h === 'notes') headerMap.notes = i;
      else if (h === 'budget total' || h === 'budget') headerMap.budgetTotal = i;
    });

    const orders = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const getVal = (field) => {
        const colIdx = headerMap[field];
        if (!colIdx) return '';
        const val = row.getCell(colIdx).value;
        if (val === null || val === undefined) return '';
        if (typeof val === 'object' && val.text) return val.text;
        if (typeof val === 'object' && val.result !== undefined) return String(val.result);
        return String(val).trim();
      };

      const customerName = getVal('customerName');
      const quantity = getVal('quantity');
      if (!customerName && !quantity) return;

      const orderObj = {
        orderNumber: getVal('orderNumber') || ('ORD-' + Math.floor(1000 + Math.random() * 9000)),
        dateTime: getVal('dateTime') || new Date().toLocaleDateString(),
        status: getVal('status') || 'Pending',
        AccountingNameAccountingNum: getVal('AccountingNameAccountingNum'),
        customerName,
        customerCompany: getVal('customerCompany'),
        customerPhone: getVal('customerPhone'),
        customerEmail: getVal('customerEmail'),
        location: getVal('location'),
        unitType: getVal('unitType'),
        quantity: Number(quantity) || 1,
        billingAddress: getVal('billingAddress'),
        shipTo: getVal('shipTo'),
        notes: getVal('notes'),
        createdAt: Date.now(),
        id: uuidv4()
      };

      const budgetTotalRaw = getVal('budgetTotal');
      const budgetTotal = parseFloat(String(budgetTotalRaw).replace(/[^0-9.\-]/g, ''));
      if (budgetTotal && !isNaN(budgetTotal) && budgetTotal > 0) {
        const qty = orderObj.quantity || 1;
        orderObj.budget = {
          qty, unitPrice: budgetTotal / qty, productSubtotal: budgetTotal,
          freight: 0, costPerUnit: 0, cost: 0, lineItems: [],
          taxableSubtotal: budgetTotal, taxRate: 0, taxAmount: 0,
          totalWithTax: budgetTotal, total: budgetTotal,
          lastUpdated: new Date().toISOString()
        };
      }

      orders.push(orderObj);
    });

    if (!orders.length) {
      return res.status(400).json({ success: false, error: 'No valid orders found in file' });
    }

    res.json({ success: true, orders, fileName: req.file.originalname });
  } catch (err) {
    console.error('Import failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Inventory Excel import (flexible header matching) ──

router.post('/inventory', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, error: 'No worksheet found in file' });
    }

    const headers = [];
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      headers[colNumber] = (cell.value || '').toString().trim().toLowerCase();
    });

    const headerMap = {};
    let hasRecognizedHeaders = false;

    headers.forEach((h, i) => {
      if (!h) return;
      if (/^(material|name|item|product|description|part)s?$/.test(h)
          || h === 'material name' || h === 'product name' || h === 'item name' || h === 'part name') {
        headerMap.material = i;
        hasRecognizedHeaders = true;
      } else if (/^(in\s*stock|stock|on\s*hand|qty|quantity|count|available)$/.test(h)) {
        headerMap.inStock = i;
        hasRecognizedHeaders = true;
      } else if (/^(required|needed|demand|order\s*qty|target)$/.test(h)) {
        headerMap.required = i;
        hasRecognizedHeaders = true;
      } else if (/^(delta|diff|difference|shortage|variance)$/.test(h)) {
        headerMap.delta = i;
        hasRecognizedHeaders = true;
      }
    });

    const items = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 && hasRecognizedHeaders) return;

      const getVal = (field) => {
        const colIdx = headerMap[field];
        if (!colIdx) return '';
        const val = row.getCell(colIdx).value;
        if (val === null || val === undefined) return '';
        if (typeof val === 'object' && val.text) return val.text;
        if (typeof val === 'object' && val.result !== undefined) return String(val.result);
        return String(val).trim();
      };

      let material;
      if (headerMap.material) {
        material = getVal('material');
      } else {
        const firstCell = row.getCell(1).value;
        material = firstCell != null ? String(firstCell).trim() : '';
      }

      if (!material) return;

      const parseNum = (raw) => {
        if (raw === '' || raw === null || raw === undefined) return 0;
        const cleaned = String(raw).replace(/[(),$]/g, '').trim();
        return parseInt(cleaned, 10) || 0;
      };

      items.push({
        id: uuidv4(),
        material,
        inStock: parseNum(getVal('inStock')),
        required: parseNum(getVal('required'))
      });
    });

    if (!items.length) {
      return res.status(400).json({ success: false, error: 'No materials found in file. Place material names in the first column, or use a header row (Material, In Stock, Required).' });
    }

    res.json({ success: true, items, fileName: req.file.originalname });
  } catch (err) {
    console.error('Import inventory failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
