// web-api.js – Browser-compatible replacement for Electron preload.js
// Exposes window.dashboardAPI with the same interface expected by renderer.js

(function () {
  'use strict';

  const DATA_KEY = 'si_dashboard';
  const BACKUPS_KEY = 'si_backups';
  const MAX_BACKUPS = 20;

  // ── Simple event bus for menu-bar → renderer communication ──
  const _listeners = {};
  function on(event, cb) {
    (_listeners[event] = _listeners[event] || []).push(cb);
  }
  function emit(event, ...args) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(...args); } catch (e) { console.error('[web-api] emit error:', e); }
    });
  }

  // ── Data persistence via localStorage ──
  function normalize(d) {
    return {
      title: d.title || 'MonoStock',
      orders: Array.isArray(d.orders) ? d.orders : [],
      customers: Array.isArray(d.customers) ? d.customers : [],
      inventory: Array.isArray(d.inventory) ? d.inventory : [],
      orderFolders: Array.isArray(d.orderFolders) ? d.orderFolders : [],
      trash: Array.isArray(d.trash) ? d.trash : [],
      products: Array.isArray(d.products) ? d.products : []
    };
  }

  function load() {
    return Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(DATA_KEY);
        if (!raw) return null;
        return normalize(JSON.parse(raw));
      } catch (e) {
        console.error('[web-api] load failed:', e);
        return null;
      }
    });
  }

  function save(data) {
    return Promise.resolve().then(() => {
      try {
        if (!data || typeof data !== 'object') return { success: false, error: 'Invalid data' };
        localStorage.setItem(DATA_KEY, JSON.stringify(normalize(data)));
        return { success: true };
      } catch (e) {
        console.error('[web-api] save failed:', e);
        return { success: false, error: e.message };
      }
    });
  }

  // ── Backup system ──
  function createBackup() {
    return Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(DATA_KEY);
        if (!raw) return { success: false, error: 'No data to backup' };

        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const name = `dashboard_${ts}.json`;

        let bkList = [];
        try { bkList = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]'); } catch (_) {}
        bkList.unshift({ name, date: new Date().toISOString(), data: raw });
        if (bkList.length > MAX_BACKUPS) bkList = bkList.slice(0, MAX_BACKUPS);
        localStorage.setItem(BACKUPS_KEY, JSON.stringify(bkList));

        // Trigger browser download of the backup file
        _downloadBlob(new Blob([raw], { type: 'application/json' }), name);

        return { success: true, path: name };
      } catch (e) {
        console.error('[web-api] backup failed:', e);
        return { success: false, error: e.message };
      }
    });
  }

  function listBackups() {
    return Promise.resolve().then(() => {
      try {
        return (JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]'))
          .map(b => ({ name: b.name, date: b.date, path: b.name }));
      } catch (_) { return []; }
    });
  }

  function getDataPath() {
    return Promise.resolve('Browser localStorage (key: si_dashboard)');
  }

  // openFile is a no-op in the browser (exports are auto-downloaded)
  function openFile() {
    return Promise.resolve({ success: true });
  }

  // ── Download helpers ──
  function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ── Company logo picker ──
  function pickCompanyLogo() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.style.display = 'none';
      document.body.appendChild(inp);

      const cancel = setTimeout(() => { inp.remove(); resolve({ success: false, canceled: true }); }, 5 * 60 * 1000);

      inp.onchange = () => {
        clearTimeout(cancel);
        const file = inp.files[0];
        inp.remove();
        if (!file) { resolve({ success: false, canceled: true }); return; }
        const reader = new FileReader();
        reader.onload = e => resolve({ success: true, path: e.target.result }); // base64 data URL
        reader.onerror = () => resolve({ success: false, error: 'Failed to read image' });
        reader.readAsDataURL(file);
      };

      inp.click();
    });
  }

  // ── Wait for a CDN library to become available ──
  function _waitFor(getter, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const v = getter();
      if (v) { resolve(v); return; }
      const start = Date.now();
      const id = setInterval(() => {
        const val = getter();
        if (val) { clearInterval(id); resolve(val); }
        else if (Date.now() - start > timeoutMs) {
          clearInterval(id);
          reject(new Error('Required library not loaded. Check CDN scripts in index.html.'));
        }
      }, 100);
    });
  }

  // ── Excel exports (SheetJS) ──
  function exportOrdersExcel(orders, query) {
    return _waitFor(() => window.XLSX).then(XLSX => {
      const data = orders.map(o => ({
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

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');

      const safeQ = (query || 'all').replace(/[^\w\d]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
      const fileName = `Orders_${safeQ}.xlsx`;
      XLSX.writeFile(wb, fileName);
      return { success: true, path: fileName };
    }).catch(e => ({ success: false, error: e.message }));
  }

  function exportCustomersExcel(customers) {
    return _waitFor(() => window.XLSX).then(XLSX => {
      const data = customers.map(c => ({
        'ID': c.id || '',
        'Name': c.name || '',
        'Company': c.company || '',
        'Phone': c.phone || '',
        'Email': c.email || '',
        'Billing Address': c.billingAddress || '',
        'Ship-To Address': c.shipTo || ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');
      const fn = `Customers_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fn);
      return { success: true, path: fn };
    }).catch(e => ({ success: false, error: e.message }));
  }

  function exportInventoryExcel(rows) {
    return _waitFor(() => window.XLSX).then(XLSX => {
      const data = rows.map(r => ({
        'Material': r.material,
        'In Stock': r.inStock,
        'Required': r.required,
        'Delta': r.deltaDisplay
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      const fn = `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fn);
      return { success: true, path: fn };
    }).catch(e => ({ success: false, error: e.message }));
  }

  // ── Excel import ──
  function importOrdersExcel() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.xlsx,.xls';
      inp.style.display = 'none';
      document.body.appendChild(inp);

      const cancelTimer = setTimeout(() => {
        inp.remove();
        resolve({ success: false, canceled: true });
      }, 5 * 60 * 1000);

      inp.onchange = async () => {
        clearTimeout(cancelTimer);
        const file = inp.files[0];
        inp.remove();
        if (!file) { resolve({ success: false, canceled: true }); return; }

        try {
          const XLSX = await _waitFor(() => window.XLSX);
          const ab = await file.arrayBuffer();
          const wb = XLSX.read(ab, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          if (!ws) { resolve({ success: false, error: 'No worksheet found in file.' }); return; }

          const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (rawRows.length < 2) { resolve({ success: false, error: 'No data rows found.' }); return; }

          const hdrs = rawRows[0].map(h => (h || '').toString().trim().toLowerCase());
          const hm = {};
          hdrs.forEach((h, i) => {
            if (!h) return;
            if ((h.includes('order') && h.includes('#')) || h === 'order #' || h === 'order number' || h === 'ordernumber') hm.orderNumber = i;
            else if (h === 'date' || h === 'datetime' || h === 'date/time') hm.dateTime = i;
            else if (h === 'status') hm.status = i;
            else if (h === 'accounting' || h.includes('accounting')) hm.AccountingNameAccountingNum = i;
            else if (h === 'customer' || h === 'customer name' || h === 'customername') hm.customerName = i;
            else if (h === 'company' || h === 'customer company' || h === 'customercompany') hm.customerCompany = i;
            else if (h === 'phone' || h === 'customer phone' || h === 'customerphone') hm.customerPhone = i;
            else if (h === 'email' || h === 'customer email' || h === 'customeremail') hm.customerEmail = i;
            else if (h === 'location') hm.location = i;
            else if (h === 'unit type' || h === 'unittype') hm.unitType = i;
            else if (h === 'quantity' || h === 'qty') hm.quantity = i;
            else if (h === 'billing address' || h === 'billingaddress') hm.billingAddress = i;
            else if (h === 'ship to' || h === 'shipto' || h === 'ship-to') hm.shipTo = i;
            else if (h === 'notes') hm.notes = i;
            else if (h === 'budget total' || h === 'budgettotal' || h === 'budget') hm.budgetTotal = i;
          });

          const gv = (row, field) => {
            const idx = hm[field];
            if (idx === undefined) return '';
            const v = row[idx];
            return (v === null || v === undefined) ? '' : String(v).trim();
          };

          const orders = [];
          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            const cName = gv(row, 'customerName');
            const qty = gv(row, 'quantity');
            if (!cName && !qty) continue;

            const o = {
              orderNumber: gv(row, 'orderNumber') || ('ORD-' + Math.floor(1000 + Math.random() * 9000)),
              dateTime: gv(row, 'dateTime') || new Date().toLocaleDateString(),
              status: gv(row, 'status') || 'Pending',
              AccountingNameAccountingNum: gv(row, 'AccountingNameAccountingNum'),
              customerName: cName,
              customerCompany: gv(row, 'customerCompany'),
              customerPhone: gv(row, 'customerPhone'),
              customerEmail: gv(row, 'customerEmail'),
              location: gv(row, 'location'),
              unitType: gv(row, 'unitType'),
              quantity: Number(qty) || 1,
              billingAddress: gv(row, 'billingAddress'),
              shipTo: gv(row, 'shipTo'),
              notes: gv(row, 'notes'),
              createdAt: Date.now(),
              id: crypto.randomUUID()
            };

            const bRaw = gv(row, 'budgetTotal');
            const bTotal = parseFloat(String(bRaw).replace(/[^0-9.\-]/g, ''));
            if (bTotal && !isNaN(bTotal) && bTotal > 0) {
              const q = o.quantity || 1;
              o.budget = {
                qty: q, unitPrice: bTotal / q, productSubtotal: bTotal,
                freight: 0, costPerUnit: 0, cost: 0, lineItems: [],
                taxableSubtotal: bTotal, taxRate: 0, taxAmount: 0,
                totalWithTax: bTotal, total: bTotal,
                lastUpdated: new Date().toISOString()
              };
            }

            orders.push(o);
          }

          if (!orders.length) { resolve({ success: false, error: 'No valid orders found in file.' }); return; }
          resolve({ success: true, orders, fileName: file.name });
        } catch (e) {
          console.error('[web-api] import failed:', e);
          resolve({ success: false, error: e.message });
        }
      };

      inp.click();
    });
  }

  // ── Invoice PDF generation (jsPDF) ──
  function generateInvoice(data) {
    return _waitFor(() => window.jspdf?.jsPDF).then(jsPDF => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const W = doc.internal.pageSize.getWidth();
      const mg = 50;
      let y = mg;
      const cw = W - mg * 2;
      const fmt = n => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // ── Logo ──
      if (data.companyLogoPath && data.companyLogoPath.startsWith('data:')) {
        try {
          doc.addImage(data.companyLogoPath, (W - 225) / 2, y, 225, 80);
          y += 110;
        } catch (e) {
          console.warn('[web-api] logo add failed:', e);
          y += 20;
        }
      } else {
        y += 20;
      }

      // ── Company address (from template) ──
      doc.setFontSize(10).setFont('helvetica', 'normal');
      const addrLines = (data.companyAddress || '').split('\n').filter(Boolean);
      addrLines.forEach(line => {
        doc.text(line.trim(), W / 2, y, { align: 'center' });
        y += 14;
      });
      if (data.companyPhone) {
        doc.text(data.companyPhone, W / 2, y, { align: 'center' });
        y += 14;
      }
      y += 16;

      // ── INVOICE title ──
      doc.setFont('helvetica', 'bold').setFontSize(11);
      doc.text('INVOICE', mg, y);
      y += 18;

      // ── Invoice # and date ──
      const fDate = data.dateTime || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const acctPart = data.AccountingNameAccountingNum ? `: ${data.AccountingNameAccountingNum}` : '';
      doc.setFont('helvetica', 'normal').setFontSize(10);
      doc.text(`Invoice #: ${data.orderNumber || 'N/A'}${acctPart}`, mg, y);
      doc.text(`Date: ${fDate}`, W - mg, y, { align: 'right' });
      y += 28;

      // ── Section renderer ──
      const section = (title, lines) => {
        doc.setFont('helvetica', 'bold');
        doc.text(title, mg, y);
        doc.setLineWidth(0.5);
        doc.line(mg, y + 2, mg + doc.getTextWidth(title), y + 2);
        y += 15;
        doc.setFont('helvetica', 'normal');
        lines.filter(Boolean).forEach(l => {
          const wrapped = doc.splitTextToSize(l, cw);
          doc.text(wrapped, mg, y);
          y += wrapped.length * 13;
        });
        y += 10;
      };

      section('Order Information', [
        `Location: ${data.location || ''}`,
        `Unit: ${data.unitType || ''}`,
        `Qty: ${data.quantity || ''}`,
        `Status: ${data.status || ''}`
      ]);

      section('Customer Information', [
        `Customer: ${data.customerName || ''}`,
        `Company: ${data.customerCompany || ''}`,
        `Phone: ${data.customerPhone || ''}`,
        `Email: ${data.customerEmail || ''}`
      ]);

      section('Billing & Shipping', [
        `Billing Address: ${data.billingAddress || ''}`,
        `Shipping Address: ${data.shipTo || ''}`
      ]);

      if (data.notes) section('Notes', [data.notes]);

      if (data.description) section('Description', [data.description]);

      // ── Pricing ──
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Sum:', mg, y);
      doc.setLineWidth(0.5);
      doc.line(mg, y + 2, mg + doc.getTextWidth('Invoice Sum:'), y + 2);
      y += 15;
      doc.setFont('helvetica', 'normal');

      const bud = data.budget || {};
      if (bud.qty && bud.productSubtotal !== undefined) {
        const items = Array.isArray(bud.lineItems) ? bud.lineItems : [];
        const liRender = item => {
          const amt = Math.abs(item.amount || 0);
          const txt = item.type === 'deduct'
            ? `${item.label || 'Other'}: ($${fmt(amt)})`
            : `${item.label || 'Other'}: $${fmt(amt)}`;
          doc.text(txt, mg, y); y += 13;
        };

        doc.text(`Quantity ${bud.qty}: $${fmt(bud.productSubtotal)}`, mg, y); y += 13;
        doc.text(`Freight: $${fmt(bud.freight)}`, mg, y); y += 13;
        items.filter(i => (i.taxOption || 'before') === 'before').forEach(liRender);
        items.filter(i => i.taxOption === 'none').forEach(liRender);
        doc.text(`Sales Tax: $${fmt(bud.taxAmount)}`, mg, y); y += 13;
        items.filter(i => i.taxOption === 'after').forEach(liRender);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Amount: $${fmt(bud.total || bud.totalWithTax)}`, mg, y);
        doc.setFont('helvetica', 'normal');
        y += 22;
      } else {
        doc.text('No budget information available.', mg, y);
        y += 22;
      }

      // ── Terms ──
      if (data.terms) {
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('Terms & Conditions:', mg, y);
        doc.setLineWidth(0.5);
        doc.line(mg, y + 2, mg + doc.getTextWidth('Terms & Conditions:'), y + 2);
        y += 15;
        doc.setFont('helvetica', 'normal');
        const termsWrapped = doc.splitTextToSize(data.terms, cw);
        doc.text(termsWrapped, mg, y);
        y += termsWrapped.length * 13 + 20;
      }

      // ── Custom Fields (Exclusions, legal text, etc.) ──
      const rawCustom = data.customFields;
      const customFields = Array.isArray(rawCustom) ? rawCustom : (rawCustom && typeof rawCustom === 'object' ? [rawCustom] : []);
      customFields.forEach((f) => {
        if (typeof f !== 'object' || !f) return;
        if (!((f.label || '').trim() || (f.value || '').trim())) return;
        y += 8;
        doc.setFont('helvetica', 'bold');
        const label = ((f.label || 'Custom').trim()) + ':';
        doc.text(label, mg, y);
        doc.setLineWidth(0.5);
        doc.line(mg, y + 2, mg + doc.getTextWidth(label), y + 2);
        y += 15;
        doc.setFont('helvetica', 'normal');
        const valWrapped = doc.splitTextToSize(String(f.value || ''), cw);
        doc.text(valWrapped, mg, y);
        y += valWrapped.length * 13 + 8;
      });

      // ── Footer ──
      if (data.thankYouText) { doc.text(data.thankYouText, mg, y); y += 13; }
      if (data.companyName) { doc.text(data.companyName, mg, y); y += 13; }
      if (data.customNote) { doc.text(data.customNote, mg, y); }

      const safeC = (data.customerName || 'Customer').replace(/[^a-z0-9]/gi, '_');
      const fileName = `Invoice_${data.orderNumber || 'Unknown'}_${safeC}_${data.quantity || 0}.pdf`;
      doc.save(fileName);
      return fileName;
    });
  }

  // ── Restore backup dialog ──
  function _showRestoreDialog() {
    let bkList = [];
    try { bkList = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]'); } catch (_) {}

    const modal = document.createElement('div');
    modal.className = 'modal';

    const localListHTML = bkList.length
      ? bkList.map((b, i) => `
          <div class="restore-option" data-idx="${i}" style="
            padding:10px 14px; border:1px solid var(--border-color); border-radius:8px;
            cursor:pointer; margin-bottom:8px; transition:background 0.15s, color 0.15s;
          ">
            <strong style="font-size:0.9em;">${b.name}</strong>
            <div style="font-size:0.78em; opacity:0.55; margin-top:2px;">${new Date(b.date).toLocaleString()}</div>
          </div>`).join('')
      : '<p style="opacity:0.55; font-size:0.88em; margin:0 0 12px 0;">No browser backups found. Try uploading a backup file.</p>';

    modal.innerHTML = `
      <div class="modal-box" style="max-width:500px;">
        <h3 style="margin-top:0; margin-bottom:20px;">Restore from Backup</h3>

        <div style="margin-bottom:20px;">
          <h4 style="margin:0 0 10px; font-size:0.95em; opacity:0.75;">Browser Backups</h4>
          <div id="restore-list" style="max-height:200px; overflow-y:auto; padding-right:4px;">${localListHTML}</div>
        </div>

        <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-bottom:20px;">
          <h4 style="margin:0 0 6px; font-size:0.95em; opacity:0.75;">Upload Backup File</h4>
          <p style="margin:0 0 10px; font-size:0.83em; opacity:0.55;">Select a .json backup file previously downloaded from this app.</p>
          <input type="file" id="restore-file-input" accept=".json" style="font-size:0.88em; color:var(--text-color);">
        </div>

        <div style="padding:10px 14px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; margin-bottom:20px; font-size:0.85em; opacity:0.85;">
          &#9888; Restoring will replace all current data. Your current data will be saved to browser backups first.
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="restore-cancel-btn" style="background:var(--border-color); color:var(--text-color);">Cancel</button>
          <button id="restore-confirm-btn" style="background:var(--danger-color);" disabled>Restore Selected</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedData = null;
    const confirmBtn = modal.querySelector('#restore-confirm-btn');

    // Select from localStorage list
    modal.querySelectorAll('.restore-option').forEach(el => {
      el.addEventListener('click', () => {
        modal.querySelectorAll('.restore-option').forEach(x => {
          x.style.background = '';
          x.style.color = '';
        });
        el.style.background = 'var(--accent-color)';
        el.style.color = 'white';
        const idx = parseInt(el.dataset.idx);
        selectedData = bkList[idx]?.data || null;
        confirmBtn.disabled = !selectedData;
        // Clear file input selection
        const fi = modal.querySelector('#restore-file-input');
        if (fi) fi.value = '';
      });
    });

    // File upload option
    modal.querySelector('#restore-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        selectedData = ev.target.result;
        confirmBtn.disabled = false;
        // Deselect list items
        modal.querySelectorAll('.restore-option').forEach(x => { x.style.background = ''; x.style.color = ''; });
      };
      reader.readAsText(file);
    });

    modal.querySelector('#restore-cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    confirmBtn.addEventListener('click', () => {
      if (!selectedData) return;

      let parsed;
      try { parsed = JSON.parse(selectedData); }
      catch (_) {
        alert('Invalid backup file — not valid JSON.');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.orders)) {
        alert('Invalid backup file — missing required data fields.');
        return;
      }

      const ok = confirm(
        'This will replace ALL current data with the selected backup.\n\n' +
        'Your current data will be saved to browser backups first.\n\nContinue?'
      );
      if (!ok) return;

      // Save current data as a pre-restore backup (no download)
      try {
        const raw = localStorage.getItem(DATA_KEY);
        if (raw) {
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          let bk2 = [];
          try { bk2 = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]'); } catch (_) {}
          bk2.unshift({ name: `dashboard_pre_restore_${ts}.json`, date: new Date().toISOString(), data: raw });
          if (bk2.length > MAX_BACKUPS) bk2 = bk2.slice(0, MAX_BACKUPS);
          localStorage.setItem(BACKUPS_KEY, JSON.stringify(bk2));
        }
      } catch (_) {}

      // Restore
      localStorage.setItem(DATA_KEY, selectedData);
      modal.remove();
      emit('backup-restored');
      location.reload();
    });
  }

  // ── Expose window.dashboardAPI ──
  window.dashboardAPI = {
    load,
    save,
    generateInvoice,
    importOrdersExcel,
    exportOrdersExcel,
    exportCustomersExcel,
    exportInventoryExcel,
    pickCompanyLogo,
    openFile,
    createBackup,
    listBackups,
    getDataPath,

    // Menu event subscriptions (called by renderer.js at startup)
    onOpenSettings:         cb => on('open-settings', cb),
    onExportOrders:         cb => on('export-orders', cb),
    onExportCurrentOrders:  cb => on('export-current-orders', cb),
    onExportCustomers:      cb => on('export-customers', cb),
    onExportCurrentCustomers: cb => on('export-current-customers', cb),
    onExportInventory:      cb => on('export-inventory', cb),
    onBackupCreated:        cb => on('backup-created', cb),
    onBackupRestored:       cb => on('backup-restored', cb),
    onShowShortcuts:        cb => on('show-shortcuts', cb),

    // Internal helpers used by menu bar buttons defined in index.html
    _emit,
    _showRestoreDialog
  };

  console.log('[web-api] window.dashboardAPI ready');
})();
