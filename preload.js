// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Local event bus so web-menu _emit() calls work in Electron
// (mirrors the event bus in web-api.js)
const _bus = {};
const _busOn   = (event, cb) => { (_bus[event] = _bus[event] || []).push(cb); };
const _busEmit = (event, ...args) => {
  (_bus[event] || []).forEach(cb => { try { cb({}, ...args); } catch (_) {} });
};

contextBridge.exposeInMainWorld('dashboardAPI', {
  // ── Core data ──
  load:                () => ipcRenderer.invoke('load-dashboard'),
  save:                (data) => ipcRenderer.invoke('save-dashboard', data),

  // ── Invoice ──
  generateInvoice:     (data) => ipcRenderer.invoke('generate-invoice', data),

  // ── Excel import ──
  importOrdersExcel:   () => ipcRenderer.invoke('import-orders-excel'),

  // ── Company logo ──
  pickCompanyLogo:     () => ipcRenderer.invoke('pick-company-logo'),

  // ── Excel exports ──
  exportOrdersExcel:   (orders, query) => ipcRenderer.invoke('export-orders-excel', orders, query),
  exportInventoryExcel:(rows)           => ipcRenderer.invoke('export-inventory-excel', rows),
  exportCustomersExcel:(customers)      => ipcRenderer.invoke('export-customers-excel', customers),

  // ── Open file in OS ──
  openFile:            (filePath) => ipcRenderer.invoke('open-file', filePath),

  // ── Backup system ──
  createBackup:        () => ipcRenderer.invoke('create-backup'),
  listBackups:         () => ipcRenderer.invoke('list-backups'),
  getDataPath:         () => ipcRenderer.invoke('get-data-path'),

  // ── Menu event subscriptions (called by renderer.js at startup) ──
  // Each registers in both IPC (for native menu) and local bus (for web menu bar)
  onOpenSettings:           (cb) => { ipcRenderer.on('open-settings',           cb); _busOn('open-settings',           cb); },
  onExportOrders:           (cb) => { ipcRenderer.on('export-orders',           cb); _busOn('export-orders',           cb); },
  onExportCurrentOrders:    (cb) => { ipcRenderer.on('export-current-orders',   cb); _busOn('export-current-orders',   cb); },
  onExportCustomers:        (cb) => { ipcRenderer.on('export-customers',        cb); _busOn('export-customers',        cb); },
  onExportCurrentCustomers: (cb) => { ipcRenderer.on('export-current-customers',cb); _busOn('export-current-customers',cb); },
  onExportInventory:        (cb) => { ipcRenderer.on('export-inventory',        cb); _busOn('export-inventory',        cb); },
  onBackupCreated:          (cb) => { ipcRenderer.on('backup-created', (_, path) => cb(path)); _busOn('backup-created', cb); },
  onBackupRestored:         (cb) => { ipcRenderer.on('backup-restored',         cb); _busOn('backup-restored',         cb); },
  onShowShortcuts:          (cb) => { ipcRenderer.on('show-shortcuts',          cb); _busOn('show-shortcuts',          cb); },

  // ── Web menu bar helpers ──
  // _emit triggers local bus callbacks (same events renderer.js subscribes to above)
  _emit:              _busEmit,
  // _showRestoreDialog sends to main process to open the native restore dialog
  _showRestoreDialog: () => ipcRenderer.send('show-restore-dialog'),
});
