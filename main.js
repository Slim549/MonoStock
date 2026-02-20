const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const logoPath = path.join(process.resourcesPath, "assets", "logo.png");

// ── Data path (use userData – much better than __dirname for packaged apps) ──
const dataPath = path.join(app.getPath('userData'), 'dashboard.json');
const backupDir = path.join(app.getPath('userData'), 'backups');

// Set cache directory to userData to avoid permission errors
app.setPath('cache', path.join(app.getPath('userData'), 'cache'));

// Ensure directories exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Ensure data file exists on first run
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(
    dataPath,
    JSON.stringify({ title: "MonoStock", orders: [], customers: [], inventory: [], orderFolders: [], trash: [], products: [] }, null, 2)
  );
}

// ── Dashboard functions ──
function loadDashboard() {
  try {
    const data = fs.readFileSync(dataPath, 'utf8');
    const parsed = JSON.parse(data);
    return {
      title: parsed.title || "MonoStock",
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      orderFolders: Array.isArray(parsed.orderFolders) ? parsed.orderFolders : [],
      trash: Array.isArray(parsed.trash) ? parsed.trash : [],
      products: Array.isArray(parsed.products) ? parsed.products : []
    };
  } catch (err) {
    console.error('Load failed:', err);
    return { title: "MonoStock", orders: [], customers: [], inventory: [], orderFolders: [], trash: [], products: [] };
  }
}

function saveDashboard(data) {
  try {
    // Validate data structure before saving
    if (!data || typeof data !== 'object') {
      console.error('Invalid data structure - refusing to save');
      return;
    }
    const safeData = {
      title: data.title || "MonoStock",
      orders: Array.isArray(data.orders) ? data.orders : [],
      customers: Array.isArray(data.customers) ? data.customers : [],
      inventory: Array.isArray(data.inventory) ? data.inventory : [],
      orderFolders: Array.isArray(data.orderFolders) ? data.orderFolders : [],
      trash: Array.isArray(data.trash) ? data.trash : [],
      products: Array.isArray(data.products) ? data.products : []
    };
    fs.writeFileSync(dataPath, JSON.stringify(safeData, null, 2), 'utf8');
  } catch (err) {
    console.error('Save failed:', err);
  }
}

// ── Auto-Backup System ──
function createBackup() {
  try {
    if (!fs.existsSync(dataPath)) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(backupDir, `dashboard_${timestamp}.json`);
    fs.copyFileSync(dataPath, backupPath);

    // Keep only last 20 backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('dashboard_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backups.length > 20) {
      backups.slice(20).forEach(old => {
        try { fs.unlinkSync(path.join(backupDir, old)); } catch (_) {}
      });
    }

    console.log('Backup created:', backupPath);
    return backupPath;
  } catch (err) {
    console.error('Backup failed:', err);
    return null;
  }
}

function listBackups() {
  try {
    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('dashboard_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        date: f.replace('dashboard_', '').replace('.json', '').replace(/-/g, (m, o) => o < 13 ? '-' : ':')
      }));
  } catch (err) {
    return [];
  }
}

