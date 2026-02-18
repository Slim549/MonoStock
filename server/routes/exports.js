/**
 * Excel export routes — moved from main.js ipcMain.handle('export-*-excel').
 * Server generates .xlsx using exceljs and streams it as a download.
 */
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');

router.post('/orders', async (req, res) => {
  try {
    const { orders, query } = req.body;
    const rows = (orders || []).map(o => ({
      'Order #': o.orderNumber || '',
      'Date': o.dateTime || '',
      'Status': o.status || '',
      'Accounting': o.AccountingNameAccountingNum || '',
      'Customer': o.customerName || '',
      'Company': o.customerCompany || '',
      'Phone': o.customerPhone || '',
      'Email': o.customerEmail || '',
      'Billing Address': o.billingAddress || '',
      'Ship To': o.shipTo || '',
      'Location': o.location || '',
      'Unit Type': o.unitType || '',
      'Quantity': o.quantity || '',
      'Budget Total': o.budget?.totalWithTax || '',
      'Notes': o.notes || ''
    }));

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Orders');
    const headers = Object.keys(rows[0] || {});

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };

    rows.forEach(row => ws.addRow(headers.map(h => row[h])));

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    autoFitColumns(ws, headers);

    const safeQ = (query || 'all').replace(/[^\w\d]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
    const fileName = `Orders_${safeQ}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export orders failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/customers', async (req, res) => {
  try {
    const { customers } = req.body;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Customers');
    const headers = ['ID', 'Name', 'Company', 'Phone', 'Email', 'Billing Address', 'Ship-To Address'];

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };

    (customers || []).forEach(c => {
      ws.addRow([c.id || '', c.name || '', c.company || '', c.phone || '', c.email || '', c.billingAddress || '', c.shipTo || '']);
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    autoFitColumns(ws, headers);

    const fileName = `Customers_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export customers failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/inventory', async (req, res) => {
  try {
    const { rows } = req.body;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Inventory');
    const headers = ['Material', 'In Stock', 'Required', 'Delta'];

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };

    (rows || []).forEach(r => {
      ws.addRow([r.material, r.inStock, r.required, r.deltaDisplay]);
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    autoFitColumns(ws, headers);

    const fileName = `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export inventory failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function autoFitColumns(ws, headers) {
  ws.columns.forEach((col, i) => {
    let maxLen = (headers[i] || '').toString().length;
    ws.eachRow((row, rn) => {
      if (rn > 1) {
        const cell = row.getCell(i + 1);
        const len = cell.value ? cell.value.toString().length : 0;
        maxLen = Math.max(maxLen, len);
      }
    });
    col.width = Math.min(Math.max(maxLen + 2, 10), 50);
  });
}

module.exports = router;
