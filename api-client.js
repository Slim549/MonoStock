/**
 * api-client.js — Drop-in replacement for web-api.js / Electron preload.js.
 *
 * Exposes the same window.dashboardAPI interface that renderer.js expects,
 * but all operations go through the Express REST API instead of
 * localStorage (web-api.js) or Electron IPC (preload.js).
 *
 * If the server is unreachable, operations fail gracefully with error messages.
 */
(function () {
  'use strict';

  const API_BASE = window.__API_BASE || '';

  function _getToken() {
    return localStorage.getItem('authToken');
  }

  function _setToken(token) {
    if (token) localStorage.setItem('authToken', token);
    else localStorage.removeItem('authToken');
  }

  async function apiFetch(path, options = {}) {
    const url = API_BASE + path;
    const token = _getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { headers, ...options });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.errors?.join(', ') || `HTTP ${res.status}`);
    }
    return res;
  }

  async function apiJSON(path, options) {
    const res = await apiFetch(path, options);
    return res.json();
  }

  // ── Simple event bus (same as web-api.js — for menu bar events) ──
  const _listeners = {};
  function on(event, cb) {
    (_listeners[event] = _listeners[event] || []).push(cb);
  }
  function emit(event, ...args) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(...args); } catch (e) { console.error('[api-client] emit error:', e); }
    });
  }

  // ── Download helper ──
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ══════════════════════════════════════════════════════════════
  // dashboardAPI methods — same interface as preload.js / web-api.js
  // ══════════════════════════════════════════════════════════════

  async function load() {
    try {
      const data = await apiJSON('/api/dashboard');
      return data;
    } catch (e) {
      console.error('[api-client] load failed:', e);
      return null;
    }
  }

  async function save(data) {
    try {
      const result = await apiJSON('/api/dashboard', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return result;
    } catch (e) {
      console.error('[api-client] save failed:', e);
      return { success: false, error: e.message };
    }
  }

  // ── Invoice (server-generated PDF — pdfkit) ──
  async function generateInvoice(data) {
    try {
      const res = await apiFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const blob = await res.blob();
      const safeC = (data.customerName || 'Customer').replace(/[^a-z0-9]/gi, '_');
      const fileName = `Invoice_${data.orderNumber || 'Unknown'}_${safeC}_${data.quantity || 0}.pdf`;
      downloadBlob(blob, fileName);
      return fileName;
    } catch (e) {
      console.error('[api-client] invoice failed:', e);
      throw e;
    }
  }

  // ── Excel import (upload file to server) ──
  async function importOrdersExcel() {
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
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(API_BASE + '/api/imports/orders', {
            method: 'POST',
            body: formData
          });
          const result = await res.json();
          resolve(result);
        } catch (e) {
          console.error('[api-client] import failed:', e);
          resolve({ success: false, error: e.message });
        }
      };

      inp.click();
    });
  }

  // ── Excel exports (server-generated .xlsx) ──
  async function exportOrdersExcel(orders, query) {
    try {
      const res = await apiFetch('/api/exports/orders', {
        method: 'POST',
        body: JSON.stringify({ orders, query })
      });
      const blob = await res.blob();
      const safeQ = (query || 'all').replace(/[^\w\d]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
      const fileName = `Orders_${safeQ}.xlsx`;
      downloadBlob(blob, fileName);
      return { success: true, path: fileName };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function exportCustomersExcel(customers) {
    try {
      const res = await apiFetch('/api/exports/customers', {
        method: 'POST',
        body: JSON.stringify({ customers })
      });
      const blob = await res.blob();
      const fileName = `Customers_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadBlob(blob, fileName);
      return { success: true, path: fileName };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function exportInventoryExcel(rows) {
    try {
      const res = await apiFetch('/api/exports/inventory', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      const blob = await res.blob();
      const fileName = `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadBlob(blob, fileName);
      return { success: true, path: fileName };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ── Company logo (browser file picker → base64 data URL) ──
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
        reader.onload = e => resolve({ success: true, path: e.target.result });
        reader.onerror = () => resolve({ success: false, error: 'Failed to read image' });
        reader.readAsDataURL(file);
      };

      inp.click();
    });
  }

  // ── Open file — no-op in browser (exports are auto-downloaded) ──
  function openFile() {
    return Promise.resolve({ success: true });
  }

  // ── Backup system ──
  async function createBackup() {
    try {
      return await apiJSON('/api/backups', { method: 'POST' });
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function listBackups() {
    try {
      const result = await apiJSON('/api/backups');
      return result.backups || [];
    } catch (_) {
      return [];
    }
  }

  function getDataPath() {
    return Promise.resolve('Server-managed (REST API)');
  }

  // ── Restore backup dialog ──
  async function _showRestoreDialog() {
    let backups = [];
    try { backups = await listBackups(); } catch (_) {}

    const modal = document.createElement('div');
    modal.className = 'modal';

    const localListHTML = backups.length
      ? backups.map((b, i) => `
          <div class="restore-option" data-name="${b.name}" style="
            padding:10px 14px; border:1px solid var(--border-color); border-radius:8px;
            cursor:pointer; margin-bottom:8px; transition:background 0.15s, color 0.15s;
          ">
            <strong style="font-size:0.9em;">${b.name}</strong>
            <div style="font-size:0.78em; opacity:0.55; margin-top:2px;">${b.date || ''}</div>
          </div>`).join('')
      : '<p style="opacity:0.55; font-size:0.88em; margin:0 0 12px 0;">No server backups found.</p>';

    modal.innerHTML = `
      <div class="modal-box" style="max-width:500px;">
        <h3 style="margin-top:0; margin-bottom:20px;">Restore from Backup</h3>
        <div style="margin-bottom:20px;">
          <h4 style="margin:0 0 10px; font-size:0.95em; opacity:0.75;">Server Backups</h4>
          <div id="restore-list" style="max-height:200px; overflow-y:auto; padding-right:4px;">${localListHTML}</div>
        </div>
        <div style="padding:10px 14px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; margin-bottom:20px; font-size:0.85em; opacity:0.85;">
          &#9888; Restoring will replace all current data. A backup will be created first.
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="restore-cancel-btn" style="background:var(--border-color); color:var(--text-color);">Cancel</button>
          <button id="restore-confirm-btn" style="background:var(--danger-color);" disabled>Restore Selected</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedName = null;
    const confirmBtn = modal.querySelector('#restore-confirm-btn');

    modal.querySelectorAll('.restore-option').forEach(el => {
      el.addEventListener('click', () => {
        modal.querySelectorAll('.restore-option').forEach(x => {
          x.style.background = '';
          x.style.color = '';
        });
        el.style.background = 'var(--accent-color)';
        el.style.color = 'white';
        selectedName = el.dataset.name;
        confirmBtn.disabled = !selectedName;
      });
    });

    modal.querySelector('#restore-cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    confirmBtn.addEventListener('click', async () => {
      if (!selectedName) return;

      const ok = confirm(
        'This will replace ALL current data with the selected backup.\nA backup of your current data will be created first.\n\nContinue?'
      );
      if (!ok) return;

      try {
        const result = await apiJSON('/api/backups/restore', {
          method: 'POST',
          body: JSON.stringify({ name: selectedName })
        });
        if (result.success) {
          modal.remove();
          emit('backup-restored');
          location.reload();
        } else {
          alert('Restore failed: ' + (result.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Restore failed: ' + e.message);
      }
    });
  }

  // ── Auth API ──

  async function authRegister(name, email, password) {
    const res = await apiJSON('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (res.token) _setToken(res.token);
    return res;
  }

  async function authLogin(email, password) {
    const res = await apiJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) _setToken(res.token);
    return res;
  }

  async function authMe() {
    return apiJSON('/api/auth/me');
  }

  async function authUpdateProfile(updates) {
    const res = await apiJSON('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    if (res.token) _setToken(res.token);
    return res;
  }

  async function authChangePassword(currentPassword, newPassword) {
    return apiJSON('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  function authLogout() {
    _setToken(null);
  }

  async function authStatus() {
    return apiJSON('/api/auth/status');
  }

  async function authForgotPassword(email) {
    return apiJSON('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async function authResetPassword(token, newPassword) {
    return apiJSON('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  }

  // ── Verification API ──

  async function sendVerificationEmail() {
    return apiJSON('/api/verification/send-email', { method: 'POST' });
  }

  async function getVerificationStatus() {
    try { return await apiJSON('/api/verification/status'); }
    catch (e) { return { success: false }; }
  }

  async function startDomainVerification(domain) {
    return apiJSON('/api/verification/start-domain', {
      method: 'POST',
      body: JSON.stringify({ domain })
    });
  }

  async function verifyDomain() {
    return apiJSON('/api/verification/verify-domain', { method: 'POST' });
  }

  // ── Trust Score API ──

  async function getTrustScore(userId) {
    try { return await apiJSON(`/api/trust-score/${userId}`); }
    catch (e) { return { success: false }; }
  }

  async function recalculateTrustScore(userId) {
    return apiJSON(`/api/trust-score/${userId}/recalculate`, { method: 'POST' });
  }

  async function flagUser(userId, reason, severity, type) {
    return apiJSON(`/api/trust-score/${userId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason, severity: severity || 'low', type: type || 'flag' })
    });
  }

  // ── Additional API methods for server-validated operations ──

  async function createOrder(orderData) {
    return apiJSON('/api/orders', { method: 'POST', body: JSON.stringify(orderData) });
  }

  async function updateOrder(id, orderData) {
    return apiJSON(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify(orderData) });
  }

  async function deleteOrder(id) {
    return apiJSON(`/api/orders/${id}`, { method: 'DELETE' });
  }

  async function duplicateOrder(id) {
    return apiJSON(`/api/orders/${id}/duplicate`, { method: 'POST' });
  }

  async function saveBudget(orderId, budgetData) {
    return apiJSON(`/api/orders/${orderId}/budget`, { method: 'POST', body: JSON.stringify(budgetData) });
  }

  async function checkInventory(materials) {
    return apiJSON('/api/inventory/check-availability', {
      method: 'POST',
      body: JSON.stringify({ materials })
    });
  }

  // ── Settings sync ──

  async function loadSettings() {
    try {
      return await apiJSON('/api/settings');
    } catch (e) {
      console.warn('[api-client] loadSettings failed:', e.message);
      return { success: false, preferences: {} };
    }
  }

  async function saveSettingsToServer(preferences) {
    try {
      return await apiJSON('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ preferences })
      });
    } catch (e) {
      console.warn('[api-client] saveSettings failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ── Collaboration API ──

  async function getFolderCollaborators(folderId) {
    return apiJSON(`/api/folders/${folderId}/collaborators`);
  }

  async function addCollaborator(folderId, email, role) {
    return apiJSON(`/api/folders/${folderId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
  }

  async function updateCollaboratorRole(folderId, userId, role) {
    return apiJSON(`/api/folders/${folderId}/collaborators/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  async function removeCollaborator(folderId, userId) {
    return apiJSON(`/api/folders/${folderId}/collaborators/${userId}`, {
      method: 'DELETE'
    });
  }

  async function getSharedFolders() {
    return apiJSON('/api/folders/shared');
  }

  async function searchUsers(query) {
    return apiJSON(`/api/folders/users/search?q=${encodeURIComponent(query)}`);
  }

  // ── Network API ──

  async function getMyBusinessProfile() {
    try { return await apiJSON('/api/network/profile'); }
    catch (e) { return { success: false, error: e.message }; }
  }

  async function getBusinessProfile(userId) {
    try { return await apiJSON(`/api/network/profile/${userId}`); }
    catch (e) { return { success: false, error: e.message }; }
  }

  async function saveBusinessProfile(profile) {
    try {
      return await apiJSON('/api/network/profile', {
        method: 'POST', body: JSON.stringify(profile)
      });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function searchDirectory(params) {
    try {
      const qs = new URLSearchParams();
      if (params.keyword) qs.set('keyword', params.keyword);
      if (params.industry) qs.set('industry', params.industry);
      if (params.industry_custom) qs.set('industry_custom', params.industry_custom);
      if (params.business_type) qs.set('business_type', params.business_type);
      if (params.location) qs.set('location', params.location);
      return await apiJSON(`/api/network/directory?${qs.toString()}`);
    } catch (e) { return { success: false, profiles: [] }; }
  }

  async function sendConnectionRequest(userId) {
    try {
      return await apiJSON(`/api/network/connect/${userId}`, { method: 'POST' });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function respondToConnection(connectionId, action) {
    try {
      return await apiJSON(`/api/network/connections/${connectionId}/respond`, {
        method: 'POST', body: JSON.stringify({ action })
      });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function removeConnection(connectionId) {
    try {
      return await apiJSON(`/api/network/connections/${connectionId}`, { method: 'DELETE' });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function blockUser(userId) {
    try {
      return await apiJSON(`/api/network/block/${userId}`, { method: 'POST' });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function getConnections() {
    try { return await apiJSON('/api/network/connections'); }
    catch (e) { return { success: false, connections: [] }; }
  }

  async function getPendingRequests() {
    try { return await apiJSON('/api/network/requests'); }
    catch (e) { return { success: false, requests: [] }; }
  }

  async function sendNetworkMessage(userId, body, opts = {}) {
    try {
      const payload = { body };
      if (opts.attachments) payload.attachments = opts.attachments;
      if (opts.msg_type) payload.msg_type = opts.msg_type;
      if (opts.metadata) payload.metadata = opts.metadata;
      return await apiJSON(`/api/network/messages/${userId}`, {
        method: 'POST', body: JSON.stringify(payload)
      });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function acceptFolderInvite(messageId) {
    try {
      return await apiJSON(`/api/network/messages/${messageId}/accept-invite`, { method: 'POST' });
    } catch (e) { return { success: false, error: e.message }; }
  }

  async function getMyFolders() {
    try { return await apiJSON('/api/network/my-folders'); }
    catch (e) { return { success: true, folders: [] }; }
  }

  async function getConversation(userId) {
    try { return await apiJSON(`/api/network/messages/${userId}`); }
    catch (e) { return { success: false, messages: [] }; }
  }

  async function getUnreadCount() {
    try { return await apiJSON('/api/network/unread'); }
    catch (e) { return { success: true, count: 0 }; }
  }

  // ══════════════════════════════════════════════════════════════
  // Expose window.dashboardAPI
  // ══════════════════════════════════════════════════════════════

  window.dashboardAPI = {
    // Core data (same interface as preload.js)
    load,
    save,

    // Invoice
    generateInvoice,

    // Excel import
    importOrdersExcel,

    // Company logo
    pickCompanyLogo,

    // Excel exports
    exportOrdersExcel,
    exportCustomersExcel,
    exportInventoryExcel,

    // Open file (no-op in browser)
    openFile,

    // Backup system
    createBackup,
    listBackups,
    getDataPath,

    // Menu event subscriptions
    onOpenSettings:           cb => on('open-settings', cb),
    onExportOrders:           cb => on('export-orders', cb),
    onExportCurrentOrders:    cb => on('export-current-orders', cb),
    onExportCustomers:        cb => on('export-customers', cb),
    onExportCurrentCustomers: cb => on('export-current-customers', cb),
    onExportInventory:        cb => on('export-inventory', cb),
    onBackupCreated:          cb => on('backup-created', cb),
    onBackupRestored:         cb => on('backup-restored', cb),
    onShowShortcuts:          cb => on('show-shortcuts', cb),

    // Internal helpers (used by menu bar in index.html)
    _emit: emit,
    _showRestoreDialog,

    // ── Server-validated operations ──
    createOrder,
    updateOrder,
    deleteOrder,
    duplicateOrder,
    saveBudget,
    checkInventory,

    // ── Collaboration ──
    getFolderCollaborators,
    addCollaborator,
    updateCollaboratorRole,
    removeCollaborator,
    getSharedFolders,
    searchUsers,

    // ── Settings sync ──
    loadSettings,
    saveSettings: saveSettingsToServer,

    // ── Auth ──
    authRegister,
    authLogin,
    authMe,
    authUpdateProfile,
    authChangePassword,
    authLogout,
    authStatus,
    authForgotPassword,
    authResetPassword,
    isLoggedIn: () => !!_getToken(),

    // ── Verification ──
    sendVerificationEmail,
    getVerificationStatus,
    startDomainVerification,
    verifyDomain,

    // ── Trust Score ──
    getTrustScore,
    recalculateTrustScore,
    flagUser,

    // ── Network ──
    getMyBusinessProfile,
    getBusinessProfile,
    saveBusinessProfile,
    searchDirectory,
    sendConnectionRequest,
    respondToConnection,
    removeConnection,
    blockUser,
    getConnections,
    getPendingRequests,
    sendNetworkMessage,
    acceptFolderInvite,
    getMyFolders,
    getConversation,
    getUnreadCount
  };

  console.log('[api-client] window.dashboardAPI ready (server-backed)');
})();