function restoreBackup(backupPath) {
  try {
    if (!fs.existsSync(backupPath)) return { success: false, error: "Backup file not found" };
    
    // Create a backup of current data before restoring
    createBackup();
    
    fs.copyFileSync(backupPath, dataPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Auto-backup every 30 minutes
let backupInterval = null;

// ── Open Invoices Folder ──
let lastInvoicePath = null;

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Invoices Folder",
          click: async () => {
            const invoicesPath = path.join(app.getPath("userData"), "invoices");
            shell.openPath(invoicesPath);
          }
        },
        {
          label: "Open Last Invoice",
          enabled: lastInvoicePath !== null && fs.existsSync(lastInvoicePath),
          click: async () => {
            if (lastInvoicePath && fs.existsSync(lastInvoicePath)) {
              shell.openPath(lastInvoicePath);
            }
          }
        },
        {
          label: "Open Exports Folder",
          click: async () => {
            const exportsPath = path.join(app.getPath("documents"), "SanitaryInnovations", "Exports");
            fs.mkdirSync(exportsPath, { recursive: true });
            shell.openPath(exportsPath);
          }
        },
        {
          label: "Open Last Export",
          enabled: lastExportPath !== null && fs.existsSync(lastExportPath),
          click: async () => {
            if (lastExportPath && fs.existsSync(lastExportPath)) {
              shell.openPath(lastExportPath);
            }
          }
        },
        { type: "separator" },
        {
          role: "quit"
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Export Data",
      submenu: [
        {
          label: "Export All Orders",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("export-orders");
          }
        },
        {
          label: "Export Current Orders (Filtered)",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("export-current-orders");
          }
        },
        { type: "separator" },
        {
          label: "Export All Customers",
          accelerator: "CmdOrCtrl+Shift+C",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("export-customers");
          }
        },
        {
          label: "Export Current Customers (Filtered)",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("export-current-customers");
          }
        },
        { type: "separator" },
        {
          label: "Export Inventory",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("export-inventory");
          }
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("show-shortcuts");
          }
        },
        { type: "separator" },
        {
          label: "About MonoStock",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              dialog.showMessageBox(win, {
                type: "info",
                title: "About MonoStock",
                message: "MonoStock v1.0.0",
                detail: "Built by Blaine Smith\nPowered by Electron\n\nManage orders, customers, inventory, budgets, and invoices."
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Excel ──

let lastExportPath = null;

const ExcelJS = require("exceljs");

ipcMain.handle("export-orders-excel", async (_, orders, query) => {
  try {
    const exportDir = path.join(app.getPath("documents"), "SanitaryInnovations", "Exports");
    fs.mkdirSync(exportDir, { recursive: true });

    const rows = orders.map(o => ({
      "Order #": o.orderNumber || "",
      "Date": o.dateTime || "",
      "Status": o.status || "",
      "Accounting": o.AccountingNameAccountingNum || "",
      "Customer": o.customerName || "",
      "Company": o.customerCompany || "",
      "Phone": o.customerPhone || "",
      "Email": o.customerEmail || "",
      "Billing Address": o.billingAddress || "",
      "Ship To": o.shipTo || "",
      "Location": o.location || "",
      "Unit Type": o.unitType || "",
      "Quantity": o.quantity || "",
      "Budget Total": o.budget?.totalWithTax || "",
      "Notes": o.notes || ""
    }));

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Orders");

    // Define column headers
    const headers = [
      "Order #",
      "Date",
      "Status",
      "Accounting",
      "Customer",
      "Company",
      "Phone",
      "Email",
      "Billing Address",
      "Ship To",
      "Location",
      "Unit Type",
      "Quantity",
      "Budget Total",
      "Notes"
    ];

    // Add header row with bold styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };

    // Add data rows
    rows.forEach(row => {
      worksheet.addRow([
        row["Order #"],
        row["Date"],
        row["Status"],
        row["Accounting"],
        row["Customer"],
        row["Company"],
        row["Phone"],
        row["Email"],
        row["Billing Address"],
        row["Ship To"],
        row["Location"],
        row["Unit Type"],
        row["Quantity"],
        row["Budget Total"],
        row["Notes"]
      ]);
    });

    // Freeze the top row
    worksheet.views = [
      {
        state: "frozen",
        ySplit: 1
      }
    ];

    // Auto-fit columns based on content
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      
      // Check header length
      const headerLength = headers[index] ? headers[index].toString().length : 0;
      maxLength = Math.max(maxLength, headerLength);
      
      // Check all data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          const cell = row.getCell(index + 1);
          const cellValue = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, cellValue);
        }
      });
      
      // Set width with some padding (min 10, max 50)
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    const safeQuery = (query || "all")
      .replace(/[^\w\d]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

    const fileName = `Orders_${safeQuery}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    lastExportPath = filePath;
    
    // Update the menu to enable "Open Last Export"
    createMenu();

    return { success: true, path: filePath };
  } catch (err) {
    console.error("EXPORT FAILED:", err);
    return { success: false, error: err.message };
  }
});




// ── Customers Excel ──

ipcMain.handle("export-customers-excel", async (_, customers) => {
  try {
    const exportDir = path.join(app.getPath("documents"), "SanitaryInnovations", "Exports");
    fs.mkdirSync(exportDir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers");

    const headers = ["ID", "Name", "Company", "Phone", "Email", "Billing Address", "Ship-To Address"];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };

    customers.forEach(c => {
      worksheet.addRow([
        c.id || "",
        c.name || "",
        c.company || "",
        c.phone || "",
        c.email || "",
        c.billingAddress || "",
        c.shipTo || ""
      ]);
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    worksheet.columns.forEach((column, index) => {
      let maxLength = headers[index] ? headers[index].toString().length : 0;
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const cell = row.getCell(index + 1);
          const cellValue = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, cellValue);
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    const fileName = `Customers_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    lastExportPath = filePath;
    createMenu();

    return { success: true, path: filePath };
  } catch (err) {
    console.error("CUSTOMERS EXPORT FAILED:", err);
    return { success: false, error: err.message };
  }
});

// ── Inventory Excel ──

ipcMain.handle("export-inventory-excel", async (_, rows) => {
  try {
    const exportDir = path.join(app.getPath("documents"), "SanitaryInnovations", "Exports");
    fs.mkdirSync(exportDir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory");

    const headers = ["Material", "In Stock", "Required", "Delta"];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };

    rows.forEach(row => {
      worksheet.addRow([
        row.material,
        row.inStock,
        row.required,
        row.deltaDisplay
      ]);
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    worksheet.columns.forEach((column, index) => {
      let maxLength = headers[index] ? headers[index].toString().length : 0;
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const cell = row.getCell(index + 1);
          const cellValue = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, cellValue);
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Inventory_${timestamp}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    lastExportPath = filePath;
    createMenu();

    return { success: true, path: filePath };
  } catch (err) {
    console.error("INVENTORY EXPORT FAILED:", err);
    return { success: false, error: err.message };
  }
});

// ── Invoice ──

ipcMain.handle("generate-invoice", async (_, data) => {
  const invoicesDir = path.join(app.getPath("userData"), "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const safeCustomer = (data.customerName || "Customer").replace(/[^a-z0-9]/gi, "_");

  const filePath = path.join(
    invoicesDir,
    `Invoice_${data.orderNumber || "Unknown"}_${safeCustomer}_${data.quantity || 0}.pdf`
  );

  // Helper: format a number as $X,XXX.XX
  const fmt = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ---------------- Header Logo (file path or data URL) ----------------
  const customLogo = data.companyLogoPath;
  let logoDraw = false;
  if (customLogo && customLogo.startsWith("data:")) {
    try {
      const base64 = customLogo.split(",")[1];
      if (base64) {
        const buf = Buffer.from(base64, "base64");
        doc.image(buf, (doc.page.width - 225) / 2, 20, { fit: [225, 80], align: "center", valign: "center" });
        logoDraw = true;
      }
    } catch (_) {}
  } else if (customLogo && fs.existsSync(customLogo)) {
    doc.image(customLogo, (doc.page.width - 225) / 2, 20, { fit: [225, 80], align: "center", valign: "center" });
    logoDraw = true;
  } else {
    const defaultLogo = path.join(__dirname, "assets", "logo.png");
    if (fs.existsSync(defaultLogo)) {
      doc.image(defaultLogo, (doc.page.width - 225) / 2, 20, { fit: [225, 80], align: "center", valign: "center" });
      logoDraw = true;
    }
  }
  if (!logoDraw) doc.moveDown(2);

  doc.moveDown(4);

  // ---------------- Company Address (from template) ----------------
  const addrLines = (data.companyAddress || "").split("\n").filter(Boolean);
  if (addrLines.length) {
    doc.fontSize(10);
    addrLines.forEach((line) => doc.text(line.trim(), { align: "center" }));
  }
  if (data.companyPhone) doc.text(data.companyPhone, { align: "center" });
  doc.moveDown(2);

  // ---------------- Invoice Title ----------------
  doc.font("Helvetica-Bold").fontSize(10)
     .text("INVOICE", { align: "left" })
     .moveDown(1);

  // ---------------- Invoice / Date ----------------
  const formattedDate =
    data.dateTime ||
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

  const accountingInfo = data.AccountingNameAccountingNum || "";

  doc.font("Helvetica")
    .text(`Invoice #: ${data.orderNumber || "N/A"}: ${accountingInfo}`, { align: "left" })
    .text(`Date: ${formattedDate}`, { align: "right" })
    .moveDown(1);

  // ---------------- Order Information ----------------
  doc.font("Helvetica-Bold").text("Order Information", { underline: true }).moveDown(0.5);

  doc.font("Helvetica")
     .text(`Location: ${data.location || ""}`)
     .text(`Unit: ${data.unitType || ""}`)
     .text(`Qty: ${data.quantity || ""}`)
     .text(`Status: ${data.status || ""}`)
     .moveDown(0.5);

  // ---------------- Customer Information ----------------
  doc.font("Helvetica-Bold").text("Customer Information", { underline: true }).moveDown(0.5);

  doc.font("Helvetica")
     .text(`Customer: ${data.customerName || ""}`)
     .text(`Company: ${data.customerCompany || ""}`)
     .text(`Phone: ${data.customerPhone || ""}`)
     .text(`Email: ${data.customerEmail || ""}`)
     .moveDown(0.5);

  // ---------------- Billing & Shipping ----------------
  doc.font("Helvetica-Bold").text("Billing & Shipping", { underline: true }).moveDown(0.5);

  doc.font("Helvetica")
     .text(`Billing Address: ${data.billingAddress || ""}`)
     .text(`Shipping Address: ${data.shipTo || ""}`)
     .moveDown(0.5);

  // ---------------- Notes ----------------
  if (data.notes) {
    doc.font("Helvetica-Bold").text("Notes:", { underline: true }).moveDown(0.2);
    doc.font("Helvetica").text(data.notes);
    doc.moveDown(1);
  }

  // ---------------- Description ----------------
  if (data.description) {
    doc.font("Helvetica-Bold").text("Description:", { underline: true }).moveDown(0.2);
    doc.font("Helvetica").text(data.description).moveDown(1);
  }

  // ---------------- Pricing ----------------
  doc.font("Helvetica-Bold").text("Invoice Sum:", { underline: true }).moveDown(0.2);

  const budget = data.budget || {};
  if (budget.qty && budget.productSubtotal !== undefined) {
    const items = Array.isArray(budget.lineItems) ? budget.lineItems : [];
    const beforeTaxItems = items.filter(li => (li.taxOption || "before") === "before");
    const noTaxItems     = items.filter(li => li.taxOption === "none");
    const afterTaxItems  = items.filter(li => li.taxOption === "after");

    // Helper to render a single line item
    function renderLineItem(li) {
      const label = li.label || "Other";
      const amt = Math.abs(li.amount || 0);
      if (li.type === "deduct") {
        doc.text(`${label}: ($${fmt(amt)})`);
      } else {
        doc.text(`${label}: $${fmt(amt)}`);
      }
    }

    doc.font("Helvetica")
       .text(`Quantity ${budget.qty}: $${fmt(budget.productSubtotal)}`)
       .text(`Freight: $${fmt(budget.freight)}`);

    // Before-tax items (taxable)
    beforeTaxItems.forEach(renderLineItem);

    // No-tax items (shown before the tax line)
    noTaxItems.forEach(renderLineItem);

    // Tax line
    doc.text(`Sales Tax: $${fmt(budget.taxAmount)}`);

    // After-tax items
    afterTaxItems.forEach(renderLineItem);

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold")
       .text(`Total Amount: $${fmt(budget.total || budget.totalWithTax)}`);
    doc.font("Helvetica");
  } else {
    doc.font("Helvetica").text("No budget information available.");
  }

  // ---------------- Terms & Conditions ----------------
  if (data.terms) {
    doc.moveDown(1);
    doc.font("Helvetica-Bold").text("Terms & Conditions:", { underline: true }).moveDown(0.2);
    doc.font("Helvetica").text(data.terms);
  }

  doc.moveDown(2);

  // ---------------- Footer ----------------
  if (data.thankYouText) doc.text(data.thankYouText, { align: "left" });
  if (data.companyName) doc.text(data.companyName, { align: "left" });
  if (data.customNote) doc.text(data.customNote, { align: "left" });

  doc.end();

  // Wait for the PDF file to be fully written before returning
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  // Track the last created invoice
  lastInvoicePath = filePath;
  
  // Update the menu to enable "Open Last Invoice"
  createMenu();

  return filePath;
});


// ── Window creation ──
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "MonoStock",
    icon: path.join(__dirname, 'assets', 'cube-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile('index.html');

  // Maximize on startup for better experience
  win.maximize();
}

// ── App lifecycle ──
app.whenReady().then(() => {
  createMenu();
  createWindow();

  // Create initial backup on launch
  createBackup();

  // Auto-backup every 30 minutes
  backupInterval = setInterval(createBackup, 30 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (backupInterval) clearInterval(backupInterval);
  createBackup(); // Final backup on close
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ── IPC Handlers ──

// Restore dialog triggered from web menu bar buttons
ipcMain.on('show-restore-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const backups = listBackups();
  if (!backups.length) {
    dialog.showMessageBox(win, { type: "info", title: "Backups", message: "No backups found." });
    return;
  }

  const result = await dialog.showOpenDialog(win, {
    title: "Select Backup to Restore",
    defaultPath: backupDir,
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const confirm = await dialog.showMessageBox(win, {
      type: "warning",
      title: "Restore Backup",
      message: "This will replace your current data with the selected backup. A backup of your current data will be created first. Continue?",
      buttons: ["Cancel", "Restore"],
      defaultId: 0,
      cancelId: 0
    });

    if (confirm.response === 1) {
      const restoreResult = restoreBackup(result.filePaths[0]);
      if (restoreResult.success) {
        win.webContents.send("backup-restored");
        win.reload();
      } else {
        dialog.showErrorBox("Restore Failed", restoreResult.error || "Unknown error");
      }
    }
  }
});

ipcMain.handle('load-dashboard', () => loadDashboard());

ipcMain.handle('save-dashboard', async (event, data) => {
  try {
    saveDashboard(data);
    return { success: true };
  } catch (err) {
    console.error('Save failed in IPC handler:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('create-backup', () => {
  const result = createBackup();
  return result ? { success: true, path: result } : { success: false };
});

ipcMain.handle('list-backups', () => listBackups());

ipcMain.handle('get-data-path', () => dataPath);

ipcMain.handle('open-file', (_, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return { success: true };
  }
  return { success: false };
});

// ── Pick Company Logo ──
ipcMain.handle("pick-company-logo", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Select Company Logo",
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }
      ],
      properties: ["openFile"]
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath);
    const destDir = path.join(app.getPath("userData"), "company");
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destPath = path.join(destDir, "logo" + ext);
    fs.copyFileSync(srcPath, destPath);
    return { success: true, path: destPath };
  } catch (err) {
    console.error("Logo pick failed:", err);
    return { success: false, error: err.message };
  }
});

// ── Import Orders from Excel ──
ipcMain.handle("import-orders-excel", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Select Excel File to Import",
      filters: [
        { name: "Excel Files", extensions: ["xlsx", "xls"] },
        { name: "All Files", extensions: ["*"] }
      ],
      properties: ["openFile"]
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { success: false, error: "No worksheet found in file." };
    }

    const headers = [];
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      headers[colNumber] = (cell.value || "").toString().trim().toLowerCase();
    });

    const headerMap = {};
    headers.forEach((h, i) => {
      if (!h) return;
      if (h.includes("order") && h.includes("#") || h === "order #" || h === "order number" || h === "ordernumber") headerMap.orderNumber = i;
      else if (h === "date" || h === "datetime" || h === "date/time") headerMap.dateTime = i;
      else if (h === "status") headerMap.status = i;
      else if (h === "accounting" || h.includes("accounting")) headerMap.AccountingNameAccountingNum = i;
      else if (h === "customer" || h === "customer name" || h === "customername") headerMap.customerName = i;
      else if (h === "company" || h === "customer company" || h === "customercompany") headerMap.customerCompany = i;
      else if (h === "phone" || h === "customer phone" || h === "customerphone") headerMap.customerPhone = i;
      else if (h === "email" || h === "customer email" || h === "customeremail") headerMap.customerEmail = i;
      else if (h === "location") headerMap.location = i;
      else if (h === "unit type" || h === "unittype") headerMap.unitType = i;
      else if (h === "quantity" || h === "qty") headerMap.quantity = i;
      else if (h === "billing address" || h === "billingaddress") headerMap.billingAddress = i;
      else if (h === "ship to" || h === "shipto" || h === "ship-to") headerMap.shipTo = i;
      else if (h === "notes") headerMap.notes = i;
      else if (h === "budget total" || h === "budgettotal" || h === "budget") headerMap.budgetTotal = i;
    });

    const orders = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const getVal = (field) => {
        const colIdx = headerMap[field];
        if (!colIdx) return "";
        const val = row.getCell(colIdx).value;
        if (val === null || val === undefined) return "";
        if (typeof val === "object" && val.text) return val.text;
        if (typeof val === "object" && val.result !== undefined) return String(val.result);
        return String(val).trim();
      };

      const customerName = getVal("customerName");
      const quantity = getVal("quantity");

      if (!customerName && !quantity) return;

      const orderObj = {
        orderNumber: getVal("orderNumber") || ("ORD-" + Math.floor(1000 + Math.random() * 9000)),
        dateTime: getVal("dateTime") || new Date().toLocaleDateString(),
        status: getVal("status") || "Pending",
        AccountingNameAccountingNum: getVal("AccountingNameAccountingNum"),
        customerName: customerName,
        customerCompany: getVal("customerCompany"),
        customerPhone: getVal("customerPhone"),
        customerEmail: getVal("customerEmail"),
        location: getVal("location"),
        unitType: getVal("unitType"),
        quantity: Number(quantity) || 1,
        billingAddress: getVal("billingAddress"),
        shipTo: getVal("shipTo"),
        notes: getVal("notes"),
        createdAt: Date.now(),
        id: require("crypto").randomUUID()
      };

      const budgetTotalRaw = getVal("budgetTotal");
      const budgetTotal = parseFloat(String(budgetTotalRaw).replace(/[^0-9.\-]/g, ""));
      if (budgetTotal && !isNaN(budgetTotal) && budgetTotal > 0) {
        const qty = orderObj.quantity || 1;
        const unitPrice = budgetTotal / qty;
        orderObj.budget = {
          qty: qty,
          unitPrice: unitPrice,
          productSubtotal: budgetTotal,
          freight: 0,
          costPerUnit: 0,
          cost: 0,
          lineItems: [],
          taxableSubtotal: budgetTotal,
          taxRate: 0,
          taxAmount: 0,
          totalWithTax: budgetTotal,
          total: budgetTotal,
          lastUpdated: new Date().toISOString()
        };
      }

      orders.push(orderObj);
    });

    if (!orders.length) {
      return { success: false, error: "No valid orders found in file." };
    }

    return { success: true, orders, fileName: path.basename(filePath) };
  } catch (err) {
    console.error("IMPORT FAILED:", err);
    return { success: false, error: err.message };
  }
});