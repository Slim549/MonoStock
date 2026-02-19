

let dashboardData = { title: "MonoStock", orders: [], customers: [], inventory: [], orderFolders: [], trash: [], products: [] };
const appDiv = document.getElementById("app");

let currentUser = null;

// Track currently displayed (filtered) results for "export current" feature
let currentFilteredOrders = null;
let currentFilteredCustomers = null;

// Track which folder is currently open (null = folder list view)
let currentOpenFolderId = null;

// Track collapsed state and visible rows for tables
let tableCollapseState = {
  costVsSell: false,
  customerProfit: false
};

let innerTableCollapse = {
  costVsSell: false,
  customerProfit: false
};

let tableVisibleRows = {
  costVsSell: 10,
  customerProfit: 10
};

// Dashboard table sort state
let costVsSellSortCol = null;
let costVsSellSortDir = "asc";
let customerProfitSortCol = null;
let customerProfitSortDir = "asc";

if (!appDiv) {
  console.error("appDiv not found! Make sure <div id='app'> exists in index.html");
}

// Startup — check auth, then load dashboard.
// Deferred so all top-level const/let declarations are initialised first.
setTimeout(async () => {
  if (!window.dashboardAPI) {
    console.error("dashboardAPI not available! Check preload.js");
    updateUserUI();
    renderDashboard();
    return;
  }

  // Check if the system has any registered users
  let hasUsers = false;
  try {
    const status = await window.dashboardAPI.authStatus();
    hasUsers = status.hasUsers;
  } catch { /* server may not support auth yet */ }

  // If users exist, require login
  if (hasUsers && window.dashboardAPI.isLoggedIn()) {
    try {
      const res = await window.dashboardAPI.authMe();
      if (res.user) {
        currentUser = res.user;
        if (res.user.avatar) localStorage.setItem('userAvatar', res.user.avatar);
      }
    } catch {
      currentUser = null;
    }
  }

  if (hasUsers && !currentUser) {
    renderLoginPage();
    return;
  }

  loadAndRenderDashboard();
}, 0);

function loadAndRenderDashboard() {
  window.dashboardAPI.load().then(data => {
    if (data) {
      dashboardData = data;
      dashboardData.sharedFolders = data.sharedFolders || [];
      dashboardData.sharedOrders = data.sharedOrders || [];
      dashboardData.sharedCustomers = data.sharedCustomers || [];
    }
    if (!Array.isArray(dashboardData.inventory)) dashboardData.inventory = [];
    if (!Array.isArray(dashboardData.orderFolders)) dashboardData.orderFolders = [];
    if (!Array.isArray(dashboardData.trash)) dashboardData.trash = [];
    if (!Array.isArray(dashboardData.products)) dashboardData.products = [];
    if (!Array.isArray(dashboardData.sharedFolders)) dashboardData.sharedFolders = [];
    if (!Array.isArray(dashboardData.sharedOrders)) dashboardData.sharedOrders = [];
    if (!Array.isArray(dashboardData.sharedCustomers)) dashboardData.sharedCustomers = [];
    updateUserUI();
    renderDashboard();
  }).catch(err => {
    console.error("Failed to load dashboard:", err);
    updateUserUI();
    renderDashboard();
  });
}

// Save dashboard
function saveDashboard() {
  window.dashboardAPI.save(dashboardData)
    .then(result => {
      if (result && !result.success) showToast("Error saving data. See console.", "error");
    })
    .catch(err => {
      console.error("Failed to save dashboard:", err);
      showToast("Error saving data. Check console.", "error");
    });
}

console.log('Is dashboardAPI available?', !!window.dashboardAPI);


// ---------------- Settings Gear Button (top-right) ----------------
const settingsBtn = document.createElement("button");
settingsBtn.id = "settings-gear";
settingsBtn.title = "Settings";
settingsBtn.innerHTML = "&#9881;";
settingsBtn.onclick = () => renderSettingsPage();
document.body.appendChild(settingsBtn);

// ---------------- User Avatar Button ----------------
const userAvatarBtn = document.createElement("button");
userAvatarBtn.id = "user-avatar-btn";
userAvatarBtn.title = "Profile";
userAvatarBtn.style.display = "none";
userAvatarBtn.onclick = () => {
  if (currentUser) {
    renderProfilePage();
  } else {
    renderSignupPage();
  }
};
document.body.appendChild(userAvatarBtn);

function updateUserUI() {
  if (currentUser) {
    const avatar = currentUser.avatar || localStorage.getItem('userAvatar');
    if (avatar) {
      userAvatarBtn.innerHTML = `<img src="${avatar}" alt="avatar">`;
    } else {
      const initials = currentUser.name
        ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';
      userAvatarBtn.textContent = initials;
    }
    userAvatarBtn.title = currentUser.name || 'Profile';
  } else {
    userAvatarBtn.textContent = '\u{1F464}';
    userAvatarBtn.title = 'Sign up / Log in';
  }
  userAvatarBtn.style.display = 'flex';
}

// ---------------- TRANSLATIONS ----------------
const translations = {
  en: {
    // Nav
    dashboard: "Dashboard", orders: "Orders", customers: "Customers", inventory: "Inventory", settings: "Settings",
    // Page titles & subtitles
    budgetForOrder: "Budget for Order", welcomeTitle: "MonoStock",
    totalOrdersLabel: "total orders", activeLabel: "active", unitsLabel: "units",
    customersOnFile: "customer on file", customersOnFilePlural: "customers on file",
    materialsTracked: "materials tracked",
    // KPI
    kpiTotalOrders: "Total Orders", kpiTotalRevenue: "Total Revenue", kpiTotalProfit: "Total Profit",
    kpiCustomers: "Customers", kpiAvgOrder: "Avg Order Value", kpiNeedsAttention: "Needs Attention",
    kpiTotalUnits: "total units", kpiOrdersWithBudgets: "orders with budgets",
    kpiMargin: "margin", kpiActiveAccounts: "Active accounts",
    kpiPerBudgetedOrder: "Per budgeted order", kpiPendingOrders: "Pending orders",
    kpiLowStockItems: "Low stock items",
    // Dashboard cards
    pendingOrdersTitle: "Pending Orders", orderStatusChart: "Order Status Chart",
    revenueOverTime: "Revenue Over Time", costVsSellTitle: "Cost vs Sell Price Breakdown",
    customerProfitTitle: "Customer Profitability Ranking", alertsTitle: "Alerts",
    // Table headers
    thOrder: "Order", thCustomer: "Customer", thCompany: "Company", thUnits: "Units",
    thStatus: "Status", thDate: "Date", thAccounting: "Accounting", thLocation: "Location",
    thUnitType: "Unit Type", thQty: "Qty", thName: "Name", thPhone: "Phone", thEmail: "Email",
    thBillingAddress: "Billing Address", thShipTo: "Ship To", thNotes: "Notes",
    thBudget: "Budget", thActions: "Actions", thRank: "Rank",
    thSellPrice: "Sell Price", thCost: "Cost", thProfit: "Profit", thMargin: "Margin",
    thTotalRevenue: "Total Revenue", thTotalCost: "Total Cost", thTotalProfit: "Total Profit",
    thOrders: "Orders",
    thMaterial: "Material", thRequired: "Required", thInStock: "In Stock", thDelta: "Delta",
    thDescription: "Description", thType: "Type", thTax: "Tax", thAmount: "Amount",
    // Buttons
    btnAddOrder: "+ Add Order", btnAddCustomer: "+ Add Customer", btnAddItem: "+ Add Item",
    btnSave: "Save", btnCancel: "Cancel", btnDelete: "Delete",
    btnSaveBudget: "Save Budget", btnAddLineItem: "+ Add Line Item",
    btnCreate: "Create", btnBackToOrders: "Back to Orders", btnBackToDashboard: "Back to Dashboard",
    // Budget
    budgetDetails: "Budget Details", unitPriceLabel: "Unit Price (per assembly):",
    salesTaxLabel: "Sales Tax Rate (%):", freightLabel: "Freight:",
    costToProduceLabel: "Cost to Produce (per unit):", additionalLineItems: "Additional Line Items",
    breakdownTitle: "Breakdown", productSubtotal: "Product Subtotal",
    salesTax: "Sales Tax", totalLabel: "Total:", totalCostLabel: "Total Cost",
    profitLabel: "Profit",
    // Budget line item options
    additionType: "Addition (+)", deductionType: "Deduction (-)",
    beforeTax: "Before Tax", afterTax: "After Tax", noTax: "No Tax",
    // Alerts
    alertIsPending: "is pending", alertRequiresMaintenance: "requires maintenance",
    alertUnitsShort: "units short", alertNeed: "need", alertHave: "have",
    alertWithoutBudget: "active order without a budget", alertWithoutBudgetPlural: "active orders without a budget",
    alertNoAlerts: "No current alerts — everything looks good!",
    // Misc
    noOrdersFound: "No orders found", noDataYet: "No revenue data yet.",
    noBudgetsYet: "No orders with budgets yet. Create a budget from the Orders page.",
    searchPlaceholder: "Search orders… (hover for tips)", searchCustomers: "Search customers…",
    totals: "TOTALS", showMore: "Show More", noNotes: "(no notes)",
    orderLabel: "Order", unitLabel: "unit", unitsLabelSingular: "unit",
    cumulativeRevenue: "Cumulative Revenue", cumulativeProfit: "Cumulative Profit",
    // Inventory
    totalItemsLabel: "Total Items", lowStockLabel: "Low Stock",
    surplusLabel: "Surplus", balancedLabel: "Balanced",
    // Settings
    settingsAppearance: "Appearance", settingsDarkMode: "Dark Mode",
    settingsCompactView: "Compact View", settingsFontSize: "Font Size",
    settingsRegional: "Regional", settingsLanguage: "Language",
    settingsDateFormat: "Date Format", settingsNavigation: "Navigation",
    settingsAutoCollapse: "Auto-collapse Navigation Bar",
    settingsDashboardLayout: "Dashboard Layout", settingsDashboardDesc: "Choose which cards to show on the Dashboard.",
    settingsPendingOrders: "Pending Orders", settingsStatusChart: "Order Status Chart",
    settingsCostVsSell: "Cost vs Sell Price Breakdown", settingsCustomerProfit: "Customer Profitability Ranking",
    settingsAlerts: "Alerts", settingsData: "Data",
    settingsRowsPerPage: "Default Orders per Page", settingsCurrency: "Default Currency Symbol",
    settingsAbout: "About",
    fontSmall: "Small", fontMedium: "Medium", fontLarge: "Large",
    // Order form
    newOrder: "New Order", editOrder: "Edit Order",
    budgetSaved: "Budget saved! Total:",
  },
  es: {
    dashboard: "Tablero", orders: "Pedidos", customers: "Clientes", inventory: "Inventario", settings: "Ajustes",
    budgetForOrder: "Presupuesto para Pedido", welcomeTitle: "MonoStock",
    totalOrdersLabel: "pedidos totales", activeLabel: "activos", unitsLabel: "unidades",
    customersOnFile: "cliente en archivo", customersOnFilePlural: "clientes en archivo",
    materialsTracked: "materiales rastreados",
    kpiTotalOrders: "Pedidos Totales", kpiTotalRevenue: "Ingresos Totales", kpiTotalProfit: "Ganancia Total",
    kpiCustomers: "Clientes", kpiAvgOrder: "Valor Promedio", kpiNeedsAttention: "Requiere Atención",
    kpiTotalUnits: "unidades totales", kpiOrdersWithBudgets: "pedidos con presupuesto",
    kpiMargin: "margen", kpiActiveAccounts: "Cuentas activas",
    kpiPerBudgetedOrder: "Por pedido presupuestado", kpiPendingOrders: "Pedidos pendientes",
    kpiLowStockItems: "Artículos con bajo stock",
    pendingOrdersTitle: "Pedidos Pendientes", orderStatusChart: "Gráfico de Estado",
    revenueOverTime: "Ingresos en el Tiempo", costVsSellTitle: "Costo vs Precio de Venta",
    customerProfitTitle: "Rentabilidad por Cliente", alertsTitle: "Alertas",
    thOrder: "Pedido", thCustomer: "Cliente", thCompany: "Empresa", thUnits: "Unidades",
    thStatus: "Estado", thDate: "Fecha", thAccounting: "Contabilidad", thLocation: "Ubicación",
    thUnitType: "Tipo de Unidad", thQty: "Cant.", thName: "Nombre", thPhone: "Teléfono", thEmail: "Correo",
    thBillingAddress: "Dirección de Facturación", thShipTo: "Enviar a", thNotes: "Notas",
    thBudget: "Presupuesto", thActions: "Acciones", thRank: "Rango",
    thSellPrice: "Precio de Venta", thCost: "Costo", thProfit: "Ganancia", thMargin: "Margen",
    thTotalRevenue: "Ingresos Totales", thTotalCost: "Costo Total", thTotalProfit: "Ganancia Total",
    thOrders: "Pedidos",
    thMaterial: "Material", thRequired: "Requerido", thInStock: "En Stock", thDelta: "Delta",
    thDescription: "Descripción", thType: "Tipo", thTax: "Impuesto", thAmount: "Monto",
    btnAddOrder: "+ Agregar Pedido", btnAddCustomer: "+ Agregar Cliente", btnAddItem: "+ Agregar Artículo",
    btnSave: "Guardar", btnCancel: "Cancelar", btnDelete: "Eliminar",
    btnSaveBudget: "Guardar Presupuesto", btnAddLineItem: "+ Agregar Línea",
    btnCreate: "Crear", btnBackToOrders: "Volver a Pedidos", btnBackToDashboard: "Volver al Tablero",
    budgetDetails: "Detalles del Presupuesto", unitPriceLabel: "Precio Unitario (por ensamblaje):",
    salesTaxLabel: "Tasa de Impuesto (%):", freightLabel: "Flete:",
    costToProduceLabel: "Costo de Producción (por unidad):", additionalLineItems: "Líneas Adicionales",
    breakdownTitle: "Desglose", productSubtotal: "Subtotal de Producto",
    salesTax: "Impuesto", totalLabel: "Total:", totalCostLabel: "Costo Total",
    profitLabel: "Ganancia",
    additionType: "Adición (+)", deductionType: "Deducción (-)",
    beforeTax: "Antes de Impuesto", afterTax: "Después de Impuesto", noTax: "Sin Impuesto",
    alertIsPending: "está pendiente", alertRequiresMaintenance: "requiere mantenimiento",
    alertUnitsShort: "unidades faltantes", alertNeed: "necesita", alertHave: "tiene",
    alertWithoutBudget: "pedido activo sin presupuesto", alertWithoutBudgetPlural: "pedidos activos sin presupuesto",
    alertNoAlerts: "Sin alertas — ¡todo se ve bien!",
    noOrdersFound: "No se encontraron pedidos", noDataYet: "Sin datos de ingresos aún.",
    noBudgetsYet: "Aún no hay pedidos con presupuesto. Cree uno desde la página de Pedidos.",
    searchPlaceholder: "Buscar pedidos… (pase el cursor para tips)", searchCustomers: "Buscar clientes…",
    totals: "TOTALES", showMore: "Mostrar Más", noNotes: "(sin notas)",
    orderLabel: "Pedido", unitLabel: "unidad", unitsLabelSingular: "unidad",
    cumulativeRevenue: "Ingresos Acumulados", cumulativeProfit: "Ganancia Acumulada",
    totalItemsLabel: "Total de Artículos", lowStockLabel: "Bajo Stock",
    surplusLabel: "Excedente", balancedLabel: "Equilibrado",
    settingsAppearance: "Apariencia", settingsDarkMode: "Modo Oscuro",
    settingsCompactView: "Vista Compacta", settingsFontSize: "Tamaño de Fuente",
    settingsRegional: "Regional", settingsLanguage: "Idioma",
    settingsDateFormat: "Formato de Fecha", settingsNavigation: "Navegación",
    settingsAutoCollapse: "Auto-colapsar Barra de Navegación",
    settingsDashboardLayout: "Diseño del Tablero", settingsDashboardDesc: "Elija qué tarjetas mostrar en el Tablero.",
    settingsPendingOrders: "Pedidos Pendientes", settingsStatusChart: "Gráfico de Estado",
    settingsCostVsSell: "Costo vs Precio de Venta", settingsCustomerProfit: "Rentabilidad por Cliente",
    settingsAlerts: "Alertas", settingsData: "Datos",
    settingsRowsPerPage: "Pedidos por Página", settingsCurrency: "Símbolo de Moneda",
    settingsAbout: "Acerca de",
    fontSmall: "Pequeño", fontMedium: "Mediano", fontLarge: "Grande",
    newOrder: "Nuevo Pedido", editOrder: "Editar Pedido",
    budgetSaved: "¡Presupuesto guardado! Total:",
  },
  fr: {
    dashboard: "Tableau de bord", orders: "Commandes", customers: "Clients", inventory: "Inventaire", settings: "Paramètres",
    budgetForOrder: "Budget pour la Commande", welcomeTitle: "MonoStock",
    totalOrdersLabel: "commandes totales", activeLabel: "actives", unitsLabel: "unités",
    customersOnFile: "client en fichier", customersOnFilePlural: "clients en fichier",
    materialsTracked: "matériaux suivis",
    kpiTotalOrders: "Total Commandes", kpiTotalRevenue: "Revenu Total", kpiTotalProfit: "Profit Total",
    kpiCustomers: "Clients", kpiAvgOrder: "Valeur Moyenne", kpiNeedsAttention: "Attention Requise",
    kpiTotalUnits: "unités totales", kpiOrdersWithBudgets: "commandes avec budget",
    kpiMargin: "marge", kpiActiveAccounts: "Comptes actifs",
    kpiPerBudgetedOrder: "Par commande budgétée", kpiPendingOrders: "Commandes en attente",
    kpiLowStockItems: "Articles en rupture",
    pendingOrdersTitle: "Commandes en Attente", orderStatusChart: "Graphique des Statuts",
    revenueOverTime: "Revenu au Fil du Temps", costVsSellTitle: "Coût vs Prix de Vente",
    customerProfitTitle: "Rentabilité par Client", alertsTitle: "Alertes",
    thOrder: "Commande", thCustomer: "Client", thCompany: "Entreprise", thUnits: "Unités",
    thStatus: "Statut", thDate: "Date", thAccounting: "Comptabilité", thLocation: "Emplacement",
    thUnitType: "Type d'Unité", thQty: "Qté", thName: "Nom", thPhone: "Téléphone", thEmail: "Courriel",
    thBillingAddress: "Adresse de Facturation", thShipTo: "Livrer à", thNotes: "Notes",
    thBudget: "Budget", thActions: "Actions", thRank: "Rang",
    thSellPrice: "Prix de Vente", thCost: "Coût", thProfit: "Profit", thMargin: "Marge",
    thTotalRevenue: "Revenu Total", thTotalCost: "Coût Total", thTotalProfit: "Profit Total",
    thOrders: "Commandes",
    thMaterial: "Matériau", thRequired: "Requis", thInStock: "En Stock", thDelta: "Delta",
    thDescription: "Description", thType: "Type", thTax: "Taxe", thAmount: "Montant",
    btnAddOrder: "+ Ajouter Commande", btnAddCustomer: "+ Ajouter Client", btnAddItem: "+ Ajouter Article",
    btnSave: "Enregistrer", btnCancel: "Annuler", btnDelete: "Supprimer",
    btnSaveBudget: "Enregistrer Budget", btnAddLineItem: "+ Ajouter Ligne",
    btnCreate: "Créer", btnBackToOrders: "Retour aux Commandes", btnBackToDashboard: "Retour au Tableau",
    budgetDetails: "Détails du Budget", unitPriceLabel: "Prix Unitaire (par assemblage) :",
    salesTaxLabel: "Taux de Taxe (%) :", freightLabel: "Transport :",
    costToProduceLabel: "Coût de Production (par unité) :", additionalLineItems: "Lignes Supplémentaires",
    breakdownTitle: "Ventilation", productSubtotal: "Sous-total Produit",
    salesTax: "Taxe de Vente", totalLabel: "Total :", totalCostLabel: "Coût Total",
    profitLabel: "Profit",
    additionType: "Addition (+)", deductionType: "Déduction (-)",
    beforeTax: "Avant Taxe", afterTax: "Après Taxe", noTax: "Sans Taxe",
    alertIsPending: "est en attente", alertRequiresMaintenance: "nécessite une maintenance",
    alertUnitsShort: "unités manquantes", alertNeed: "besoin", alertHave: "en stock",
    alertWithoutBudget: "commande active sans budget", alertWithoutBudgetPlural: "commandes actives sans budget",
    alertNoAlerts: "Aucune alerte — tout va bien !",
    noOrdersFound: "Aucune commande trouvée", noDataYet: "Pas encore de données de revenu.",
    noBudgetsYet: "Pas encore de commandes avec budget. Créez un budget depuis la page Commandes.",
    searchPlaceholder: "Rechercher des commandes…", searchCustomers: "Rechercher des clients…",
    totals: "TOTAUX", showMore: "Afficher Plus", noNotes: "(pas de notes)",
    orderLabel: "Commande", unitLabel: "unité", unitsLabelSingular: "unité",
    cumulativeRevenue: "Revenu Cumulé", cumulativeProfit: "Profit Cumulé",
    totalItemsLabel: "Total Articles", lowStockLabel: "Stock Faible",
    surplusLabel: "Excédent", balancedLabel: "Équilibré",
    settingsAppearance: "Apparence", settingsDarkMode: "Mode Sombre",
    settingsCompactView: "Vue Compacte", settingsFontSize: "Taille de Police",
    settingsRegional: "Régional", settingsLanguage: "Langue",
    settingsDateFormat: "Format de Date", settingsNavigation: "Navigation",
    settingsAutoCollapse: "Réduire auto la Barre de Navigation",
    settingsDashboardLayout: "Disposition du Tableau", settingsDashboardDesc: "Choisissez les cartes à afficher sur le Tableau de bord.",
    settingsPendingOrders: "Commandes en Attente", settingsStatusChart: "Graphique des Statuts",
    settingsCostVsSell: "Coût vs Prix de Vente", settingsCustomerProfit: "Rentabilité par Client",
    settingsAlerts: "Alertes", settingsData: "Données",
    settingsRowsPerPage: "Commandes par Page", settingsCurrency: "Symbole de Devise",
    settingsAbout: "À Propos",
    fontSmall: "Petite", fontMedium: "Moyenne", fontLarge: "Grande",
    newOrder: "Nouvelle Commande", editOrder: "Modifier Commande",
    budgetSaved: "Budget enregistré ! Total :",
  }
};

function t(key) {
  const lang = getSettings().language || "en";
  return (translations[lang] || translations.en)[key] || translations.en[key] || key;
}

function getCurrency() {
  return getSettings().currency || "$";
}

// ---------------- SETTINGS HELPERS ----------------
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem("appSettings") || "{}");
  } catch { return {}; }
}

function saveSettings(settings) {
  localStorage.setItem("appSettings", JSON.stringify(settings));
}

function applySettings() {
  const s = getSettings();

  // Theme
  const theme = s.theme || localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  // Font size
  document.body.classList.remove("font-small", "font-medium", "font-large");
  document.body.classList.add("font-" + (s.fontSize || "medium"));

  // Compact mode
  document.body.classList.toggle("compact", !!s.compact);

  // Nav collapse (default: on)
  document.body.classList.toggle("nav-collapsed", s.navCollapsed !== false);
}

function updateAppTitle() {
  const s = getSettings();
  const companyName = s.companyName || "";
  const title = companyName ? `MonoStock - ${companyName}` : "MonoStock";
  document.title = title;
  dashboardData.title = title;
}

// Apply settings immediately on load
applySettings();
updateAppTitle();

// Listen for menu-bar actions
if (window.dashboardAPI) {
  if (window.dashboardAPI.onOpenSettings) {
    window.dashboardAPI.onOpenSettings(() => renderSettingsPage());
  }

  if (window.dashboardAPI.onExportOrders) {
    window.dashboardAPI.onExportOrders(async () => {
      const orders = dashboardData.orders || [];
      if (!orders.length) { showToast("No orders to export", "warning"); return; }
      try {
        const result = await window.dashboardAPI.exportOrdersExcel(orders, "all");
        if (result.success) {
          showToast(`Exported ${orders.length} order${orders.length === 1 ? "" : "s"}`, "success");
          if (getSettings().autoOpenExports && result.path) window.dashboardAPI.openFile(result.path);
        }
        else showToast("Export failed" + (result.error ? `: ${result.error}` : ""), "error");
      } catch (err) { console.error("Export error:", err); showToast("Export failed – check console", "error"); }
    });
  }

  if (window.dashboardAPI.onExportCurrentOrders) {
    window.dashboardAPI.onExportCurrentOrders(async () => {
      const orders = currentFilteredOrders || dashboardData.orders || [];
      if (!orders.length) { showToast("No orders in current view to export", "warning"); return; }
      const query = document.getElementById("orderSearch")?.value?.trim() || "filtered";
      try {
        const result = await window.dashboardAPI.exportOrdersExcel(orders, query);
        if (result.success) {
          showToast(`Exported ${orders.length} filtered order${orders.length === 1 ? "" : "s"}`, "success");
          if (getSettings().autoOpenExports && result.path) window.dashboardAPI.openFile(result.path);
        }
        else showToast("Export failed" + (result.error ? `: ${result.error}` : ""), "error");
      } catch (err) { console.error("Export error:", err); showToast("Export failed – check console", "error"); }
    });
  }

  if (window.dashboardAPI.onExportCustomers) {
    window.dashboardAPI.onExportCustomers(async () => {
      const customers = dashboardData.customers || [];
      if (!customers.length) { showToast("No customers to export", "warning"); return; }
      try {
        const result = await window.dashboardAPI.exportCustomersExcel(customers);
        if (result.success) {
          showToast(`Exported ${customers.length} customer${customers.length === 1 ? "" : "s"}`, "success");
          if (getSettings().autoOpenExports && result.path) window.dashboardAPI.openFile(result.path);
        }
        else showToast("Export failed" + (result.error ? `: ${result.error}` : ""), "error");
      } catch (err) { console.error("Export error:", err); showToast("Export failed – check console", "error"); }
    });
  }

  if (window.dashboardAPI.onExportCurrentCustomers) {
    window.dashboardAPI.onExportCurrentCustomers(async () => {
      const customers = currentFilteredCustomers || dashboardData.customers || [];
      if (!customers.length) { showToast("No customers in current view to export", "warning"); return; }
      try {
        const result = await window.dashboardAPI.exportCustomersExcel(customers);
        if (result.success) {
          showToast(`Exported ${customers.length} filtered customer${customers.length === 1 ? "" : "s"}`, "success");
          if (getSettings().autoOpenExports && result.path) window.dashboardAPI.openFile(result.path);
        }
        else showToast("Export failed" + (result.error ? `: ${result.error}` : ""), "error");
      } catch (err) { console.error("Export error:", err); showToast("Export failed – check console", "error"); }
    });
  }

  if (window.dashboardAPI.onExportInventory) {
    window.dashboardAPI.onExportInventory(async () => {
      const inv = dashboardData.inventory || [];
      if (!inv.length) { showToast("No inventory to export", "warning"); return; }
      const rows = inv.map(item => {
        const delta = (item.required || 0) - (item.inStock || 0);
        return { material: item.material || "", inStock: item.inStock || 0, required: item.required || 0, delta, deltaDisplay: delta < 0 ? `(${Math.abs(delta)})` : String(delta) };
      });
      try {
        const result = await window.dashboardAPI.exportInventoryExcel(rows);
        if (result.success) {
          showToast(`Exported ${rows.length} inventory item${rows.length === 1 ? "" : "s"}`, "success");
          if (getSettings().autoOpenExports && result.path) window.dashboardAPI.openFile(result.path);
        }
        else showToast("Export failed" + (result.error ? `: ${result.error}` : ""), "error");
      } catch (err) { console.error("Export error:", err); showToast("Export failed – check console", "error"); }
    });
  }

  if (window.dashboardAPI.onBackupCreated) {
    window.dashboardAPI.onBackupCreated((filePath) => {
      showToast("Backup created successfully!", "success");
    });
  }

  if (window.dashboardAPI.onBackupRestored) {
    window.dashboardAPI.onBackupRestored(() => {
      showToast("Data restored from backup. Reloading…", "success", 3000);
    });
  }

  if (window.dashboardAPI.onShowShortcuts) {
    window.dashboardAPI.onShowShortcuts(() => showKeyboardShortcutsDialog());
  }
}

// Keyboard shortcuts dialog
function showKeyboardShortcutsDialog() {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:500px;">
      <h3>Keyboard Shortcuts</h3>
      <table style="width:100%; margin:0;">
        <tbody>
          <tr><td><span class="kbd">Ctrl+N</span></td><td>New Order (on Orders page)</td></tr>
          <tr><td><span class="kbd">Ctrl+F</span></td><td>Focus search bar</td></tr>
          <tr><td><span class="kbd">Ctrl+B</span></td><td>Create backup</td></tr>
          <tr><td><span class="kbd">Ctrl+,</span></td><td>Open Settings</td></tr>
          <tr><td><span class="kbd">Ctrl+Shift+O</span></td><td>Export Orders</td></tr>
          <tr><td><span class="kbd">Ctrl+Shift+C</span></td><td>Export Customers</td></tr>
          <tr><td><span class="kbd">Ctrl+Shift+I</span></td><td>Export Inventory</td></tr>
          <tr><td><span class="kbd">Esc</span></td><td>Close modal / dialog</td></tr>
        </tbody>
      </table>
      <div class="modal-actions" style="margin-top:20px;">
        <button onclick="this.closest('.modal').remove()" style="background:var(--button-bg);">Got it</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

// ---------------- SETTINGS PAGE ----------------
function renderSettingsPage() {
  if (!appDiv) return;

  window.currentPage = "settings";
  const s = getSettings();
  const currentTheme = s.theme || localStorage.getItem("theme") || "light";

  appDiv.innerHTML = `
    <button class="back-arrow" onclick="renderDashboard()">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
      ${t("btnBackToDashboard")}
    </button>
    <h1>${t("settings")}</h1>

    <div class="settings-section">
      <h3>Company</h3>

      <div class="setting-row">
        <label>Company Name</label>
        <div class="setting-control">
          <input type="text" id="set-company-name" value="${(s.companyName || '').replace(/"/g, '&quot;')}" placeholder="My Company" style="padding:6px 10px; border:1px solid var(--border-color); border-radius:6px; background:var(--card-bg); color:var(--text-color); font-size:0.95em; width:220px;">
        </div>
      </div>

      <div class="setting-row">
        <label>Company Logo</label>
        <div class="setting-control" style="display:flex; align-items:center; gap:12px;">
          <button id="btn-pick-logo" style="padding:8px 16px; font-size:0.88em; background:var(--info-color);">Choose Image…</button>
          <span style="font-size:0.8em; opacity:0.5;">Recommended: 450 × 160 px, PNG</span>
          <span id="logo-status" style="font-size:0.85em; opacity:0.7;">${s.companyLogoPath ? '✔ Custom logo set' : 'Using default logo'}</span>
          ${s.companyLogoPath ? '<button id="btn-clear-logo" style="padding:6px 12px; font-size:0.82em; background:var(--danger-color);">Remove</button>' : ''}
        </div>
      </div>
      ${s.companyLogoPath ? `<div style="margin-top:10px; text-align:center;"><img id="logo-preview" src="${s.companyLogoPath.startsWith('data:') ? s.companyLogoPath : 'file:///' + (s.companyLogoPath || '').replace(/\\/g, '/') + '?t=' + Date.now()}" style="max-width:200px; max-height:80px; border-radius:6px; border:1px solid var(--border-color);"></div>` : ''}
    </div>

    <div class="settings-section">
      <h3>${t("settingsAppearance")}</h3>

      <div class="setting-row">
        <label>${t("settingsDarkMode")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-darkmode" ${currentTheme === "dark" ? "checked" : ""}>
        </div>
      </div>

      <div class="setting-row">
        <label>${t("settingsCompactView")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-compact" ${s.compact ? "checked" : ""}>
        </div>
      </div>

      <div class="setting-row">
        <label>${t("settingsFontSize")}</label>
        <div class="setting-control">
          <select id="set-fontsize">
            <option value="small" ${s.fontSize === "small" ? "selected" : ""}>${t("fontSmall")}</option>
            <option value="medium" ${(s.fontSize || "medium") === "medium" ? "selected" : ""}>${t("fontMedium")}</option>
            <option value="large" ${s.fontSize === "large" ? "selected" : ""}>${t("fontLarge")}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${t("settingsRegional")}</h3>

      <div class="setting-row">
        <label>${t("settingsLanguage")}</label>
        <div class="setting-control">
          <select id="set-language">
            <option value="en" ${(s.language || "en") === "en" ? "selected" : ""}>English</option>
            <option value="es" ${s.language === "es" ? "selected" : ""}>Español</option>
            <option value="fr" ${s.language === "fr" ? "selected" : ""}>Français</option>
          </select>
        </div>
      </div>

      <div class="setting-row">
        <label>${t("settingsDateFormat")}</label>
        <div class="setting-control">
          <select id="set-dateformat">
            <option value="en-US" ${(s.dateFormat || "en-US") === "en-US" ? "selected" : ""}>MM/DD/YYYY</option>
            <option value="en-CA" ${s.dateFormat === "en-CA" ? "selected" : ""}>YYYY-MM-DD</option>
            <option value="en-GB" ${s.dateFormat === "en-GB" ? "selected" : ""}>DD/MM/YYYY</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${t("settingsNavigation")}</h3>

      <div class="setting-row">
        <label>${t("settingsAutoCollapse")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-navcollapse" ${s.navCollapsed !== false ? "checked" : ""}>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Behavior</h3>

      <div class="setting-row">
        <label>Auto-open Exports</label>
        <div class="setting-control">
          <input type="checkbox" id="set-autoopen-exports" ${s.autoOpenExports ? "checked" : ""}>
        </div>
      </div>

      <div class="setting-row">
        <label>Auto-open Invoices</label>
        <div class="setting-control">
          <input type="checkbox" id="set-autoopen-invoices" ${s.autoOpenInvoices ? "checked" : ""}>
        </div>
      </div>
    </div>

    <div class="settings-section" id="business-mode-section">
      <h3>Business Mode</h3>
      <p style="margin:0 0 10px; opacity:0.7; font-size:0.9em;">
        Choose how your business handles products. Single-Product Mode is for businesses that sell one type of product.
        Multi-Product Mode allows multiple product types per order with individual pricing.
      </p>

      <div class="setting-row">
        <label>Product Mode</label>
        <div class="setting-control">
          <select id="set-business-mode">
            <option value="single" ${(s.businessMode || "single") === "single" ? "selected" : ""}>Single-Product Mode</option>
            <option value="multi" ${s.businessMode === "multi" ? "selected" : ""}>Multi-Product Mode</option>
          </select>
        </div>
      </div>

      <div id="products-manager" style="margin-top:20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <h4 style="margin:0; font-size:1.05em; opacity:0.85;">Product Catalog</h4>
          <button id="add-product-btn" style="padding:8px 16px; font-size:0.88em; background:var(--success-color);">+ Add Product</button>
        </div>
        <div id="products-list"></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${t("settingsDashboardLayout")}</h3>
      <p style="margin:0 0 10px; opacity:0.7; font-size:0.9em;">${t("settingsDashboardDesc")}</p>

      <div class="setting-row">
        <label>${t("settingsPendingOrders")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-card-pending" ${(s.dashboardCards?.pendingOrders ?? true) ? "checked" : ""}>
        </div>
      </div>
      <div class="setting-row">
        <label>${t("settingsStatusChart")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-card-status" ${(s.dashboardCards?.statusChart ?? true) ? "checked" : ""}>
        </div>
      </div>
      <div class="setting-row">
        <label>${t("settingsCostVsSell")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-card-cost" ${(s.dashboardCards?.costVsSell ?? true) ? "checked" : ""}>
        </div>
      </div>
      <div class="setting-row">
        <label>${t("settingsCustomerProfit")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-card-profit" ${(s.dashboardCards?.customerProfit ?? true) ? "checked" : ""}>
        </div>
      </div>
      <div class="setting-row">
        <label>${t("settingsAlerts")}</label>
        <div class="setting-control">
          <input type="checkbox" id="set-card-alerts" ${(s.dashboardCards?.alerts ?? true) ? "checked" : ""}>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${t("settingsData")}</h3>
      <div class="setting-row">
        <label>${t("settingsRowsPerPage")}</label>
        <div class="setting-control">
          <select id="set-rows-per-page">
            <option value="10" ${(s.rowsPerPage || 10) === 10 ? "selected" : ""}>10</option>
            <option value="25" ${s.rowsPerPage === 25 ? "selected" : ""}>25</option>
            <option value="50" ${s.rowsPerPage === 50 ? "selected" : ""}>50</option>
            <option value="100" ${s.rowsPerPage === 100 ? "selected" : ""}>100</option>
          </select>
        </div>
      </div>
      <div class="setting-row">
        <label>${t("settingsCurrency")}</label>
        <div class="setting-control">
          <select id="set-currency">
            <option value="$" ${(s.currency || "$") === "$" ? "selected" : ""}>$ USD</option>
            <option value="€" ${s.currency === "€" ? "selected" : ""}>€ EUR</option>
            <option value="£" ${s.currency === "£" ? "selected" : ""}>£ GBP</option>
            <option value="CAD$" ${s.currency === "CAD$" ? "selected" : ""}>CAD$ CAD</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Invoice Defaults</h3>
      <p style="margin:0 0 12px; opacity:0.7; font-size:0.9em;">Default text used in generated invoices. Leave blank to use the built-in fallback text.</p>

      <div class="setting-row" style="align-items:flex-start;">
        <label style="padding-top:6px;">Description</label>
        <div class="setting-control" style="flex:1;">
          <textarea id="set-invoice-description" rows="3"
            placeholder="Provide temporary tankless gravity flushing sanitary waste assemblies. BrandSafway Part #M6474."
            style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; background:var(--card-bg); color:var(--text-color); font-size:0.9em; resize:vertical; font-family:inherit;"
          >${(s.invoiceDescription || '').replace(/</g, '&lt;')}</textarea>
        </div>
      </div>

      <div class="setting-row" style="align-items:flex-start; margin-top:12px;">
        <label style="padding-top:6px;">Terms &amp; Conditions</label>
        <div class="setting-control" style="flex:1;">
          <textarea id="set-invoice-terms" rows="5"
            placeholder="Enter your default invoice terms and conditions…"
            style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; background:var(--card-bg); color:var(--text-color); font-size:0.9em; resize:vertical; font-family:inherit;"
          >${(s.invoiceTerms || '').replace(/</g, '&lt;')}</textarea>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${t("settingsAbout")}</h3>
      <div style="text-align:center; margin-bottom:12px;">
        <img src="assets/cube-logo.png" alt="MonoStock" style="width:64px; height:64px; border-radius:14px;">
      </div>
      <p style="margin:0;">MonoStock v1.0.0</p>
      <p style="margin:4px 0 0; opacity:0.5; font-size:0.85em;">Web App Edition &middot; &copy; ${new Date().getFullYear()} Blaine Smith</p>
    </div>
  `;

  // Wire up all controls to save immediately on change
  const bind = (id, key, transform) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      const curr = getSettings();
      const val = transform ? transform(el) : (el.type === "checkbox" ? el.checked : el.value);
      setNestedValue(curr, key, val);
      saveSettings(curr);
      applySettings();
      // Re-render settings page to reflect language/currency changes
      if (key === "language" || key === "currency") {
        const existingNav = document.getElementById("nav");
        if (existingNav) existingNav.remove();
        renderSettingsPage();
      }
    });
  };

  bind("set-darkmode", "theme", (el) => el.checked ? "dark" : "light");
  bind("set-compact", "compact");
  bind("set-fontsize", "fontSize");
  bind("set-language", "language");
  bind("set-dateformat", "dateFormat");
  bind("set-navcollapse", "navCollapsed");
  bind("set-autoopen-exports", "autoOpenExports");
  bind("set-autoopen-invoices", "autoOpenInvoices");
  bind("set-rows-per-page", "rowsPerPage", (el) => parseInt(el.value));
  bind("set-currency", "currency");

  // Company name – save on input with debounce, update title immediately
  const companyNameInput = document.getElementById("set-company-name");
  if (companyNameInput) {
    let nameTimer;
    companyNameInput.addEventListener("input", () => {
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => {
        const curr = getSettings();
        curr.companyName = companyNameInput.value.trim();
        saveSettings(curr);
        updateAppTitle();
      }, 400);
    });
  }

  // Logo picker
  const btnPickLogo = document.getElementById("btn-pick-logo");
  if (btnPickLogo) {
    btnPickLogo.addEventListener("click", async () => {
      if (!window.dashboardAPI || !window.dashboardAPI.pickCompanyLogo) {
        showToast("Logo picker not available", "error");
        return;
      }
      const result = await window.dashboardAPI.pickCompanyLogo();
      if (result && result.success) {
        const curr = getSettings();
        curr.companyLogoPath = result.path;
        saveSettings(curr);
        showToast("Company logo updated", "success");
        renderSettingsPage();
      }
    });
  }

  // Logo clear
  const btnClearLogo = document.getElementById("btn-clear-logo");
  if (btnClearLogo) {
    btnClearLogo.addEventListener("click", () => {
      const curr = getSettings();
      delete curr.companyLogoPath;
      saveSettings(curr);
      showToast("Logo removed – using default", "info");
      renderSettingsPage();
    });
  }

  // Invoice description – debounced save
  const invoiceDescInput = document.getElementById("set-invoice-description");
  if (invoiceDescInput) {
    let descTimer;
    invoiceDescInput.addEventListener("input", () => {
      clearTimeout(descTimer);
      descTimer = setTimeout(() => {
        const curr = getSettings();
        curr.invoiceDescription = invoiceDescInput.value.trim();
        saveSettings(curr);
      }, 400);
    });
  }

  // Invoice terms – debounced save
  const invoiceTermsInput = document.getElementById("set-invoice-terms");
  if (invoiceTermsInput) {
    let termsTimer;
    invoiceTermsInput.addEventListener("input", () => {
      clearTimeout(termsTimer);
      termsTimer = setTimeout(() => {
        const curr = getSettings();
        curr.invoiceTerms = invoiceTermsInput.value.trim();
        saveSettings(curr);
      }, 400);
    });
  }

  // Dashboard card toggles
  ["pending", "status", "cost", "profit", "alerts"].forEach(card => {
    const cardKeyMap = {
      pending: "pendingOrders", status: "statusChart",
      cost: "costVsSell", profit: "customerProfit", alerts: "alerts"
    };
    const el = document.getElementById("set-card-" + card);
    if (!el) return;
    el.addEventListener("change", () => {
      const curr = getSettings();
      if (!curr.dashboardCards) curr.dashboardCards = {};
      curr.dashboardCards[cardKeyMap[card]] = el.checked;
      saveSettings(curr);
    });
  });

  // ── Business Mode toggle with safeguards ──
  const businessModeSelect = document.getElementById("set-business-mode");
  if (businessModeSelect) {
    businessModeSelect.addEventListener("change", async () => {
      const newMode = businessModeSelect.value;
      const currSettings = getSettings();
      const oldMode = currSettings.businessMode || "single";

      if (newMode === oldMode) return;

      if (newMode === "single") {
        const check = canSwitchToSingleMode();
        if (!check.allowed) {
          showToast(check.reason, "error", 6000);
          businessModeSelect.value = oldMode;
          return;
        }
      }

      const confirmMsg = newMode === "single"
        ? "Switch to Single-Product Mode? Orders will auto-assign the default product. No data will be deleted."
        : "Switch to Multi-Product Mode? You can define multiple products and assign them per order. No data will be deleted.";

      const confirmed = await showConfirm(confirmMsg, "Switch Mode");
      if (!confirmed) {
        businessModeSelect.value = oldMode;
        return;
      }

      currSettings.businessMode = newMode;
      saveSettings(currSettings);
      showToast(`Switched to ${newMode === "single" ? "Single" : "Multi"}-Product Mode`, "success");
      renderSettingsPage();
    });
  }

  // ── Products Manager ──
  renderProductsList();

  const addProductBtn = document.getElementById("add-product-btn");
  if (addProductBtn) {
    const mode = getBusinessMode();
    if (mode === "single" && (dashboardData.products || []).length >= 1) {
      addProductBtn.disabled = true;
      addProductBtn.title = "Single-Product Mode allows only 1 product";
    }

    addProductBtn.addEventListener("click", () => {
      const mode = getBusinessMode();
      if (mode === "single" && (dashboardData.products || []).length >= 1) {
        showToast("Single-Product Mode allows only 1 product. Switch to Multi-Product Mode to add more.", "warning");
        return;
      }
      dashboardData.products.push({
        id: crypto.randomUUID(),
        name: "",
        defaultPrice: 0
      });
      saveDashboard();
      renderProductsList();
    });
  }

  renderNav("settings");
}

function renderProductsList() {
  const container = document.getElementById("products-list");
  if (!container) return;

  const products = dashboardData.products || [];
  const mode = getBusinessMode();
  const cur = getCurrency();

  if (!products.length) {
    container.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.5; font-size:0.95em;">No products defined. Click "+ Add Product" to create one.</div>`;
    return;
  }

  let html = `<table style="width:100%; border-collapse: separate; border-spacing: 0; border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm);">
    <thead>
      <tr>
        <th style="text-align:left;">Product Name</th>
        <th style="text-align:right; width:160px;">Default Price (${cur})</th>
        <th style="text-align:center; width:80px;">Actions</th>
      </tr>
    </thead>
    <tbody>`;

  products.forEach((p, i) => {
    html += `
      <tr>
        <td>
          <input type="text" class="product-name" data-idx="${i}"
                 value="${(p.name || "").replace(/"/g, "&quot;")}"
                 placeholder="Product name…"
                 style="width:100%; padding:8px 12px; border:2px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--input-text);">
        </td>
        <td>
          <input type="number" class="product-price" data-idx="${i}"
                 value="${(p.defaultPrice || 0).toFixed(2)}" step="0.01" min="0"
                 style="width:100%; padding:8px 12px; border:2px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--input-text); text-align:right;">
        </td>
        <td style="text-align:center;">
          <button class="product-delete" data-idx="${i}" style="background:var(--danger-color); padding:6px 10px; font-size:0.85em;" title="Remove product">🗑️</button>
        </td>
      </tr>`;
  });

  html += `</tbody></table>`;

  if (mode === "single" && products.length >= 1) {
    html += `<p style="margin:10px 0 0; font-size:0.85em; opacity:0.6;">Single-Product Mode: Only 1 product allowed. Switch to Multi-Product Mode to add more.</p>`;
  }

  container.innerHTML = html;

  // Wire up editing
  container.querySelectorAll(".product-name").forEach(input => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.idx);
      dashboardData.products[idx].name = input.value.trim();
      saveDashboard();
    });
  });

  container.querySelectorAll(".product-price").forEach(input => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.idx);
      dashboardData.products[idx].defaultPrice = parseFloat(input.value) || 0;
      saveDashboard();
    });
  });

  container.querySelectorAll(".product-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx);
      const product = dashboardData.products[idx];
      const name = product.name || "this product";
      const confirmed = await showConfirm(`Remove product "${name}"? This will not affect existing orders.`, "Remove");
      if (confirmed) {
        dashboardData.products.splice(idx, 1);
        saveDashboard();
        renderProductsList();
        // Update Add Product button state
        const addBtn = document.getElementById("add-product-btn");
        if (addBtn) {
          const mode = getBusinessMode();
          addBtn.disabled = mode === "single" && dashboardData.products.length >= 1;
        }
      }
    });
  });
}

function setNestedValue(obj, key, val) {
  obj[key] = val;
}

// ---------------- BUSINESS MODE HELPERS ----------------
function getBusinessMode() {
  return getSettings().businessMode || "single";
}

function isMultiProductMode() {
  return getBusinessMode() === "multi";
}

function getDefaultProduct() {
  const products = dashboardData.products || [];
  return products.length > 0 ? products[0] : { id: "default", name: "Assembly", defaultPrice: 3000 };
}

function canSwitchToSingleMode() {
  const orders = dashboardData.orders || [];
  for (const order of orders) {
    if (Array.isArray(order.orderProducts) && order.orderProducts.length > 1) {
      return { allowed: false, reason: `Order ${order.orderNumber} has ${order.orderProducts.length} product lines. Edit orders to have 1 or fewer product lines before switching.` };
    }
  }
  if ((dashboardData.products || []).length > 1) {
    return { allowed: false, reason: `You have ${dashboardData.products.length} products defined. Remove extra products before switching to Single-Product Mode.` };
  }
  return { allowed: true };
}

// ---------------- DATE FORMATTER ----------------
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const fmt = getSettings().dateFormat || "en-US";
  if (fmt === "en-CA") {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (fmt === "en-GB") {
    const day = String(d.getDate()).padStart(2, "0");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    return `${day}/${m}/${y}`;
  }
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}


// ════════════════════════════════════════════════════════════
// AUTH PAGES — Login, Signup, Profile
// ════════════════════════════════════════════════════════════

function renderLoginPage() {
  if (!appDiv) return;
  window.currentPage = "login";

  // Hide nav, settings gear, user avatar, and menubar while on login
  const nav = document.getElementById("nav");
  if (nav) nav.style.display = "none";
  const menubar = document.getElementById("menubar");
  if (menubar) menubar.style.display = "none";
  settingsBtn.style.display = "none";
  userAvatarBtn.style.display = "none";
  document.body.style.paddingTop = "0";

  appDiv.innerHTML = `
    <div style="max-width:420px; margin:60px auto; padding:0 20px;">
      <div style="text-align:center; margin-bottom:36px;">
        <img src="assets/cube-logo.png" alt="MonoStock" style="width:90px; height:90px; border-radius:18px; margin-bottom:12px;">
        <h1 style="margin:0 0 6px;">MonoStock</h1>
        <p style="opacity:0.6; margin:0; font-size:0.95em;">Sign in to your account</p>
      </div>
      <div class="card" style="padding:30px;">
        <div id="login-error" style="display:none; padding:12px 16px; background:rgba(239,68,68,0.1);
          border:1px solid rgba(239,68,68,0.3); border-radius:10px; color:var(--danger-color);
          font-size:0.9em; margin-bottom:16px;"></div>
        <div class="form-group" style="margin-bottom:16px;">
          <label for="login-email">Email</label>
          <input type="email" id="login-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" placeholder="Your password" autocomplete="current-password">
        </div>
        <button id="login-submit-btn" style="width:100%; padding:14px; font-size:1em;">Sign In</button>
      </div>
      <p style="text-align:center; margin-top:20px; font-size:0.92em; opacity:0.75;">
        Don't have an account?
        <a href="#" id="goto-signup" style="color:var(--info-color); font-weight:600; text-decoration:none;">Create one</a>
      </p>
    </div>
  `;

  document.getElementById("goto-signup").onclick = (e) => { e.preventDefault(); renderSignupPage(); };
  document.getElementById("login-submit-btn").onclick = handleLogin;
  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  document.getElementById("login-email").focus();
}

async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errDiv = document.getElementById("login-error");
  const btn = document.getElementById("login-submit-btn");

  if (!email || !password) {
    errDiv.textContent = "Please enter your email and password.";
    errDiv.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Signing in…";
  errDiv.style.display = "none";

  try {
    const res = await window.dashboardAPI.authLogin(email, password);
    if (res.user) {
      currentUser = res.user;
      if (res.user.avatar) localStorage.setItem('userAvatar', res.user.avatar);
      else localStorage.removeItem('userAvatar');
      document.body.style.paddingTop = "";
      settingsBtn.style.display = "";
      const nav = document.getElementById("nav");
      if (nav) nav.style.display = "";
      const mb = document.getElementById("menubar");
      if (mb) mb.style.display = "";
      loadAndRenderDashboard();
    }
  } catch (err) {
    errDiv.textContent = err.message || "Login failed. Please try again.";
    errDiv.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

function renderSignupPage() {
  if (!appDiv) return;
  window.currentPage = "signup";

  // Hide nav, settings gear, user avatar, and menubar while on signup
  const nav = document.getElementById("nav");
  if (nav) nav.style.display = "none";
  const menubar = document.getElementById("menubar");
  if (menubar) menubar.style.display = "none";
  settingsBtn.style.display = "none";
  userAvatarBtn.style.display = "none";
  document.body.style.paddingTop = "0";

  appDiv.innerHTML = `
    <div style="max-width:420px; margin:60px auto; padding:0 20px;">
      <div style="text-align:center; margin-bottom:36px;">
        <img src="assets/cube-logo.png" alt="MonoStock" style="width:90px; height:90px; border-radius:18px; margin-bottom:12px;">
        <h1 style="margin:0 0 6px;">Create Account</h1>
        <p style="opacity:0.6; margin:0; font-size:0.95em;">Get started with MonoStock</p>
      </div>
      <div class="card" style="padding:30px;">
        <div id="signup-error" style="display:none; padding:12px 16px; background:rgba(239,68,68,0.1);
          border:1px solid rgba(239,68,68,0.3); border-radius:10px; color:var(--danger-color);
          font-size:0.9em; margin-bottom:16px;"></div>
        <div class="form-group" style="margin-bottom:16px;">
          <label for="signup-name">Full Name</label>
          <input type="text" id="signup-name" placeholder="Blaine Smith" autocomplete="name">
        </div>
        <div class="form-group" style="margin-bottom:16px;">
          <label for="signup-email">Email</label>
          <input type="email" id="signup-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-group" style="margin-bottom:16px;">
          <label for="signup-password">Password</label>
          <input type="password" id="signup-password" placeholder="Min 6 characters" autocomplete="new-password">
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label for="signup-confirm">Confirm Password</label>
          <input type="password" id="signup-confirm" placeholder="Re-enter password" autocomplete="new-password">
        </div>
        <button id="signup-submit-btn" style="width:100%; padding:14px; font-size:1em;">Create Account</button>
      </div>
      <p style="text-align:center; margin-top:20px; font-size:0.92em; opacity:0.75;">
        Already have an account?
        <a href="#" id="goto-login" style="color:var(--info-color); font-weight:600; text-decoration:none;">Sign in</a>
      </p>
    </div>
  `;

  document.getElementById("goto-login").onclick = (e) => { e.preventDefault(); renderLoginPage(); };
  document.getElementById("signup-submit-btn").onclick = handleSignup;
  document.getElementById("signup-confirm").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSignup();
  });
  document.getElementById("signup-name").focus();
}

async function handleSignup() {
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-confirm").value;
  const errDiv = document.getElementById("signup-error");
  const btn = document.getElementById("signup-submit-btn");

  if (!name) { errDiv.textContent = "Name is required."; errDiv.style.display = "block"; return; }
  if (!email) { errDiv.textContent = "Email is required."; errDiv.style.display = "block"; return; }
  if (password.length < 6) { errDiv.textContent = "Password must be at least 6 characters."; errDiv.style.display = "block"; return; }
  if (password !== confirm) { errDiv.textContent = "Passwords don't match."; errDiv.style.display = "block"; return; }

  btn.disabled = true;
  btn.textContent = "Creating account…";
  errDiv.style.display = "none";

  try {
    const res = await window.dashboardAPI.authRegister(name, email, password);
    if (res.user) {
      currentUser = res.user;
      document.body.style.paddingTop = "";
      settingsBtn.style.display = "";
      const nav = document.getElementById("nav");
      if (nav) nav.style.display = "";
      const mb = document.getElementById("menubar");
      if (mb) mb.style.display = "";
      showToast(`Welcome, ${res.user.name}!`, "success");
      loadAndRenderDashboard();
    }
  } catch (err) {
    errDiv.textContent = err.message || "Registration failed. Please try again.";
    errDiv.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

function renderProfilePage() {
  if (!appDiv || !currentUser) return;
  window.currentPage = "profile";

  const initials = currentUser.name
    ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const memberSince = currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString()
    : 'N/A';
  const avatar = currentUser.avatar || localStorage.getItem('userAvatar');
  const avatarInner = avatar
    ? `<img src="${avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
    : initials;

  appDiv.innerHTML = `
    <button class="back-arrow" id="profile-back-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back to Dashboard
    </button>

    <div class="page-header">
      <h1>My Profile</h1>
    </div>

    <!-- Profile Card -->
    <div class="settings-section" style="display:flex; align-items:center; gap:24px; flex-wrap:wrap;">
      <div id="profile-avatar-wrap" style="position:relative; width:80px; height:80px; flex-shrink:0; cursor:pointer;" title="Change profile picture">
        <div id="profile-avatar-circle" style="width:80px; height:80px; border-radius:50%; background:var(--button-bg);
          display:flex; align-items:center; justify-content:center; color:#fff;
          font-size:1.6em; font-weight:800; overflow:hidden;
          transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
          box-shadow:var(--shadow-md);">${avatarInner}</div>
        <div style="position:absolute; bottom:-2px; right:-2px; width:26px; height:26px;
          border-radius:50%; background:var(--card-bg); border:2px solid var(--border-color);
          display:flex; align-items:center; justify-content:center; font-size:12px;
          box-shadow:var(--shadow-sm); pointer-events:none;">&#9998;</div>
      </div>
      <div>
        <h3 style="margin:0 0 4px; -webkit-text-fill-color:unset; background:none; border:none; padding:0;
          color:var(--text-color); font-size:1.3em;">${currentUser.name}</h3>
        <p style="margin:0; opacity:0.6; font-size:0.92em;">${currentUser.email}</p>
        <p style="margin:4px 0 0; opacity:0.45; font-size:0.82em;">Member since ${memberSince}</p>
      </div>
    </div>

    <!-- Edit Profile -->
    <div class="settings-section">
      <h3>Edit Profile</h3>
      <div id="profile-msg" style="display:none; padding:12px 16px; border-radius:10px;
        font-size:0.9em; margin-bottom:16px;"></div>
      <div class="form-grid">
        <div class="form-group">
          <label for="profile-name">Full Name</label>
          <input type="text" id="profile-name" value="${currentUser.name || ''}">
        </div>
        <div class="form-group">
          <label for="profile-email">Email</label>
          <input type="email" id="profile-email" value="${currentUser.email || ''}">
        </div>
      </div>
      <div style="margin-top:16px;">
        <button id="profile-save-btn">Save Changes</button>
      </div>
    </div>

    <!-- Change Password -->
    <div class="settings-section">
      <h3>Change Password</h3>
      <div id="password-msg" style="display:none; padding:12px 16px; border-radius:10px;
        font-size:0.9em; margin-bottom:16px;"></div>
      <div class="form-grid">
        <div class="form-group">
          <label for="pw-current">Current Password</label>
          <input type="password" id="pw-current" autocomplete="current-password">
        </div>
        <div class="form-group">
          <label for="pw-new">New Password</label>
          <input type="password" id="pw-new" autocomplete="new-password" placeholder="Min 6 characters">
        </div>
        <div class="form-group">
          <label for="pw-confirm">Confirm New Password</label>
          <input type="password" id="pw-confirm" autocomplete="new-password">
        </div>
      </div>
      <div style="margin-top:16px;">
        <button id="pw-change-btn">Change Password</button>
      </div>
    </div>

    <!-- Sign Out -->
    <div class="settings-section" style="text-align:center;">
      <button id="profile-logout-btn" style="background:var(--danger-color); min-width:200px;">Sign Out</button>
    </div>
  `;

  // Avatar hover effect
  const avatarWrap = document.getElementById("profile-avatar-wrap");
  const avatarCircle = document.getElementById("profile-avatar-circle");
  avatarWrap.onmouseenter = () => { avatarCircle.style.transform = "scale(1.08)"; avatarCircle.style.boxShadow = "var(--shadow-lg)"; };
  avatarWrap.onmouseleave = () => { avatarCircle.style.transform = ""; avatarCircle.style.boxShadow = "var(--shadow-md)"; };
  avatarWrap.onclick = pickProfilePicture;

  document.getElementById("profile-back-btn").onclick = renderDashboard;
  document.getElementById("profile-save-btn").onclick = handleProfileSave;
  document.getElementById("pw-change-btn").onclick = handlePasswordChange;
  document.getElementById("profile-logout-btn").onclick = handleLogout;

  renderNav("profile");
  applySettings();
}

function pickProfilePicture() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.style.display = "none";
  document.body.appendChild(inp);

  inp.onchange = () => {
    const file = inp.files[0];
    inp.remove();
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Image must be under 2 MB", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      // Resize to 256x256 for storage efficiency
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const resized = canvas.toDataURL("image/jpeg", 0.85);

        try {
          const res = await window.dashboardAPI.authUpdateProfile({ avatar: resized });
          if (res.user) {
            currentUser = res.user;
            localStorage.setItem('userAvatar', resized);
            updateUserUI();
            renderProfilePage();
            showToast("Profile picture updated", "success");
          }
        } catch (err) {
          showToast(err.message || "Failed to update picture", "error");
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  inp.click();
}

async function handleProfileSave() {
  const name = document.getElementById("profile-name").value.trim();
  const email = document.getElementById("profile-email").value.trim();
  const msgDiv = document.getElementById("profile-msg");
  const btn = document.getElementById("profile-save-btn");

  if (!name) { showMsg(msgDiv, "Name is required.", true); return; }
  if (!email) { showMsg(msgDiv, "Email is required.", true); return; }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const res = await window.dashboardAPI.authUpdateProfile({ name, email });
    if (res.user) {
      currentUser = res.user;
      updateUserUI();
      showMsg(msgDiv, "Profile updated successfully!", false);
      showToast("Profile updated", "success");
    }
  } catch (err) {
    showMsg(msgDiv, err.message || "Failed to update profile.", true);
  }

  btn.disabled = false;
  btn.textContent = "Save Changes";
}

async function handlePasswordChange() {
  const current = document.getElementById("pw-current").value;
  const newPw = document.getElementById("pw-new").value;
  const confirm = document.getElementById("pw-confirm").value;
  const msgDiv = document.getElementById("password-msg");
  const btn = document.getElementById("pw-change-btn");

  if (!current) { showMsg(msgDiv, "Current password is required.", true); return; }
  if (newPw.length < 6) { showMsg(msgDiv, "New password must be at least 6 characters.", true); return; }
  if (newPw !== confirm) { showMsg(msgDiv, "New passwords don't match.", true); return; }

  btn.disabled = true;
  btn.textContent = "Changing…";

  try {
    await window.dashboardAPI.authChangePassword(current, newPw);
    showMsg(msgDiv, "Password changed successfully!", false);
    showToast("Password changed", "success");
    document.getElementById("pw-current").value = "";
    document.getElementById("pw-new").value = "";
    document.getElementById("pw-confirm").value = "";
  } catch (err) {
    showMsg(msgDiv, err.message || "Failed to change password.", true);
  }

  btn.disabled = false;
  btn.textContent = "Change Password";
}

async function handleLogout() {
  const confirmed = await showConfirm("Are you sure you want to sign out?", "Sign Out");
  if (!confirmed) return;
  window.dashboardAPI.authLogout();
  currentUser = null;
  localStorage.removeItem('userAvatar');
  updateUserUI();
  renderLoginPage();
}

function showMsg(el, text, isError) {
  el.textContent = text;
  el.style.display = "block";
  el.style.background = isError ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)";
  el.style.border = isError ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(16,185,129,0.3)";
  el.style.color = isError ? "var(--danger-color)" : "var(--success-color)";
}

// ---------------- NAVIGATION ----------------
function renderNav(currentPage) {
  const existingNav = document.getElementById("nav");
  const lang = getSettings().language || "en";
  const t = translations[lang] || translations.en;

  const pages = [
    { id: "dashboard", name: t.dashboard, fn: renderDashboard },
    { id: "orders", name: t.orders, fn: renderOrdersPage },
    { id: "customers", name: t.customers, fn: renderCustomersPage },
    { id: "inventory", name: t.inventory, fn: renderInventoryPage }
  ];

  // If nav exists, check if it needs updating (language change) or just active button change
  if (existingNav) {
    const buttons = existingNav.querySelectorAll("button");
    const needsRebuild = buttons[0] && buttons[0].innerText !== pages[0].name;

    if (needsRebuild) {
      existingNav.remove();
    } else {
      // Just update active button styling
      buttons.forEach((btn, i) => {
        if (pages[i] && pages[i].id === currentPage) {
          btn.style.background = "#08215a";
        } else {
          btn.style.background = "";
        }
      });
      return;
    }
  }

  // Create nav from scratch (first render only)
  const nav = document.createElement("div");
  nav.id = "nav";

  // Add the pill indicator for collapsed mode
  const pill = document.createElement("span");
  pill.className = "nav-pill";
  nav.appendChild(pill);

  pages.forEach(p => {
    const btn = document.createElement("button");
    btn.innerText = p.name;
    btn.onclick = p.fn;
    if (currentPage === p.id) btn.style.background = "#08215a";
    nav.appendChild(btn);
  });

  document.body.appendChild(nav);
}


// ---------------- Toast Notification System ----------------
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  const titles = { success: "Success", error: "Error", warning: "Warning", info: "Info" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.setProperty("--toast-duration", `${duration}ms`);
  toast.style.position = "relative";
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-body">
      <div class="toast-title">${titles[type] || titles.info}</div>
      <div class="toast-message">${message.replace(/\n/g, "<br>")}</div>
    </div>
    <div class="toast-progress"></div>
  `;

  toast.onclick = () => dismissToast(toast);
  container.appendChild(toast);

  const timer = setTimeout(() => dismissToast(toast), duration);
  toast._timer = timer;
}

function dismissToast(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._timer);
  toast.classList.add("toast-exit");
  setTimeout(() => toast.remove(), 300);
}

function showNotification(message) {
  showToast(message, "info", 4000);
}

// ---------------- Confirm Dialog ----------------
function showConfirm(message, confirmLabel = "Delete") {
  return new Promise(resolve => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="text-align:center; max-width: 420px;">
        <p style="font-size:1.05em; margin-bottom:24px;">${message}</p>
        <div class="modal-actions" style="justify-content:center;">
          <button class="confirm-cancel-btn" id="confirm-no">Cancel</button>
          <button class="confirm-delete-btn" id="confirm-yes">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    yesBtn.onclick = () => { modal.remove(); resolve(true); };
    noBtn.onclick = () => { modal.remove(); resolve(false); };
    modal.addEventListener("click", (e) => { if (e.target === modal) { modal.remove(); resolve(false); } });
    noBtn.focus();

    const escHandler = (e) => { if (e.key === "Escape") { modal.remove(); resolve(false); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
  });
}

// ---------------- Scroll-to-Top ----------------
(function setupScrollToTop() {
  const btn = document.getElementById("scroll-top-btn");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 300);
  });
  btn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
})();

// ---------------- Global Keyboard Shortcuts ----------------
document.addEventListener("keydown", (e) => {
  // Escape closes any open modal
  if (e.key === "Escape") {
    const modal = document.querySelector(".modal");
    if (modal) { modal.remove(); return; }
  }

  // Ctrl+N / Cmd+N - new order when on orders page
  if ((e.ctrlKey || e.metaKey) && e.key === "n" && window.currentPage === "orders") {
    e.preventDefault();
    showOrderForm();
  }

  // Ctrl+F / Cmd+F focuses the visible search input
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    const search = document.getElementById("orderSearch") || document.getElementById("customerSearch") || document.getElementById("inventorySearch");
    if (search) {
      e.preventDefault();
      search.focus();
      search.select();
    }
  }
});


// ---------------- DASHBOARD HELPERS ----------------
function getDashboardKPIs() {
  const orders = dashboardData.orders || [];
  const customers = dashboardData.customers || [];
  const inventory = dashboardData.inventory || [];

  const totalOrders = orders.length;
  const totalCustomers = customers.length;

  let totalRevenue = 0;
  let totalCost = 0;
  let ordersWithBudget = 0;
  let pendingCount = 0;
  let totalUnits = 0;

  orders.forEach(o => {
    if (o.budget && o.budget.total) {
      totalRevenue += o.budget.total || 0;
      totalCost += o.budget.cost || 0;
      ordersWithBudget++;
    }
    if ((o.status || "").toLowerCase().includes("pending")) pendingCount++;
    totalUnits += Number(o.quantity) || 0;
  });

  const avgOrderValue = ordersWithBudget > 0 ? totalRevenue / ordersWithBudget : 0;
  const totalProfit = totalRevenue - totalCost;
  const lowStockCount = inventory.filter(item => {
    const delta = (item.required || 0) - (item.inStock || 0);
    return delta > 0;
  }).length;

  return { totalOrders, totalCustomers, totalRevenue, totalCost, totalProfit, avgOrderValue, pendingCount, totalUnits, lowStockCount, ordersWithBudget };
}

// ---------------- DASHBOARD ----------------
function renderDashboard() {
  if (!appDiv) {
    console.error("Cannot render dashboard: appDiv not found");
    return;
  }
  
  window.currentPage = "dashboard";
  
  // Reset visible rows and collapse state when rendering dashboard
  tableVisibleRows.costVsSell = 10;
  tableVisibleRows.customerProfit = 10;
  tableCollapseState.costVsSell = false;
  tableCollapseState.customerProfit = false;
  innerTableCollapse.costVsSell = false;
  innerTableCollapse.customerProfit = false;

  const dc = getSettings().dashboardCards || {};
  const showPending  = dc.pendingOrders ?? true;
  const showStatus   = dc.statusChart ?? true;
  const showCost     = dc.costVsSell ?? true;
  const showProfit   = dc.customerProfit ?? true;
  const showAlerts   = dc.alerts ?? true;

  const kpis = getDashboardKPIs();
  const cur = getCurrency();
  const fmtK = (n) => {
    if (n >= 1000000) return cur + (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return cur + (n / 1000).toFixed(1) + "K";
    return cur + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const fmtKpi = (n) => cur + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  appDiv.innerHTML = `
    <h1>${getSettings().companyName ? `MonoStock - ${getSettings().companyName}` : t("welcomeTitle")}</h1>

    <div class="kpi-grid">
      <div class="kpi-card kpi-orders" data-nav="orders">
        <div class="kpi-icon">📦</div>
        <div class="kpi-label">${t("kpiTotalOrders")}</div>
        <div class="kpi-value">${kpis.totalOrders}</div>
        <div class="kpi-sub">${kpis.totalUnits} ${t("kpiTotalUnits")}</div>
      </div>
      <div class="kpi-card kpi-revenue" data-nav="orders">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">${t("kpiTotalRevenue")}</div>
        <div class="kpi-value">${fmtK(kpis.totalRevenue)}</div>
        <div class="kpi-sub">${kpis.ordersWithBudget} ${t("kpiOrdersWithBudgets")}</div>
      </div>
      <div class="kpi-card kpi-profit" data-nav="orders">
        <div class="kpi-icon">📈</div>
        <div class="kpi-label">${t("kpiTotalProfit")}</div>
        <div class="kpi-value" style="color: ${kpis.totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">${fmtK(kpis.totalProfit)}</div>
        <div class="kpi-sub">${kpis.totalRevenue > 0 ? ((kpis.totalProfit / kpis.totalRevenue) * 100).toFixed(1) : "0.0"}% ${t("kpiMargin")}</div>
      </div>
      <div class="kpi-card kpi-customers" data-nav="customers">
        <div class="kpi-icon">👥</div>
        <div class="kpi-label">${t("kpiCustomers")}</div>
        <div class="kpi-value">${kpis.totalCustomers}</div>
        <div class="kpi-sub">${t("kpiActiveAccounts")}</div>
      </div>
      <div class="kpi-card kpi-avg" data-nav="orders">
        <div class="kpi-icon">⊘</div>
        <div class="kpi-label">${t("kpiAvgOrder")}</div>
        <div class="kpi-value">${fmtK(kpis.avgOrderValue)}</div>
        <div class="kpi-sub">${t("kpiPerBudgetedOrder")}</div>
      </div>
      <div class="kpi-card kpi-pending" data-nav="inventory">
        <div class="kpi-icon">⏳</div>
        <div class="kpi-label">${t("kpiNeedsAttention")}</div>
        <div class="kpi-value">${kpis.pendingCount}${kpis.lowStockCount > 0 ? ` │ ${kpis.lowStockCount}` : ""}</div>
        <div class="kpi-sub">${t("kpiPendingOrders")}${kpis.lowStockCount > 0 ? ` │ ${t("kpiLowStockItems")}` : ""}</div>
      </div>
    </div>
    
    ${showPending ? `<div class="card">
      <h2>${t("pendingOrdersTitle")}</h2>
      <table id="summary-table">
        <thead><tr><th>${t("thOrder")}</th><th>${t("thCustomer")}</th><th>${t("thCompany")}</th><th>${t("thUnits")}</th><th>${t("thStatus")}</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>` : ""}

    ${showStatus ? `<div class="card">
      <h2>${t("orderStatusChart")}</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 30px; align-items: flex-start;">
        <div style="flex: 1; min-width: 280px; max-width: 500px; padding: 20px;">
          <canvas id="statusPieChart"></canvas>
        </div>
        <div style="flex: 1; min-width: 280px; max-width: 600px; padding: 20px;">
          <h3 style="margin-top:0;">${t("revenueOverTime")}</h3>
          <canvas id="revenueLineChart"></canvas>
        </div>
      </div>
      <div id="orderList" style="margin-top: 24px;"></div>
    </div>` : ""}
    
    ${showCost ? `<div class="card">
      <h2 class="card-collapse-header${tableCollapseState.costVsSell ? ' collapsed' : ''}" onclick="toggleTableCollapse('costVsSell')"><span class="collapse-icon">▼</span>${t("costVsSellTitle")}</h2>
      <div class="card-body" id="cardBody-costVsSell" style="display: ${tableCollapseState.costVsSell ? 'none' : 'block'};">
        <div style="max-width: 700px; margin: 0 auto;">
          <canvas id="costVsSellChart"></canvas>
        </div>
        <div id="costVsSellTable" style="margin-top: 20px;"></div>
      </div>
    </div>` : ""}

    ${showProfit ? `<div class="card">
      <h2 class="card-collapse-header${tableCollapseState.customerProfit ? ' collapsed' : ''}" onclick="toggleTableCollapse('customerProfit')"><span class="collapse-icon">▼</span>${t("customerProfitTitle")}</h2>
      <div class="card-body" id="cardBody-customerProfit" style="display: ${tableCollapseState.customerProfit ? 'none' : 'block'};">
        <div id="customerProfitTable"></div>
      </div>
    </div>` : ""}

    ${showAlerts ? `<div class="card">
      <h2>${t("alertsTitle")}</h2>
      <ul id="alerts"></ul>
    </div>` : ""}
  `;

  // KPI card click navigation
  const navMap = { orders: renderOrdersPage, customers: renderCustomersPage, inventory: renderInventoryPage };
  document.querySelectorAll(".kpi-card[data-nav]").forEach(card => {
    card.addEventListener("click", () => {
      const fn = navMap[card.dataset.nav];
      if (fn) fn();
    });
  });

  // 1. Fill pending orders table + alerts
  const tbody = document.querySelector("#summary-table tbody");
  const alertsEl = document.getElementById("alerts");

  const pendingOrders = dashboardData.orders.filter(o => (o.status || "").toLowerCase().includes("pending"));

  if (tbody) {
    if (!pendingOrders.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; opacity:0.5; padding:30px;">No pending orders</td></tr>`;
    } else {
      pendingOrders.forEach(o => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="color: var(--info-color); font-weight: bold; cursor:pointer;" 
              onclick="openBudget(${dashboardData.orders.indexOf(o)})">
            ${o.orderNumber || "—"}
          </td>
          <td>${o.customerName || "—"}</td>
          <td>${o.customerCompany || "—"}</td>
          <td style="text-align:center; font-weight:600;">${o.quantity || 0}</td>
          <td><span style="padding:4px 10px; background:var(--warning-color); color:white; border-radius:12px; font-size:0.85em; font-weight:600;">${o.status || "—"}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  if (alertsEl) {
    let alertHTML = "";

    pendingOrders.forEach(o => {
      alertHTML += `<li style="border-left-color: var(--warning-color);">${t("orderLabel")} <strong>${o.orderNumber || "—"}</strong> ${t("alertIsPending")}</li>`;
    });

    dashboardData.orders
      .filter(o => (o.status || "").toLowerCase().includes("maintenance"))
      .forEach(o => {
        alertHTML += `<li style="border-left-color: var(--danger-color);">${t("orderLabel")} <strong>${o.orderNumber || "—"}</strong> ${t("alertRequiresMaintenance")}</li>`;
      });

    // Low stock inventory alerts
    (dashboardData.inventory || []).forEach(item => {
      const delta = (item.required || 0) - (item.inStock || 0);
      if (delta > 0 && item.material) {
        alertHTML += `<li style="border-left-color: var(--danger-color);"><strong>${item.material}</strong>: ${delta} ${t("alertUnitsShort")} (${t("alertNeed")} ${item.required}, ${t("alertHave")} ${item.inStock})</li>`;
      }
    });

    // Orders without budgets
    const noBudget = dashboardData.orders.filter(o => !o.budget && (o.status || "").toLowerCase() !== "paid in full");
    if (noBudget.length > 0) {
      alertHTML += `<li style="border-left-color: var(--info-color);"><strong>${noBudget.length}</strong> ${noBudget.length > 1 ? t("alertWithoutBudgetPlural") : t("alertWithoutBudget")}</li>`;
    }

    alertsEl.innerHTML = alertHTML || `<li>${t("alertNoAlerts")}</li>`;
  }

  // 2. Render the charts AFTER canvas exists in DOM
  if (showStatus) {
    renderStatusPieChart();
    renderRevenueLineChart();
  }
  if (showCost)    renderCostVsSellChart();
  if (showProfit)  renderCustomerProfitability();

  renderNav("dashboard");
}

// ---------------- REVENUE LINE CHART ----------------
function renderRevenueLineChart() {
  const ctx = document.getElementById("revenueLineChart")?.getContext("2d");
  if (!ctx) return;

  if (window.revenueLineChartInstance instanceof Chart) {
    window.revenueLineChartInstance.destroy();
  }

  const orders = (dashboardData.orders || []).filter(o => o.budget && o.budget.total && o.dateTime);

  if (!orders.length) {
    ctx.canvas.parentElement.innerHTML = "<p style='opacity:0.5; text-align:center; padding:40px 0;'>No revenue data yet.</p>";
    return;
  }

  // Group revenue by month
  const monthMap = {};
  orders.forEach(o => {
    const d = new Date(o.dateTime);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, cost: 0 };
    monthMap[key].revenue += o.budget.total || 0;
    monthMap[key].cost += o.budget.cost || 0;
  });

  const sortedKeys = Object.keys(monthMap).sort();
  const labels = sortedKeys.map(k => {
    const [y, m] = k.split("-");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${monthNames[parseInt(m) - 1]} ${y}`;
  });

  // Cumulative revenue and profit
  let cumRevenue = 0, cumProfit = 0;
  const revenueData = [];
  const profitData = [];

  sortedKeys.forEach(k => {
    cumRevenue += monthMap[k].revenue;
    cumProfit += (monthMap[k].revenue - monthMap[k].cost);
    revenueData.push(cumRevenue);
    profitData.push(cumProfit);
  });

  const cur = getCurrency();
  const fmtD = (n) => cur + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  window.revenueLineChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: t("cumulativeRevenue"),
          data: revenueData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 8,
          borderWidth: 3
        },
        {
          label: t("cumulativeProfit"),
          data: profitData,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 8,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 15, font: { size: 12, weight: "600" }, usePointStyle: true, pointStyle: "circle" }
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: { label: (tip) => `${tip.dataset.label}: ${fmtD(tip.parsed.y)}` }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { callback: (v) => cur + v.toLocaleString(), font: { size: 11 } }
        },
        x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } }
      }
    }
  });
}

// ---------------- PIE CHART ----------------
function renderStatusPieChart() {
  const orders = dashboardData.orders || [];

  // Count total UNITS per status
  const statusCounts = {
    "Undefined": 0,
    "Sold": 0,
    "In production": 0,
    "Shipped": 0,
    "Paid in Full": 0,
    "Pending": 0,
  };

  orders.forEach(o => {
    const status = (o.status || "Undefined").trim();
    if (status in statusCounts) {
      statusCounts[status] += Number(o.quantity) || 1;
    } else {
      // Optional: catch unknown statuses
      statusCounts["In production"] += Number(o.quantity) || 1;
    }
  });

  const totalUnits = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const ctx = document.getElementById("statusPieChart")?.getContext("2d");
  if (!ctx) {
    console.warn("Canvas element not found!");
    return;
  }

  // Destroy previous chart instance if exists
  if (window.statusPieChart instanceof Chart) {
    window.statusPieChart.destroy();
  }

  window.statusPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          "rgba(148, 163, 184, 0.85)",     // Undefined
          "rgba(16, 185, 129, 0.85)",      // Sold
          "rgba(239, 68, 68, 0.85)",       // In production
          "rgba(59, 130, 246, 0.85)",      // Shipped
          "rgba(139, 92, 246, 0.85)",      // Paid in Full
          "rgba(245, 158, 11, 0.85)"       // Pending
        ],
        borderWidth: 3,
        borderColor: "#fff",
        hoverBorderWidth: 4,
        hoverBorderColor: "#fff",
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 20,
            font: { size: 13, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 12,
            boxHeight: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const label = context.label || "";
              const value = context.parsed || 0;
              const percentage = totalUnits > 0 
                ? ((value / totalUnits) * 100).toFixed(1) 
                : 0;
              return `${label}: ${value} units (${percentage}%)`;
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (!elements.length) return;
        const sliceIndex = elements[0].index;
        const clickedLabel = window.statusPieChart.data.labels[sliceIndex];
        if (clickedLabel) renderOrderList(clickedLabel.trim());
      }
    }
  });
}

// ---------------- SHOW ORDERS FOR SLICE ----------------
function renderOrderList(selectedStatus) {
  const orderListDiv = document.getElementById("orderList");
  if (!orderListDiv) return;

  const filtered = (dashboardData.orders || []).filter(
    o => (o.status || "Undefined").trim() === selectedStatus
  );

  orderListDiv.innerHTML = `<h3>Orders: ${selectedStatus}</h3>`;

  if (!filtered.length) {
    orderListDiv.innerHTML += `<p>No orders found in "${selectedStatus}"</p>`;
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Order #</th>
        <th>Customer</th>
        <th>Units</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  orderListDiv.appendChild(table);

  const tbody = table.querySelector("tbody");

  filtered.forEach(o => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td style="color: var(--info-color); cursor:pointer; font-weight:600;" onclick="openBudget(${dashboardData.orders.indexOf(o)})">
        ${o.orderNumber || "—"}
      </td>
      <td>${o.customerName || "—"}</td>
      <td>${o.quantity || 0}</td>
      <td>
        <select data-order="${o.orderNumber}">
          <option value="Undefined" ${o.status === "Undefined" ? "selected" : ""}>Undefined</option>
          <option value="Sold" ${o.status === "Sold" ? "selected" : ""}>Sold</option>
          <option value="In production" ${o.status === "In production" ? "selected" : ""}>In production</option>
          <option value="Shipped" ${o.status === "Shipped" ? "selected" : ""}>Shipped</option>
          <option value="Paid in Full" ${o.status === "Paid in Full" ? "selected" : ""}>Paid in Full</option>
          <option value="Pending" ${o.status === "Pending" ? "selected" : ""}>Pending</option>
        </select>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Add live change listener to update order status and refresh chart
  tbody.querySelectorAll("select").forEach(sel => {
    sel.addEventListener("change", () => {
      const orderNum = sel.dataset.order;
      const order = dashboardData.orders.find(o => o.orderNumber === orderNum);
      if (!order) return;

      order.status = sel.value;   // Update status
      saveDashboard();            // Persist changes
      renderStatusPieChart();     // Refresh pie chart
    });
  });
}


// ---------------- COST VS SELL PRICE CHART ----------------
function renderCostVsSellChart() {
  const orders = (dashboardData.orders || []).filter(o => o.budget && o.budget.total);
  const cur = getCurrency();
  const fmtD = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ctx = document.getElementById("costVsSellChart")?.getContext("2d");
  if (!ctx) return;

  if (window.costVsSellChartInstance instanceof Chart) {
    window.costVsSellChartInstance.destroy();
  }

  if (!orders.length) {
    const tableDiv = document.getElementById("costVsSellTable");
    if (tableDiv) tableDiv.innerHTML = `<p>${t("noBudgetsYet")}</p>`;
    return;
  }

  const labels = orders.map(o => o.orderNumber || "N/A");
  const sellData = orders.map(o => o.budget.total || 0);
  const costData = orders.map(o => o.budget.cost || 0);

  window.costVsSellChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: t("thSellPrice"), data: sellData, backgroundColor: "rgba(16, 185, 129, 0.8)", borderColor: "#10b981", borderWidth: 2, borderRadius: 8 },
        { label: t("thCost"), data: costData, backgroundColor: "rgba(239, 68, 68, 0.8)", borderColor: "#ef4444", borderWidth: 2, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "top",
          labels: {
            padding: 15,
            font: { size: 13, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          cornerRadius: 8,
          callbacks: { label: (tip) => `${tip.dataset.label}: ${cur}${fmtD(tip.parsed.y)}` }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            callback: (v) => cur + v.toLocaleString(),
            font: { size: 12 }
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 } }
        }
      }
    }
  });

  // --- Table ---
  const tableDiv = document.getElementById("costVsSellTable");
  if (!tableDiv) return;

  // Sort orders for the table
  const sortedOrders = [...orders];
  if (costVsSellSortCol) {
    sortedOrders.sort((a, b) => {
      let aVal, bVal;
      const aProfit = (a.budget.total || 0) - (a.budget.cost || 0);
      const bProfit = (b.budget.total || 0) - (b.budget.cost || 0);
      const aMargin = (a.budget.total || 0) > 0 ? aProfit / (a.budget.total || 1) : 0;
      const bMargin = (b.budget.total || 0) > 0 ? bProfit / (b.budget.total || 1) : 0;

      if (costVsSellSortCol === "orderNumber") { aVal = (a.orderNumber || "").toLowerCase(); bVal = (b.orderNumber || "").toLowerCase(); }
      else if (costVsSellSortCol === "customerName") { aVal = (a.customerName || "").toLowerCase(); bVal = (b.customerName || "").toLowerCase(); }
      else if (costVsSellSortCol === "quantity") { aVal = Number(a.quantity) || 0; bVal = Number(b.quantity) || 0; }
      else if (costVsSellSortCol === "sell") { aVal = a.budget.total || 0; bVal = b.budget.total || 0; }
      else if (costVsSellSortCol === "cost") { aVal = a.budget.cost || 0; bVal = b.budget.cost || 0; }
      else if (costVsSellSortCol === "profit") { aVal = aProfit; bVal = bProfit; }
      else if (costVsSellSortCol === "margin") { aVal = aMargin; bVal = bMargin; }

      if (aVal < bVal) return costVsSellSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return costVsSellSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  let totalSell = 0, totalCost = 0;
  const visibleCount = tableVisibleRows.costVsSell;
  const hasMore = sortedOrders.length > visibleCount;

  function cvsSortClass(col) {
    if (costVsSellSortCol !== col) return "sortable";
    return "sortable " + (costVsSellSortDir === "asc" ? "sort-asc" : "sort-desc");
  }

  const innerCollapsed = innerTableCollapse.costVsSell;
  let html = `<div class="inner-table-wrap" id="innerWrap-costVsSell">
  <div class="inner-table-header${innerCollapsed ? ' collapsed' : ''}" onclick="toggleInnerTable('costVsSell')"><span class="collapse-icon">▼</span> ${t("costVsSellTitle")}</div>
  <table id="costVsSellTableElement" style="display: ${innerCollapsed ? 'none' : 'table'};"><thead><tr>
    <th class="${cvsSortClass('orderNumber')}" data-table="costVsSell" data-col="orderNumber">${t("thOrder")} #</th>
    <th class="${cvsSortClass('customerName')}" data-table="costVsSell" data-col="customerName">${t("thCustomer")}</th>
    <th class="${cvsSortClass('quantity')}" data-table="costVsSell" data-col="quantity">${t("thQty")}</th>
    <th class="${cvsSortClass('sell')}" data-table="costVsSell" data-col="sell" style="text-align:right;">${t("thSellPrice")}</th>
    <th class="${cvsSortClass('cost')}" data-table="costVsSell" data-col="cost" style="text-align:right;">${t("thCost")}</th>
    <th class="${cvsSortClass('profit')}" data-table="costVsSell" data-col="profit" style="text-align:right;">${t("thProfit")}</th>
    <th class="${cvsSortClass('margin')}" data-table="costVsSell" data-col="margin" style="text-align:right;">${t("thMargin")}</th>
  </tr></thead><tbody id="costVsSellTableBody">`;

  sortedOrders.slice(0, visibleCount).forEach(o => {
    const sell = o.budget.total || 0;
    const cost = o.budget.cost || 0;
    totalSell += sell;
    totalCost += cost;
    const profit = sell - cost;
    const margin = sell > 0 ? ((profit / sell) * 100).toFixed(1) + "%" : "0.0%";
    const profitColor = profit >= 0 ? "var(--success-color)" : "var(--danger-color)";

    html += `<tr>
      <td>${o.orderNumber || "—"}</td>
      <td>${o.customerName || "—"}</td>
      <td style="text-align:center;">${o.quantity || "—"}</td>
      <td style="text-align:right;">${cur}${fmtD(sell)}</td>
      <td style="text-align:right;">${cur}${fmtD(cost)}</td>
      <td style="text-align:right; color:${profitColor}; font-weight:bold;">${cur}${fmtD(profit)}</td>
      <td style="text-align:right;">${margin}</td>
    </tr>`;
  });

  if (hasMore) {
    html += `<tr class="show-more-row" onclick="showMoreRows('costVsSell')">
      <td colspan="7" style="text-align:center;">
        ▼ Show More (${Math.min(10, sortedOrders.length - visibleCount)} more orders)
      </td>
    </tr>`;
  }

  let allTotalSell = 0, allTotalCost = 0;
  orders.forEach(o => {
    allTotalSell += o.budget.total || 0;
    allTotalCost += o.budget.cost || 0;
  });

  const totalProfit = allTotalSell - allTotalCost;
  const totalMargin = allTotalSell > 0 ? ((totalProfit / allTotalSell) * 100).toFixed(1) + "%" : "0.0%";
  const totalProfitColor = totalProfit >= 0 ? "var(--success-color)" : "var(--danger-color)";

  html += `<tr style="font-weight:bold; background: var(--row-even-bg); border-top: 3px solid var(--accent-color);">
    <td colspan="3">${t("totals")}</td>
    <td style="text-align:right;">${cur}${fmtD(allTotalSell)}</td>
    <td style="text-align:right;">${cur}${fmtD(allTotalCost)}</td>
    <td style="text-align:right; color:${totalProfitColor}; font-size:1.1em;">${cur}${fmtD(totalProfit)}</td>
    <td style="text-align:right;">${totalMargin}</td>
  </tr></tbody></table></div>`;

  tableDiv.innerHTML = html;

  // Wire up sortable headers
  tableDiv.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (costVsSellSortCol === col) {
        if (costVsSellSortDir === "asc") { costVsSellSortDir = "desc"; }
        else { costVsSellSortCol = null; costVsSellSortDir = "asc"; }
      } else {
        costVsSellSortCol = col;
        costVsSellSortDir = "asc";
      }
      renderCostVsSellChart();
    });
  });
}


// ---------------- CUSTOMER PROFITABILITY RANKING ----------------
function renderCustomerProfitability() {
  const tableDiv = document.getElementById("customerProfitTable");
  if (!tableDiv) return;

  const cur = getCurrency();
  const fmtD = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const orders = (dashboardData.orders || []).filter(o => o.budget && o.budget.total);

  if (!orders.length) {
    tableDiv.innerHTML = `<p>${t("noBudgetsYet")}</p>`;
    return;
  }

  const customerMap = {};
  orders.forEach(o => {
    const name = o.customerName || "Unknown";
    if (!customerMap[name]) {
      customerMap[name] = { customer: name, company: o.customerCompany || "", revenue: 0, cost: 0, orders: 0 };
    }
    customerMap[name].revenue += (o.budget.total || 0);
    customerMap[name].cost += (o.budget.cost || 0);
    customerMap[name].orders += 1;
  });

  // Default sort: by profit descending
  const ranked = Object.values(customerMap);

  if (customerProfitSortCol) {
    ranked.sort((a, b) => {
      let aVal, bVal;
      const aProfit = a.revenue - a.cost;
      const bProfit = b.revenue - b.cost;
      const aMargin = a.revenue > 0 ? aProfit / a.revenue : 0;
      const bMargin = b.revenue > 0 ? bProfit / b.revenue : 0;

      if (customerProfitSortCol === "customer") { aVal = a.customer.toLowerCase(); bVal = b.customer.toLowerCase(); }
      else if (customerProfitSortCol === "company") { aVal = (a.company || "").toLowerCase(); bVal = (b.company || "").toLowerCase(); }
      else if (customerProfitSortCol === "orders") { aVal = a.orders; bVal = b.orders; }
      else if (customerProfitSortCol === "revenue") { aVal = a.revenue; bVal = b.revenue; }
      else if (customerProfitSortCol === "cost") { aVal = a.cost; bVal = b.cost; }
      else if (customerProfitSortCol === "profit") { aVal = aProfit; bVal = bProfit; }
      else if (customerProfitSortCol === "margin") { aVal = aMargin; bVal = bMargin; }

      if (aVal < bVal) return customerProfitSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return customerProfitSortDir === "asc" ? 1 : -1;
      return 0;
    });
  } else {
    // Default: highest profit first
    ranked.sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));
  }

  const visibleCount = tableVisibleRows.customerProfit;
  const hasMore = ranked.length > visibleCount;

  function cpSortClass(col) {
    if (customerProfitSortCol !== col) return "sortable";
    return "sortable " + (customerProfitSortDir === "asc" ? "sort-asc" : "sort-desc");
  }

  const innerCollapsed = innerTableCollapse.customerProfit;
  let html = `<div class="inner-table-wrap" id="innerWrap-customerProfit">
  <div class="inner-table-header${innerCollapsed ? ' collapsed' : ''}" onclick="toggleInnerTable('customerProfit')"><span class="collapse-icon">▼</span> ${t("customerProfitTitle")}</div>
  <table id="customerProfitTableElement" style="display: ${innerCollapsed ? 'none' : 'table'};"><thead><tr>
    <th>${t("thRank")}</th>
    <th class="${cpSortClass('customer')}" data-table="customerProfit" data-col="customer">${t("thCustomer")}</th>
    <th class="${cpSortClass('company')}" data-table="customerProfit" data-col="company">${t("thCompany")}</th>
    <th class="${cpSortClass('orders')}" data-table="customerProfit" data-col="orders" style="text-align:center;">${t("thOrders")}</th>
    <th class="${cpSortClass('revenue')}" data-table="customerProfit" data-col="revenue" style="text-align:right;">${t("thTotalRevenue")}</th>
    <th class="${cpSortClass('cost')}" data-table="customerProfit" data-col="cost" style="text-align:right;">${t("thTotalCost")}</th>
    <th class="${cpSortClass('profit')}" data-table="customerProfit" data-col="profit" style="text-align:right;">${t("thTotalProfit")}</th>
    <th class="${cpSortClass('margin')}" data-table="customerProfit" data-col="margin" style="text-align:right;">${t("thMargin")}</th>
  </tr></thead><tbody id="customerProfitTableBody">`;

  ranked.slice(0, visibleCount).forEach((c, i) => {
    const profit = c.revenue - c.cost;
    const margin = c.revenue > 0 ? ((profit / c.revenue) * 100).toFixed(1) + "%" : "0.0%";
    const profitColor = profit >= 0 ? "var(--success-color)" : "var(--danger-color)";
    const rankBadge = i < 3 ? `<span style="display:inline-block; background:linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color:white; padding:4px 10px; border-radius:20px; font-size:0.85em;">★</span>` : '';

    html += `<tr>
      <td style="text-align:center; font-weight:bold;">${i + 1} ${rankBadge}</td>
      <td>${c.customer}</td>
      <td>${c.company}</td>
      <td style="text-align:center;">${c.orders}</td>
      <td style="text-align:right;">${cur}${fmtD(c.revenue)}</td>
      <td style="text-align:right;">${cur}${fmtD(c.cost)}</td>
      <td style="text-align:right; color:${profitColor}; font-weight:bold;">${cur}${fmtD(profit)}</td>
      <td style="text-align:right;">${margin}</td>
    </tr>`;
  });

  // Add "Show More" button row if there are more customers
  if (hasMore) {
    html += `<tr class="show-more-row" onclick="showMoreRows('customerProfit')">
      <td colspan="8" style="text-align:center;">
        ▼ Show More (${Math.min(10, ranked.length - visibleCount)} more customers)
      </td>
    </tr>`;
  }

  html += `</tbody></table></div>`;
  tableDiv.innerHTML = html;

  // Wire up sortable headers
  tableDiv.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (customerProfitSortCol === col) {
        if (customerProfitSortDir === "asc") { customerProfitSortDir = "desc"; }
        else { customerProfitSortCol = null; customerProfitSortDir = "asc"; }
      } else {
        customerProfitSortCol = col;
        customerProfitSortDir = "asc";
      }
      renderCustomerProfitability();
    });
  });
}


// ---------------- ORDER FOLDERS & TRASH SYSTEM ----------------

function getOrdersInFolder(folderId) {
  const own = dashboardData.orders.filter(o => o.folderId === folderId);
  if (own.length > 0) return own;
  const shared = (dashboardData.sharedOrders || []).filter(o => o.folderId === folderId);
  return shared.length > 0 ? shared : own;
}

function getFolderById(folderId) {
  return dashboardData.orderFolders.find(f => f.id === folderId)
    || (dashboardData.sharedFolders || []).find(f => f.id === folderId);
}

function getSharedFolderRole(folderId) {
  const sf = (dashboardData.sharedFolders || []).find(f => f.id === folderId);
  return sf ? sf._role : null;
}

function isFolderSharedWithMe(folderId) {
  return (dashboardData.sharedFolders || []).some(f => f.id === folderId);
}

function isMyFolder(folderId) {
  return dashboardData.orderFolders.some(f => f.id === folderId);
}

function getTrashCount() {
  const trash = dashboardData.trash || [];
  const trashedFolderIds = new Set(
    trash.filter(t => t.type === "folder").map(t => t.data.id)
  );
  return trash.filter(item => {
    if (item.type === "order" && item.originalFolderId && trashedFolderIds.has(item.originalFolderId)) {
      return false;
    }
    return true;
  }).length;
}

function moveToTrash(type, data, extraInfo = {}) {
  if (!Array.isArray(dashboardData.trash)) dashboardData.trash = [];
  dashboardData.trash.push({
    id: crypto.randomUUID(),
    type: type,
    data: JSON.parse(JSON.stringify(data)),
    deletedAt: Date.now(),
    ...extraInfo
  });
}

function showFolderNamePrompt(title, defaultName = "") {
  return new Promise(resolve => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 420px;">
        <h3>${title}</h3>
        <input id="folder-name-input" type="text" value="${defaultName.replace(/"/g, '&quot;')}" placeholder="Folder name…" autofocus>
        <div class="modal-actions">
          <button class="confirm-cancel-btn" id="folder-cancel">Cancel</button>
          <button id="folder-confirm" style="background: var(--success-color);">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById("folder-name-input");
    const confirmBtn = document.getElementById("folder-confirm");
    const cancelBtn = document.getElementById("folder-cancel");

    input.focus();
    input.select();

    const doConfirm = () => {
      const name = input.value.trim();
      modal.remove();
      resolve(name || null);
    };

    confirmBtn.onclick = doConfirm;
    input.addEventListener("keydown", e => { if (e.key === "Enter") doConfirm(); });
    cancelBtn.onclick = () => { modal.remove(); resolve(null); };
    modal.addEventListener("click", e => { if (e.target === modal) { modal.remove(); resolve(null); } });
  });
}

function showFolderPickerForImport(fileName) {
  return new Promise(resolve => {
    const folders = dashboardData.orderFolders || [];
    const modal = document.createElement("div");
    modal.className = "modal";

    const folderOptions = folders.map(f =>
      `<option value="${f.id}">${f.name} (${getOrdersInFolder(f.id).length} orders)</option>`
    ).join("");

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 480px;">
        <h3>Import Orders</h3>
        <p style="opacity:0.7; margin-bottom:16px;">Choose where to place orders from <strong>${fileName}</strong>:</p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <label>
            <input type="radio" name="import-dest" value="new" checked style="width:auto; margin-right:8px;">
            Create new folder
          </label>
          <input id="import-new-folder-name" type="text" placeholder="New folder name…" value="${fileName.replace(/\.\w+$/, '')}">
          ${folders.length ? `
            <label>
              <input type="radio" name="import-dest" value="existing" style="width:auto; margin-right:8px;">
              Add to existing folder
            </label>
            <select id="import-existing-folder" disabled>
              ${folderOptions}
            </select>
          ` : ''}
        </div>
        <div class="modal-actions" style="margin-top:20px;">
          <button class="confirm-cancel-btn" id="import-cancel">Cancel</button>
          <button id="import-confirm" style="background: var(--success-color);">Import</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const radios = modal.querySelectorAll('input[name="import-dest"]');
    const newInput = document.getElementById("import-new-folder-name");
    const existingSelect = document.getElementById("import-existing-folder");

    radios.forEach(r => {
      r.addEventListener("change", () => {
        const isNew = r.value === "new" && r.checked;
        if (newInput) newInput.disabled = !isNew;
        if (existingSelect) existingSelect.disabled = isNew;
      });
    });

    document.getElementById("import-confirm").onclick = () => {
      const selected = modal.querySelector('input[name="import-dest"]:checked')?.value;
      if (selected === "new") {
        const name = newInput.value.trim();
        if (!name) { newInput.style.borderColor = "var(--danger-color)"; newInput.focus(); return; }
        modal.remove();
        resolve({ type: "new", name });
      } else {
        const folderId = existingSelect?.value;
        modal.remove();
        resolve({ type: "existing", folderId });
      }
    };

    document.getElementById("import-cancel").onclick = () => { modal.remove(); resolve(null); };
    modal.addEventListener("click", e => { if (e.target === modal) { modal.remove(); resolve(null); } });
  });
}

async function importOrdersFromExcel() {
  if (!window.dashboardAPI || !window.dashboardAPI.importOrdersExcel) {
    showToast("Import not available", "error");
    return;
  }

  const result = await window.dashboardAPI.importOrdersExcel();
  if (!result.success) {
    if (result.canceled) return;
    showToast("Import failed: " + (result.error || "Unknown error"), "error");
    return;
  }

  const dest = await showFolderPickerForImport(result.fileName || "Imported");
  if (!dest) return;

  let folderId;
  if (dest.type === "new") {
    const folder = {
      id: crypto.randomUUID(),
      name: dest.name,
      createdAt: Date.now()
    };
    dashboardData.orderFolders.push(folder);
    folderId = folder.id;
  } else {
    folderId = dest.folderId;
  }

  const existingOrders = getOrdersInFolder(folderId);
  const duplicates = [];
  const newOrders = [];

  result.orders.forEach(o => {
    o.folderId = folderId;
    const existing = existingOrders.find(
      ex => ex.orderNumber && o.orderNumber && ex.orderNumber === o.orderNumber
    );
    if (existing) {
      duplicates.push({ incoming: o, existingId: existing.id });
    } else {
      newOrders.push(o);
    }
  });

  let overrideDuplicates = false;
  if (duplicates.length > 0) {
    const dupNumbers = duplicates.map(d => d.incoming.orderNumber).join(", ");
    const msg = duplicates.length === 1
      ? `Order <strong>${dupNumbers}</strong> already exists in this folder. Do you want to override it with the imported data?`
      : `${duplicates.length} orders already exist in this folder (<strong>${dupNumbers}</strong>). Do you want to override them with the imported data?`;
    overrideDuplicates = await showConfirm(msg, "Override");
  }

  if (overrideDuplicates) {
    duplicates.forEach(d => {
      const idx = dashboardData.orders.findIndex(o => o.id === d.existingId);
      if (idx !== -1) {
        const preserved = { id: d.existingId, folderId, createdAt: dashboardData.orders[idx].createdAt };
        dashboardData.orders[idx] = { ...d.incoming, ...preserved };
      }
    });
  }

  newOrders.forEach(o => {
    dashboardData.orders.push(o);
  });

  const importedCount = newOrders.length + (overrideDuplicates ? duplicates.length : 0);
  const skippedCount = overrideDuplicates ? 0 : duplicates.length;

  saveDashboard();

  if (skippedCount > 0) {
    showToast(`Imported ${importedCount} order${importedCount === 1 ? "" : "s"}, skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}`, "info");
  } else {
    showToast(`Imported ${importedCount} order${importedCount === 1 ? "" : "s"}${overrideDuplicates && duplicates.length ? ` (${duplicates.length} overridden)` : ""}`, "success");
  }
  renderOrdersPage();
}

async function createNewFolder() {
  const name = await showFolderNamePrompt("Create New Folder");
  if (!name) return;

  const folder = {
    id: crypto.randomUUID(),
    name: name,
    createdAt: Date.now()
  };
  dashboardData.orderFolders.push(folder);
  saveDashboard();
  showToast(`Folder "${name}" created`, "success");
  renderOrdersPage();
}

async function renameFolder(folderId) {
  const folder = getFolderById(folderId);
  if (!folder) return;

  const newName = await showFolderNamePrompt("Rename Folder", folder.name);
  if (!newName || newName === folder.name) return;

  folder.name = newName;
  saveDashboard();
  showToast(`Folder renamed to "${newName}"`, "success");
  renderOrdersPage();
}

async function deleteFolderById(folderId) {
  const folder = getFolderById(folderId);
  if (!folder) return;

  const ordersInFolder = getOrdersInFolder(folderId);
  const msg = ordersInFolder.length
    ? `Move folder "${folder.name}" and its ${ordersInFolder.length} order${ordersInFolder.length === 1 ? "" : "s"} to Trash?`
    : `Move empty folder "${folder.name}" to Trash?`;

  const confirmed = await showConfirm(msg, "Move to Trash");
  if (!confirmed) return;

  ordersInFolder.forEach(o => {
    moveToTrash("order", o, { folderName: folder.name, originalFolderId: folderId });
  });
  dashboardData.orders = dashboardData.orders.filter(o => o.folderId !== folderId);

  moveToTrash("folder", folder);
  dashboardData.orderFolders = dashboardData.orderFolders.filter(f => f.id !== folderId);

  saveDashboard();
  showToast(`Folder "${folder.name}" moved to Trash`, "warning");
  renderOrdersPage();
}

// ---------------- FOLDER SHARING ----------------

async function showShareFolderModal(folderId) {
  const folder = getFolderById(folderId);
  if (!folder) return;

  let collaborators = [];
  try {
    const res = await window.dashboardAPI.getFolderCollaborators(folderId);
    if (res.success) collaborators = res.collaborators;
  } catch (e) {
    console.error('[share] Failed to load collaborators:', e);
  }

  const modal = document.createElement("div");
  modal.className = "modal";

  function renderCollabList() {
    return collaborators.length
      ? collaborators.map(c => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:8px;">
          <div>
            <strong style="font-size:0.9em;">${c.name}</strong>
            <div style="font-size:0.78em; opacity:0.55;">${c.email}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <select class="collab-role-select" data-user-id="${c.userId}" style="padding:4px 8px; font-size:0.82em; border-radius:6px;">
              <option value="viewer" ${c.role === 'viewer' ? 'selected' : ''}>Viewer</option>
              <option value="editor" ${c.role === 'editor' ? 'selected' : ''}>Editor</option>
            </select>
            <button class="collab-remove-btn" data-user-id="${c.userId}" style="background:var(--danger-color); padding:4px 10px; font-size:0.8em; border-radius:6px;">Remove</button>
          </div>
        </div>
      `).join('')
      : '<p style="opacity:0.5; font-size:0.88em; margin:8px 0;">No collaborators yet.</p>';
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 520px;">
      <h3 style="margin-top:0; margin-bottom:16px;">Share "${folder.name}"</h3>

      <div style="margin-bottom:16px;">
        <label style="font-size:0.85em; opacity:0.7; display:block; margin-bottom:6px;">Invite by email</label>
        <div style="display:flex; gap:8px;">
          <input id="share-email-input" type="email" placeholder="user@example.com" style="flex:1; padding:8px 12px;">
          <select id="share-role-select" style="padding:8px 10px; border-radius:8px;">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button id="share-invite-btn" style="background:var(--success-color); white-space:nowrap;">Invite</button>
        </div>
        <div id="share-error" style="color:var(--danger-color); font-size:0.82em; margin-top:6px; display:none;"></div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-size:0.85em; opacity:0.7; display:block; margin-bottom:6px;">Current collaborators</label>
        <div id="collab-list">${renderCollabList()}</div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button id="share-close-btn" style="background:var(--border-color); color:var(--text-color);">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  function refreshCollabList() {
    const listEl = document.getElementById("collab-list");
    if (listEl) listEl.innerHTML = renderCollabList();
    wireCollabEvents();
  }

  function wireCollabEvents() {
    modal.querySelectorAll(".collab-role-select").forEach(sel => {
      sel.onchange = async () => {
        try {
          await window.dashboardAPI.updateCollaboratorRole(folderId, sel.dataset.userId, sel.value);
          const c = collaborators.find(x => x.userId === sel.dataset.userId);
          if (c) c.role = sel.value;
          showToast("Role updated", "success");
        } catch (e) {
          showToast("Failed to update role", "error");
        }
      };
    });

    modal.querySelectorAll(".collab-remove-btn").forEach(btn => {
      btn.onclick = async () => {
        try {
          await window.dashboardAPI.removeCollaborator(folderId, btn.dataset.userId);
          collaborators = collaborators.filter(x => x.userId !== btn.dataset.userId);
          refreshCollabList();
          showToast("Collaborator removed", "success");
        } catch (e) {
          showToast("Failed to remove collaborator", "error");
        }
      };
    });
  }
  wireCollabEvents();

  document.getElementById("share-invite-btn").onclick = async () => {
    const email = document.getElementById("share-email-input").value.trim();
    const role = document.getElementById("share-role-select").value;
    const errEl = document.getElementById("share-error");

    if (!email) { errEl.textContent = "Enter an email address"; errEl.style.display = "block"; return; }
    errEl.style.display = "none";

    try {
      const res = await window.dashboardAPI.addCollaborator(folderId, email, role);
      if (res.success) {
        collaborators.push(res.collaborator);
        document.getElementById("share-email-input").value = "";
        refreshCollabList();
        showToast(`Invited ${res.collaborator.name || email}`, "success");
      } else {
        errEl.textContent = res.error || "Failed to invite";
        errEl.style.display = "block";
      }
    } catch (e) {
      errEl.textContent = e.message || "Failed to invite";
      errEl.style.display = "block";
    }
  };

  document.getElementById("share-close-btn").onclick = () => modal.remove();
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
}

// ---------------- ORDERS PAGE (FOLDER VIEW) ----------------
let orderSortCol = null;
let orderSortDir = "asc";

function renderOrdersPage() {
  if (!appDiv) {
    console.error("Cannot render orders page: appDiv not found");
    return;
  }

  window.currentPage = "orders";
  currentOpenFolderId = null;

  const totalOrders = dashboardData.orders.length;
  const folderCount = dashboardData.orderFolders.length;
  const sharedFolders = dashboardData.sharedFolders || [];
  const trashCount = getTrashCount();

  appDiv.innerHTML = `
    <div>
      <h1>${t("orders")}</h1>
      <div style="font-size:0.88em; opacity:0.6; margin-top:-10px; margin-bottom:16px;">
        <strong>${folderCount}</strong> folder${folderCount === 1 ? "" : "s"} &middot; <strong>${totalOrders}</strong> ${t("totalOrdersLabel")}
        ${sharedFolders.length ? ` &middot; <strong>${sharedFolders.length}</strong> shared` : ''}
      </div>
    </div>

    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
      <button id="btn-new-folder" style="background: var(--success-color);">+ New Folder</button>
      <button id="btn-import-excel" style="background: var(--info-color);">Import Excel</button>
      <button id="btn-trash" style="background: ${trashCount ? 'var(--danger-color)' : 'var(--border-color)'}; color: ${trashCount ? 'white' : 'var(--text-color)'};">
        Trash${trashCount ? ` (${trashCount})` : ''}
      </button>
    </div>

    <div class="folder-grid" id="folderGrid"></div>
    ${sharedFolders.length ? `
      <div style="margin-top:32px;">
        <h2 style="font-size:1.15em; opacity:0.75; margin-bottom:14px;">Shared with me</h2>
        <div class="folder-grid" id="sharedFolderGrid"></div>
      </div>
    ` : ''}
  `;

  const grid = document.getElementById("folderGrid");

  if (!folderCount) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:60px 20px; opacity:0.5;">
        <div style="font-size:3.5em; margin-bottom:16px;">📁</div>
        <p style="font-size:1.1em;">No folders yet. Create a folder or import orders from an Excel file to get started.</p>
      </div>
    `;
  } else {
    dashboardData.orderFolders.forEach(folder => {
      const orders = getOrdersInFolder(folder.id);
      const activeCount = orders.filter(o => (o.status || "").trim() !== "Paid in Full").length;
      const totalUnits = orders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      const dateStr = new Date(folder.createdAt).toLocaleDateString();

      const card = document.createElement("div");
      card.className = "folder-card";
      card.innerHTML = `
        <div class="folder-actions">
          <button onclick="event.stopPropagation(); showShareFolderModal('${folder.id}')" style="background:var(--info-color);" title="Share">👥</button>
          <button onclick="event.stopPropagation(); renameFolder('${folder.id}')" style="background:var(--warning-color);" title="Rename">✏️</button>
          <button onclick="event.stopPropagation(); deleteFolderById('${folder.id}')" style="background:var(--danger-color);" title="Move to Trash">🗑️</button>
        </div>
        <div class="folder-icon">📁</div>
        <div class="folder-name">${folder.name}</div>
        <div class="folder-meta">
          <span>${orders.length} order${orders.length === 1 ? "" : "s"} &middot; ${activeCount} active</span>
          <span>${totalUnits} unit${totalUnits === 1 ? "" : "s"} &middot; Created ${dateStr}</span>
        </div>
      `;
      card.onclick = () => renderFolderContents(folder.id);
      grid.appendChild(card);
    });
  }

  if (sharedFolders.length) {
    const sharedGrid = document.getElementById("sharedFolderGrid");
    sharedFolders.forEach(folder => {
      const orders = getOrdersInFolder(folder.id);
      const activeCount = orders.filter(o => (o.status || "").trim() !== "Paid in Full").length;
      const totalUnits = orders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      const roleBadge = folder._role === 'editor'
        ? '<span style="background:var(--success-color); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.75em;">Editor</span>'
        : '<span style="background:var(--border-color); padding:2px 8px; border-radius:10px; font-size:0.75em;">Viewer</span>';

      const card = document.createElement("div");
      card.className = "folder-card";
      card.style.borderLeft = "3px solid var(--info-color)";
      card.innerHTML = `
        <div class="folder-icon">📁</div>
        <div class="folder-name">${folder.name} ${roleBadge}</div>
        <div class="folder-meta">
          <span>${orders.length} order${orders.length === 1 ? "" : "s"} &middot; ${activeCount} active</span>
          <span>${totalUnits} unit${totalUnits === 1 ? "" : "s"} &middot; Shared by ${folder._ownerName || 'Unknown'}</span>
        </div>
      `;
      card.onclick = () => renderFolderContents(folder.id);
      sharedGrid.appendChild(card);
    });
  }

  document.getElementById("btn-new-folder").onclick = () => createNewFolder();
  document.getElementById("btn-import-excel").onclick = () => importOrdersFromExcel();
  document.getElementById("btn-trash").onclick = () => renderTrashPage();
  renderNav("orders");
}

// ---------------- FOLDER CONTENTS VIEW ----------------
function renderFolderContents(folderId) {
  if (!appDiv) return;

  const folder = getFolderById(folderId);
  if (!folder) { showToast("Folder not found!", "error"); renderOrdersPage(); return; }

  window.currentPage = "orders";
  currentOpenFolderId = folderId;

  const isShared = isFolderSharedWithMe(folderId);
  const sharedRole = isShared ? getSharedFolderRole(folderId) : null;
  const canEdit = !isShared || sharedRole === 'editor';

  const folderOrders = getOrdersInFolder(folderId);
  const activeOrders = folderOrders.filter(o => (o.status || "").trim() !== "Paid in Full").length;
  const totalUnits = folderOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);

  const roleBadge = isShared
    ? (sharedRole === 'editor'
      ? ' <span style="background:var(--success-color); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.65em; vertical-align:middle;">Editor</span>'
      : ' <span style="background:var(--border-color); padding:2px 8px; border-radius:10px; font-size:0.65em; vertical-align:middle;">Viewer</span>')
    : '';

  appDiv.innerHTML = `
    <div class="folder-table-view">
    <button class="back-arrow" id="backToFolders">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      Back to Folders
    </button>
    <div>
      <h1>📁 ${folder.name}${roleBadge}</h1>
      <div style="font-size:0.88em; opacity:0.6; margin-top:-10px; margin-bottom:10px;">
        <strong>${folderOrders.length}</strong> ${t("totalOrdersLabel")} &middot; <strong>${activeOrders}</strong> ${t("activeLabel")} &middot; <strong>${totalUnits}</strong> ${t("unitsLabel")}
        ${isShared ? ` &middot; Shared by ${folder._ownerName || 'Unknown'}` : ''}
      </div>
    </div>

    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      ${canEdit ? `<button id="add">${t("btnAddOrder")}</button>` : ''}
      <div class="search-wrapper" id="searchContainer">
        <input
          id="orderSearch"
          type="text"
          placeholder="${t("searchPlaceholder")}"
          style="padding:10px 16px; width:340px;"
        >
        <button class="search-clear" id="searchClear" style="display:none;" title="Clear search">✕</button>

        <div
          id="searchTooltip"
          style="
            position:absolute;
            top:130%;
            left:0;
            background:#111;
            color:#fff;
            padding:12px 16px;
            border-radius:8px;
            font-size:13px;
            white-space:nowrap;
            display:none;
            z-index:9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          "
        >
          <strong>Search tokens:</strong><br>
          status:Sold &middot; qty:7 &middot; qty&gt;=10<br>
          email:@gmail &middot; customer:Smith<br>
          date:2026 &middot; company:Corp
        </div>
      </div>
      <span class="search-count" id="searchCount"></span>
    </div>

    <div class="table-container">
      <table id="ordersTable">
        <thead>
          <tr>
            <th class="sortable" data-col="orderNumber">#</th>
            <th class="sortable" data-col="dateTime">${t("thDate")}</th>
            <th class="sortable" data-col="AccountingNameAccountingNum">${t("thAccounting")}</th>
            <th class="sortable" data-col="location">${t("thLocation")}</th>
            <th class="sortable" data-col="unitType">${t("thUnitType")}</th>
            <th class="sortable" data-col="quantity">${t("thQty")}</th>
            <th class="sortable" data-col="status">${t("thStatus")}</th>
            <th class="sortable" data-col="customerName">${t("thCustomer")}</th>
            <th class="sortable" data-col="customerCompany">${t("thCompany")}</th>
            <th class="sortable" data-col="customerPhone">${t("thPhone")}</th>
            <th class="sortable" data-col="customerEmail">${t("thEmail")}</th>
            <th>${t("thBillingAddress")}</th>
            <th>${t("thShipTo")}</th>
            <th>${t("thNotes")}</th>
            <th class="sortable" data-col="budgetTotal">${t("thBudget")}</th>
            <th>${t("thActions")}</th>
          </tr>
        </thead>
        <tbody id="ordersTableBody"></tbody>
      </table>
    </div>
    </div>
  `;

  renderOrderRows(folderOrders);

  document.getElementById("backToFolders").onclick = () => renderOrdersPage();

  // Sortable headers
  document.querySelectorAll("#ordersTable th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (orderSortCol === col) {
        if (orderSortDir === "asc") { orderSortDir = "desc"; }
        else { orderSortCol = null; orderSortDir = "asc"; }
      } else {
        orderSortCol = col;
        orderSortDir = "asc";
      }
      document.querySelectorAll("#ordersTable th.sortable").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
      if (orderSortCol) {
        th.classList.add(orderSortDir === "asc" ? "sort-asc" : "sort-desc");
      }
      const query = document.getElementById("orderSearch")?.value?.trim() || "";
      renderOrderRows(query ? filterOrders(query, folderId) : folderOrders);
    });
  });

  const searchInput = document.getElementById("orderSearch");
  const clearBtn = document.getElementById("searchClear");
  const tooltip = document.getElementById("searchTooltip");
  const countEl = document.getElementById("searchCount");

  let hoverTimer = null;
  searchInput.addEventListener("mouseenter", () => { hoverTimer = setTimeout(() => { tooltip.style.display = "block"; }, 1000); });
  searchInput.addEventListener("mouseleave", () => { clearTimeout(hoverTimer); tooltip.style.display = "none"; });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    countEl.textContent = "";
    renderOrderRows(folderOrders);
    searchInput.focus();
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearBtn.style.display = query ? "block" : "none";

    if (!query) {
      countEl.textContent = "";
      renderOrderRows(folderOrders);
      return;
    }

    const filtered = filterOrders(query, folderId);
    countEl.textContent = `${filtered.length} of ${folderOrders.length} orders`;
    renderOrderRows(filtered);
  });

  const addBtn = document.getElementById("add");
  if (addBtn) addBtn.onclick = () => showOrderForm(undefined, folderId);
  renderNav("orders");
}

function filterOrders(query, folderId = null) {
  const allOrders = [...dashboardData.orders, ...(dashboardData.sharedOrders || [])];
  const baseOrders = folderId
    ? allOrders.filter(o => o.folderId === folderId)
    : dashboardData.orders;

  const tokens = parseSearchQuery(query.toLowerCase());
  const useAdvanced = tokens.some(t => t.type !== "text");

  return useAdvanced
    ? baseOrders.filter(o => matchesSearch(o, tokens))
    : baseOrders.filter(o =>
        [o.orderNumber, o.status, o.customerName, o.customerCompany, o.customerPhone,
         o.customerEmail, o.dateTime, o.AccountingNameAccountingNum, o.location,
         o.unitType, o.notes, o.shipTo, o.billingAddress, String(o.quantity ?? "")]
          .filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
      );
}

// ---------------- TRASH PAGE ----------------
function renderTrashPage() {
  if (!appDiv) return;

  window.currentPage = "trash";
  const trash = dashboardData.trash || [];

  appDiv.innerHTML = `
    <button class="back-arrow" id="backToFolders">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      Back to Orders
    </button>
    <div class="page-header">
      <h1>🗑️ Trash</h1>
      ${trash.length ? `<button id="btn-empty-trash" style="background:var(--danger-color);">Empty Trash</button>` : ''}
    </div>
    <div id="trashList"></div>
  `;

  document.getElementById("backToFolders").onclick = () => renderOrdersPage();

  if (trash.length && document.getElementById("btn-empty-trash")) {
    document.getElementById("btn-empty-trash").onclick = async () => {
      const confirmed = await showConfirm(`Permanently delete all ${trash.length} item${trash.length === 1 ? "" : "s"} in Trash? This cannot be undone.`, "Empty Trash");
      if (!confirmed) return;
      dashboardData.trash = [];
      saveDashboard();
      showToast("Trash emptied", "warning");
      renderTrashPage();
    };
  }

  const listEl = document.getElementById("trashList");

  if (!trash.length) {
    listEl.innerHTML = `<div class="trash-empty">Trash is empty</div>`;
    renderNav("orders");
    return;
  }

  // Collect folder IDs that are in trash so we can hide their child orders
  const trashedFolderIds = new Set(
    trash.filter(t => t.type === "folder").map(t => t.data.id)
  );

  // Filter out orders whose parent folder is also in the trash (they'll be restored together)
  const visibleTrash = trash.filter(item => {
    if (item.type === "order" && item.originalFolderId && trashedFolderIds.has(item.originalFolderId)) {
      return false;
    }
    return true;
  });

  const sorted = [...visibleTrash].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  sorted.forEach(item => {
    const div = document.createElement("div");
    div.className = "trash-item";

    const deletedDate = new Date(item.deletedAt).toLocaleDateString();
    let name, detail, typeLabel, typeClass;

    if (item.type === "folder") {
      const childOrderCount = trash.filter(
        t => t.type === "order" && t.originalFolderId === item.data.id
      ).length;
      typeLabel = "Folder"; typeClass = "trash-type-folder";
      name = item.data.name || "Unnamed Folder";
      detail = `Folder &middot; ${childOrderCount} order${childOrderCount === 1 ? "" : "s"} inside &middot; Deleted ${deletedDate}`;
    } else if (item.type === "customer") {
      typeLabel = "Customer"; typeClass = "trash-type-order";
      name = `${item.data.name || "Unknown"} (${item.data.company || ""})`;
      detail = `Customer &middot; ${item.data.email || ""} &middot; Deleted ${deletedDate}`;
    } else if (item.type === "inventory") {
      typeLabel = "Inventory"; typeClass = "trash-type-folder";
      name = item.data.material || "Unknown Material";
      detail = `Inventory &middot; In Stock: ${item.data.inStock || 0}, Required: ${item.data.required || 0} &middot; Deleted ${deletedDate}`;
    } else {
      typeLabel = "Order"; typeClass = "trash-type-order";
      name = `${item.data.orderNumber || "Order"} — ${item.data.customerName || "Unknown"}`;
      detail = `Order &middot; ${item.data.quantity || 0} units &middot; ${item.folderName ? `from "${item.folderName}"` : ""} &middot; Deleted ${deletedDate}`;
    }

    div.innerHTML = `
      <div class="trash-info">
        <div class="trash-name">
          <span class="trash-type ${typeClass}">${typeLabel}</span>
          ${name}
        </div>
        <div class="trash-detail">${detail}</div>
      </div>
      <div class="trash-actions">
        <button class="restore-btn" style="background: var(--success-color);">Restore</button>
        <button class="perma-delete-btn" style="background: var(--danger-color);">Delete Forever</button>
      </div>
    `;

    div.querySelector(".restore-btn").onclick = () => restoreFromTrash(item.id);
    div.querySelector(".perma-delete-btn").onclick = () => permanentlyDelete(item.id);

    listEl.appendChild(div);
  });

  renderNav("orders");
}

async function restoreFromTrash(trashId) {
  const trashIndex = dashboardData.trash.findIndex(t => t.id === trashId);
  if (trashIndex === -1) { showToast("Item not found in trash!", "error"); return; }

  const item = dashboardData.trash[trashIndex];

  if (item.type === "folder") {
    const folder = item.data;
    if (!dashboardData.orderFolders.find(f => f.id === folder.id)) {
      dashboardData.orderFolders.push(folder);
    }
    const relatedOrders = dashboardData.trash.filter(
      t => t.type === "order" && t.originalFolderId === folder.id
    );
    relatedOrders.forEach(trashOrder => {
      dashboardData.orders.push(trashOrder.data);
      const idx = dashboardData.trash.findIndex(t => t.id === trashOrder.id);
      if (idx !== -1) dashboardData.trash.splice(idx, 1);
    });
    dashboardData.trash.splice(dashboardData.trash.findIndex(t => t.id === trashId), 1);
    showToast(`Folder "${folder.name}" restored with ${relatedOrders.length} order${relatedOrders.length === 1 ? "" : "s"}`, "success");
  } else if (item.type === "customer") {
    dashboardData.customers.push(item.data);
    dashboardData.trash.splice(trashIndex, 1);
    showToast(`Customer "${item.data.name}" restored`, "success");
  } else if (item.type === "inventory") {
    dashboardData.inventory.push(item.data);
    dashboardData.trash.splice(trashIndex, 1);
    showToast(`Inventory item "${item.data.material}" restored`, "success");
  } else {
    const order = item.data;
    if (order.folderId && !dashboardData.orderFolders.find(f => f.id === order.folderId)) {
      const folderName = item.folderName || "Restored Orders";
      dashboardData.orderFolders.push({
        id: order.folderId,
        name: folderName,
        createdAt: Date.now()
      });
      showToast(`Folder "${folderName}" was also recreated`, "info");
    }
    dashboardData.orders.push(order);
    dashboardData.trash.splice(trashIndex, 1);
    showToast(`Order "${order.orderNumber}" restored`, "success");
  }

  saveDashboard();
  renderTrashPage();
}

async function permanentlyDelete(trashId) {
  const trashIndex = dashboardData.trash.findIndex(t => t.id === trashId);
  if (trashIndex === -1) return;

  const item = dashboardData.trash[trashIndex];
  let label;
  if (item.type === "folder") label = `folder "${item.data.name}"`;
  else if (item.type === "customer") label = `customer "${item.data.name}"`;
  else if (item.type === "inventory") label = `inventory item "${item.data.material}"`;
  else label = `order "${item.data.orderNumber}"`;

  const confirmed = await showConfirm(`Permanently delete ${label}? This cannot be undone.`, "Delete Forever");
  if (!confirmed) return;

  if (item.type === "folder") {
    dashboardData.trash = dashboardData.trash.filter(
      t => !(t.type === "order" && t.originalFolderId === item.data.id) && t.id !== trashId
    );
  } else {
    dashboardData.trash.splice(trashIndex, 1);
  }

  saveDashboard();
  showToast(`${label} permanently deleted`, "warning");
  renderTrashPage();
}

// ---------------- ORDERS PAGE Render Rows ----------------
function renderOrderRows(orderList) {
  // Track for "Export Current" feature
  currentFilteredOrders = orderList;

  const tbody = document.getElementById("ordersTableBody") || document.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Create a sortable copy
  const sorted = [...orderList];

  if (orderSortCol) {
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (orderSortCol === "quantity") {
        aVal = Number(a.quantity) || 0;
        bVal = Number(b.quantity) || 0;
      } else if (orderSortCol === "dateTime") {
        aVal = new Date(a.dateTime || 0).getTime();
        bVal = new Date(b.dateTime || 0).getTime();
      } else if (orderSortCol === "budgetTotal") {
        aVal = a.budget?.totalWithTax || 0;
        bVal = b.budget?.totalWithTax || 0;
      } else {
        aVal = (a[orderSortCol] || "").toString().toLowerCase();
        bVal = (b[orderSortCol] || "").toString().toLowerCase();
      }
      if (aVal < bVal) return orderSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return orderSortDir === "asc" ? 1 : -1;
      return 0;
    });
  } else {
    // Default sort: unpaid first, newest first
    sorted.sort((a, b) => {
      const aPaid = (a.status || "").trim() === "Paid in Full";
      const bPaid = (b.status || "").trim() === "Paid in Full";
      if (!aPaid && bPaid) return -1;
      if (aPaid && !bPaid) return 1;
      return new Date(b.dateTime || 0).getTime() - new Date(a.dateTime || 0).getTime();
    });
  }

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding:40px; opacity:0.5;">${t("noOrdersFound")}</td></tr>`;
    return;
  }

  sorted.forEach(o => {
    const isActive = (o.status || "").trim() !== "Paid in Full";
    const budgetDisplay = o.budget?.totalWithTax
      ? `${getCurrency()}${o.budget.totalWithTax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : t("btnCreate");

    const statusColors = {
      "Sold": "var(--success-color)",
      "In production": "var(--danger-color)",
      "Shipped": "var(--info-color)",
      "Paid in Full": "var(--success-color)",
      "Pending": "var(--warning-color)"
    };
    const statusBg = statusColors[(o.status || "").trim()] || "var(--border-color)";

    const tr = document.createElement("tr");
    if (isActive) {
      tr.style.borderLeft = "4px solid var(--danger-color)";
    }
    tr.innerHTML = `
      <td style="color:${isActive ? "var(--danger-color)" : "var(--info-color)"}; font-weight:${isActive ? "700" : "600"}; cursor:pointer;"
          onclick="openBudgetById('${o.id}')">
        ${o.orderNumber || ""}
      </td>
      <td style="white-space:nowrap;">${formatDate(o.dateTime)}</td>
      <td>${o.AccountingNameAccountingNum || ""}</td>
      <td>${o.location || ""}</td>
      <td>${Array.isArray(o.orderProducts) && o.orderProducts.length > 1
        ? `<span title="${o.orderProducts.map(p => p.productName + ' ×' + p.qty).join(', ')}" style="cursor:help;">${o.orderProducts.length} products</span>`
        : (o.unitType || "")}</td>
      <td style="text-align:center; font-weight:600;">${o.quantity || ""}</td>
      <td><span style="padding:4px 10px; background:${statusBg}; color:white; border-radius:12px; font-size:0.85em; font-weight:600; white-space:nowrap;">${o.status || "Undefined"}</span></td>
      <td>${o.customerName || ""}</td>
      <td>${o.customerCompany || ""}</td>
      <td>${o.customerPhone || ""}</td>
      <td>${o.customerEmail || ""}</td>
      <td>${o.billingAddress || ""}</td>
      <td>${o.shipTo || ""}</td>
      <td style="font-style:${o.notes ? "normal" : "italic"}; opacity:${o.notes ? "1" : "0.5"}; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(o.notes || '').replace(/"/g, '&quot;')}">${o.notes || t("noNotes")}</td>
      <td>
        <button onclick="openBudgetById('${o.id}')" style="background:var(--info-color);">${budgetDisplay}</button>
      </td>
      <td style="white-space:nowrap;">
        <button onclick="generateInvoiceById('${o.id}')" style="background:var(--accent-color); padding:8px 12px;" title="Generate Invoice">📄</button>
        <button onclick="duplicateOrderById('${o.id}')" style="background:var(--info-color); padding:8px 12px;" title="Duplicate Order">📋</button>
        <button onclick="editOrderById('${o.id}')" style="background:var(--warning-color); padding:8px 12px;" title="Edit Order">✏️</button>
        <button onclick="deleteOrderById('${o.id}')" style="background:var(--danger-color); padding:8px 12px;" title="Delete Order">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


// ---------------- ORDERS PAGE SEARCH ----------------
function parseSearchQuery(input) {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);

  return tokens.map(token => {
    const qtyMatch = token.match(/^qty(>=|<=|>|<|=)(\d+)$/);
    if (qtyMatch) {
      return { type: "qty", operator: qtyMatch[1], value: Number(qtyMatch[2]) };
    }

    const parts = token.split(":");
    if (parts.length === 2) {
      if (parts[0] === "qty" && !isNaN(parts[1])) {
        return { type: "qty", operator: "=", value: Number(parts[1]) };
      }
      return { type: "field", field: parts[0], value: parts[1] };
    }

    return { type: "text", value: token };
  });
}

// ---------------- ORDERS PAGE Match Token Search ----------------

function matchesSearch(order, tokens) {
  return tokens.every(t => {
    // 🔢 Quantity logic
    if (t.type === "qty") {
      const q = Number(order.quantity || 0);
      if (t.operator === ">=") return q >= t.value;
      if (t.operator === "<=") return q <= t.value;
      if (t.operator === ">") return q > t.value;
      if (t.operator === "<") return q < t.value;
      if (t.operator === "=") return q === t.value;
    }

    // 🔑 Field-based logic
    if (t.type === "field") {
      const fieldMap = {
        status: order.status,
        email: order.customerEmail,
        phone: order.customerPhone,
        customer: order.customerName,
        company: order.customerCompany,
        location: order.location,
        date: order.dateTime,
        unit: order.unitType,
        notes: order.notes
      };

      return String(fieldMap[t.field] || "")
        .toLowerCase()
        .includes(t.value);
    }

    // 🔍 Free text logic
    if (t.type === "text") {
      return [
        order.orderNumber,
        order.status,
        order.customerName,
        order.customerCompany,
        order.customerEmail,
        order.customerPhone,
        order.location,
        order.notes,
        order.dateTime,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(t.value);
    }

    return true;
  });
}



// ---------------- BUDGET / MATERIALS FULL PAGE ----------------
function openBudget(index) {
  if (!appDiv) {
    console.error("Cannot render budget page: appDiv not found");
    return;
  }

  const order = dashboardData.orders[index];
  if (!order) {
    showToast("Order not found!", "error");
    return;
  }

  const multiMode = isMultiProductMode() && Array.isArray(order.orderProducts) && order.orderProducts.length > 0;
  const qty = Number(order.quantity) || 1;

  const defaultBudget = {
    unitPrice: 3000,
    taxRate: 0.07,
    freight: 1422,
    costPerUnit: 1500,
    lineItems: []
  };

  const budget = { ...defaultBudget, ...(order.budget || {}) };
  if (!Array.isArray(budget.lineItems)) budget.lineItems = [];

  // Working copy of line items so we can add/remove before saving
  const lineItems = budget.lineItems.map(li => ({ ...li }));

  // Multi-mode: working copy of order product lines for editing
  const budgetProductLines = multiMode ? order.orderProducts.map(p => ({ ...p })) : [];

  const fmtMoney = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cur = getCurrency();
  const budgetBackFolderId = order.folderId || currentOpenFolderId;
  window.currentPage = "budget";
  appDiv.innerHTML = `
    <button class="back-arrow" id="budget-back-btn">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
      ${t("btnBackToOrders")}
    </button>
    <h1>${t("budgetForOrder")} ${order.orderNumber || "N/A"} <span style="font-size:0.6em; opacity:0.7;">(${qty} ${qty > 1 ? t("unitsLabel") : t("unitLabel")}) &middot; ${order.customerName || "—"}</span></h1>

    <div class="card">
      <h2>${t("budgetDetails")}</h2>

      ${multiMode ? `
      <div style="margin-bottom:24px;">
        <h3 style="margin-bottom:12px; font-size:1.1em;">Product Lines</h3>
        <table id="budget-product-lines" style="width:100%; margin-bottom:12px;">
          <thead>
            <tr>
              <th style="text-align:left;">Product</th>
              <th style="text-align:center; width:80px;">Qty</th>
              <th style="text-align:right; width:140px;">Unit Price (${cur})</th>
              <th style="text-align:right; width:130px;">Subtotal</th>
            </tr>
          </thead>
          <tbody id="budget-products-body"></tbody>
          <tfoot>
            <tr style="font-weight:700; border-top:2px solid var(--border-color);">
              <td>Total</td>
              <td style="text-align:center;" id="bp-total-qty"></td>
              <td></td>
              <td style="text-align:right;" id="bp-total-amount"></td>
            </tr>
          </tfoot>
        </table>
        <p style="font-size:0.85em; opacity:0.6; margin:0;">Product lines are set when creating/editing the order. Prices can be adjusted here for budgeting.</p>
      </div>
      ` : `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div>
          <label>${t("unitPriceLabel")}</label>
          <input type="number" id="unit-price" value="${(budget.unitPrice || 0).toFixed(2)}" step="0.01">
        </div>
      `}

      ${!multiMode ? `
        <div>
          <label>${t("salesTaxLabel")}</label>
          <input type="number" id="sales-tax" value="${((budget.taxRate || 0) * 100).toFixed(2)}" step="0.01">
        </div>
        <div>
          <label>${t("freightLabel")}</label>
          <input type="text" id="freight" value="${fmtMoney(budget.freight)}">
        </div>
        <div>
          <label>${t("costToProduceLabel")}</label>
          <input type="number" id="budget-cost" value="${(budget.costPerUnit || 0).toFixed(2)}" step="0.01">
        </div>
      </div>
      ` : `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div>
          <label>${t("salesTaxLabel")}</label>
          <input type="number" id="sales-tax" value="${((budget.taxRate || 0) * 100).toFixed(2)}" step="0.01">
        </div>
        <div>
          <label>${t("freightLabel")}</label>
          <input type="text" id="freight" value="${fmtMoney(budget.freight)}">
        </div>
        <div>
          <label>${t("costToProduceLabel")}</label>
          <input type="number" id="budget-cost" value="${(budget.costPerUnit || 0).toFixed(2)}" step="0.01">
        </div>
      </div>
      `}

      <div>
        <h3>${t("additionalLineItems")}</h3>
        <table id="line-items-table">
          <thead>
            <tr>
              <th style="text-align: left;">${t("thDescription")}</th>
              <th style="text-align: center; width: 150px;">${t("thType")}</th>
              <th style="text-align: center; width: 150px;">${t("thTax")}</th>
              <th style="text-align: right; width: 150px;">${t("thAmount")} (${cur})</th>
              <th style="text-align: center; width: 80px;"></th>
            </tr>
          </thead>
          <tbody id="line-items-body"></tbody>
        </table>
        <button id="add-line-item" style="margin-top: 15px; background: var(--success-color);">${t("btnAddLineItem")}</button>
      </div>

      <div id="budget-breakdown" style="margin-top: 30px; padding: 20px; background: var(--row-even-bg); border-radius: 12px; border-left: 4px solid var(--accent-color);"></div>

      <div style="margin-top: 25px; padding: 20px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 12px; text-align: right;">
        <div style="font-size: 1.8em; font-weight: 700; color: var(--text-color);">
          ${t("totalLabel")} <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${cur}<span id="grand-total">0.00</span></span>
        </div>
        <div id="profit-display" style="font-size: 0.95em; margin-top: 10px; font-weight: 500;"></div>
      </div>

      <div style="margin-top: 30px; display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-budget" style="background: var(--border-color); color: var(--text-color);">${t("btnCancel")}</button>
        <button id="save-budget" style="background: var(--success-color);">${t("btnSaveBudget")}</button>
      </div>
    </div>
  `;

  const unitPriceInput  = document.getElementById("unit-price");  // null in multi mode
  const taxPercentInput = document.getElementById("sales-tax");
  const freightInput    = document.getElementById("freight");
  const costInput       = document.getElementById("budget-cost");
  const totalSpan       = document.getElementById("grand-total");
  const profitDisplay   = document.getElementById("profit-display");

  // ── Multi-mode: render product lines in budget ──
  if (multiMode) {
    function renderBudgetProductLines() {
      const tbody = document.getElementById("budget-products-body");
      if (!tbody) return;
      tbody.innerHTML = "";

      budgetProductLines.forEach((line, i) => {
        const subtotal = (line.qty || 0) * (line.unitPrice || 0);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding:8px 12px;">${line.productName || "Unnamed"}</td>
          <td style="text-align:center;">
            <input type="number" class="bp-qty" data-idx="${i}" value="${line.qty || 1}" min="1"
                   style="width:60px; padding:6px; border:2px solid var(--input-border); border-radius:6px; background:var(--input-bg); color:var(--input-text); text-align:center;">
          </td>
          <td style="text-align:right;">
            <input type="number" class="bp-price" data-idx="${i}" value="${(line.unitPrice || 0).toFixed(2)}" step="0.01" min="0"
                   style="width:110px; padding:6px; border:2px solid var(--input-border); border-radius:6px; background:var(--input-bg); color:var(--input-text); text-align:right;">
          </td>
          <td style="text-align:right; font-weight:600; padding:8px 12px; font-family:'Monaco','Courier New',monospace;">
            ${cur}${fmtMoney(subtotal)}
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Wire events
      tbody.querySelectorAll(".bp-qty").forEach(input => {
        input.addEventListener("input", () => {
          budgetProductLines[parseInt(input.dataset.idx)].qty = parseInt(input.value) || 1;
          renderBudgetProductLines();
          calculateTotal();
        });
      });
      tbody.querySelectorAll(".bp-price").forEach(input => {
        input.addEventListener("input", () => {
          budgetProductLines[parseInt(input.dataset.idx)].unitPrice = parseFloat(input.value) || 0;
          renderBudgetProductLines();
          calculateTotal();
        });
      });

      // Update totals in footer
      const totalQty = budgetProductLines.reduce((s, l) => s + (l.qty || 0), 0);
      const totalAmount = budgetProductLines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
      const tqEl = document.getElementById("bp-total-qty");
      const taEl = document.getElementById("bp-total-amount");
      if (tqEl) tqEl.textContent = totalQty;
      if (taEl) taEl.textContent = `${cur}${fmtMoney(totalAmount)}`;
    }
    renderBudgetProductLines();
  }

  // ---------- Line Items Rendering ----------
  function renderLineItems() {
    const tbody = document.getElementById("line-items-body");
    tbody.innerHTML = "";

    lineItems.forEach((li, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <input type="text" class="li-label" data-idx="${i}" value="${li.label || ""}"
                 placeholder="e.g. Pickup Credit, Discount…">
        </td>
        <td style="text-align: center;">
          <select class="li-type" data-idx="${i}">
            <option value="add" ${li.type === "add" ? "selected" : ""}>${t("additionType")}</option>
            <option value="deduct" ${li.type === "deduct" ? "selected" : ""}>${t("deductionType")}</option>
          </select>
        </td>
        <td style="text-align: center;">
          <select class="li-tax" data-idx="${i}">
            <option value="before" ${li.taxOption === "before" ? "selected" : ""}>${t("beforeTax")}</option>
            <option value="after" ${li.taxOption === "after" ? "selected" : ""}>${t("afterTax")}</option>
            <option value="none" ${li.taxOption === "none" ? "selected" : ""}>${t("noTax")}</option>
          </select>
        </td>
        <td>
          <input type="number" class="li-amount" data-idx="${i}" value="${(li.amount || 0).toFixed(2)}" step="0.01" min="0" style="text-align: right;">
        </td>
        <td style="text-align: center;">
          <button class="li-delete" data-idx="${i}" title="Remove" style="color: var(--danger-color); font-weight: bold; border: none; background: none; cursor: pointer; font-size: 1.4em; padding: 4px 8px;">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Wire up live editing
    tbody.querySelectorAll(".li-label").forEach(el => {
      el.addEventListener("input", () => { lineItems[el.dataset.idx].label = el.value; calculateTotal(); });
    });
    tbody.querySelectorAll(".li-type").forEach(el => {
      el.addEventListener("change", () => { lineItems[el.dataset.idx].type = el.value; calculateTotal(); });
    });
    tbody.querySelectorAll(".li-tax").forEach(el => {
      el.addEventListener("change", () => { lineItems[el.dataset.idx].taxOption = el.value; calculateTotal(); });
    });
    tbody.querySelectorAll(".li-amount").forEach(el => {
      el.addEventListener("input", () => { lineItems[el.dataset.idx].amount = parseFloat(el.value) || 0; calculateTotal(); });
    });
    tbody.querySelectorAll(".li-delete").forEach(el => {
      el.addEventListener("click", () => { lineItems.splice(el.dataset.idx, 1); renderLineItems(); calculateTotal(); });
    });
  }

  document.getElementById("add-line-item").onclick = () => {
    lineItems.push({ label: "", type: "add", taxOption: "before", amount: 0 });
    renderLineItems();
    calculateTotal();
  };

  renderLineItems();

  // ---------- Calculation ----------
  function calculateTotal() {
    let unitPrice, productSubtotal, effectiveQty;

    if (multiMode) {
      // Multi-mode: sum product lines
      effectiveQty = budgetProductLines.reduce((s, l) => s + (l.qty || 0), 0);
      productSubtotal = budgetProductLines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
      unitPrice = effectiveQty > 0 ? productSubtotal / effectiveQty : 0;
    } else {
      unitPrice = parseFloat(unitPriceInput.value) || 0;
      effectiveQty = qty;
      productSubtotal = unitPrice * qty;
    }

    const taxPercent = parseFloat(taxPercentInput.value) || 7;
    const freight    = parseFloat(freightInput.value.replace(/,/g, '')) || 0;

    // Separate line items by tax option
    const beforeTaxItems = lineItems.filter(li => (li.taxOption || "before") === "before");
    const noTaxItems     = lineItems.filter(li => li.taxOption === "none");
    const afterTaxItems  = lineItems.filter(li => li.taxOption === "after");

    // Taxable base: product + freight + "before tax" line items
    let taxableSubtotal = productSubtotal + freight;
    beforeTaxItems.forEach(li => {
      const amt = Math.abs(li.amount || 0);
      taxableSubtotal += (li.type === "deduct") ? -amt : amt;
    });
    taxableSubtotal = Math.max(taxableSubtotal, 0);

    const taxRate   = taxPercent / 100;
    const taxAmount = taxableSubtotal * taxRate;

    // "No tax" items: added to total but not taxed (shown before tax line)
    let noTaxTotal = 0;
    noTaxItems.forEach(li => {
      const amt = Math.abs(li.amount || 0);
      noTaxTotal += (li.type === "deduct") ? -amt : amt;
    });

    // "After tax" items: added after tax (shown after tax line)
    let afterTaxTotal = 0;
    afterTaxItems.forEach(li => {
      const amt = Math.abs(li.amount || 0);
      afterTaxTotal += (li.type === "deduct") ? -amt : amt;
    });

    const total = taxableSubtotal + noTaxTotal + taxAmount + afterTaxTotal;

    // Helper to render a single line item in the breakdown
    function liBreakdownRow(li) {
      const amt = Math.abs(li.amount || 0);
      const label = li.label || "Untitled";
      if (li.type === "deduct") {
        return `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; color: var(--danger-color); font-weight: 500;">
            <span>${label}:</span>
            <span>(${cur}${fmtMoney(amt)})</span>
          </div>`;
      }
      return `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 500;">
            <span>${label}:</span>
            <span style="color: var(--success-color);">${cur}${fmtMoney(amt)}</span>
          </div>`;
    }

    // Build breakdown display
    const breakdownDiv = document.getElementById("budget-breakdown");
    let breakdownHTML = `
      <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.2em;">${t("breakdownTitle")}</h3>
      <div style="display: flex; justify-content: flex-end;">
        <div style="min-width: 450px;">
    `;

    if (multiMode) {
      // Show each product line in breakdown
      budgetProductLines.forEach(line => {
        const lineSubtotal = (line.qty || 0) * (line.unitPrice || 0);
        breakdownHTML += `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-weight: 500;">
            <span>${line.productName || "Product"} <span style="opacity: 0.6;">(${line.qty} × ${cur}${fmtMoney(line.unitPrice)})</span>:</span>
            <span class="number-display">${cur}${fmtMoney(lineSubtotal)}</span>
          </div>`;
      });
    } else {
      breakdownHTML += `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 500;">
            <span>${t("productSubtotal")} <span style="opacity: 0.6;">(${qty} × ${cur}${fmtMoney(unitPrice)})</span>:</span>
            <span class="number-display">${cur}${fmtMoney(productSubtotal)}</span>
          </div>`;
    }

    breakdownHTML += `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 500;">
            <span>${t("freightLabel")}</span>
            <span class="number-display">${cur}${fmtMoney(freight)}</span>
          </div>
    `;

    // Before-tax items (taxable)
    beforeTaxItems.forEach(li => { breakdownHTML += liBreakdownRow(li); });

    // No-tax items (before the tax line, but untaxed)
    noTaxItems.forEach(li => { breakdownHTML += liBreakdownRow(li); });

    // Tax line
    breakdownHTML += `
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid var(--border-color); margin-top: 8px; font-weight: 600;">
            <span>${t("salesTax")} <span style="opacity: 0.6;">(${taxPercent.toFixed(2)}%)</span>:</span>
            <span class="number-display" style="color: var(--info-color);">${cur}${fmtMoney(taxAmount)}</span>
          </div>
    `;

    // After-tax items
    afterTaxItems.forEach(li => { breakdownHTML += liBreakdownRow(li); });

    breakdownHTML += `
        </div>
      </div>
    `;

    breakdownDiv.innerHTML = breakdownHTML;

    totalSpan.textContent = fmtMoney(total);

    // Profit display
    const costPerUnit = parseFloat(costInput.value) || 0;
    const totalCost = costPerUnit * effectiveQty;
    const profit = total - totalCost;
    const margin = total > 0 ? ((profit / total) * 100).toFixed(1) : 0;
    const profitColor = profit >= 0 ? "var(--success-color)" : "var(--danger-color)";
    const profitIcon = profit >= 0 ? "📈" : "📉";
    profitDisplay.innerHTML = `
      <div style="display: flex; justify-content: space-around; align-items: center; gap: 20px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-top: 8px;">
        <div>
          <div style="font-size: 0.85em; opacity: 0.7;">${t("totalCostLabel")}</div>
          <div class="number-display" style="font-size: 1.1em; font-weight: 600;">${cur}${fmtMoney(totalCost)}</div>
          <div style="font-size: 0.8em; opacity: 0.6;">(${effectiveQty} × ${cur}${fmtMoney(costPerUnit)})</div>
        </div>
        <div style="border-left: 2px solid var(--border-color); height: 50px;"></div>
        <div>
          <div style="font-size: 0.85em; opacity: 0.7;">${t("profitLabel")} ${profitIcon}</div>
          <div class="number-display" style="font-size: 1.3em; font-weight: 700; color:${profitColor};">${cur}${fmtMoney(profit)}</div>
          <div style="font-size: 0.9em; font-weight: 600;">${margin}% ${t("kpiMargin")}</div>
        </div>
      </div>
    `;

    return {
      qty: effectiveQty,
      unitPrice,
      productSubtotal,
      freight,
      costPerUnit,
      cost: totalCost,
      lineItems: lineItems.map(li => ({
        label: li.label,
        type: li.type,
        taxOption: li.taxOption || "before",
        amount: Math.abs(li.amount || 0)
      })),
      taxableSubtotal,
      taxRate,
      taxAmount,
      total,
      orderProducts: multiMode ? budgetProductLines.map(p => ({ ...p })) : undefined
    };
  }

  [unitPriceInput, taxPercentInput, freightInput, costInput].filter(Boolean).forEach(input => {
    input.addEventListener("input", calculateTotal);
  });

  calculateTotal();

  const goBackFromBudget = () => {
    if (budgetBackFolderId && getFolderById(budgetBackFolderId)) {
      renderFolderContents(budgetBackFolderId);
    } else {
      renderOrdersPage();
    }
  };

  document.getElementById("budget-back-btn").onclick = goBackFromBudget;
  document.getElementById("cancel-budget").onclick = goBackFromBudget;

  document.getElementById("save-budget").onclick = async () => {
    const result = calculateTotal();

    const budgetPayload = {
      unitPrice: result.unitPrice,
      taxPercent: (result.taxRate * 100),
      freight: result.freight,
      costPerUnit: result.costPerUnit,
      lineItems: result.lineItems,
      orderProducts: multiMode ? result.orderProducts : undefined
    };

    // Server-validated budget save (falls back to local if API unavailable)
    if (window.dashboardAPI.saveBudget) {
      try {
        const serverResult = await window.dashboardAPI.saveBudget(order.id, budgetPayload);
        if (serverResult.success) {
          order.budget = serverResult.budget;
          if (multiMode && serverResult.budget.orderProducts) {
            order.orderProducts = serverResult.budget.orderProducts;
            order.quantity = serverResult.budget.qty;
            order.unitType = serverResult.budget.orderProducts.length === 1
              ? serverResult.budget.orderProducts[0].productName
              : `${serverResult.budget.orderProducts.length} products`;
          }
          dashboardData = await window.dashboardAPI.load() || dashboardData;
          showToast(`${t("budgetSaved")} ${cur}${fmtMoney(serverResult.budget.total)}`, "success");
          goBackFromBudget();
          return;
        }
      } catch (e) {
        console.warn("Server budget save unavailable, using local:", e.message);
      }
    }

    // Fallback: local save (for Electron or standalone mode)
    order.budget = {
      qty: result.qty, unitPrice: result.unitPrice, productSubtotal: result.productSubtotal,
      freight: result.freight, costPerUnit: result.costPerUnit, cost: result.cost,
      lineItems: result.lineItems, taxableSubtotal: result.taxableSubtotal,
      taxRate: result.taxRate, taxAmount: result.taxAmount,
      totalWithTax: result.total, total: result.total,
      lastUpdated: new Date().toISOString()
    };
    if (multiMode && result.orderProducts) {
      order.orderProducts = result.orderProducts;
      order.quantity = result.qty;
      order.unitType = result.orderProducts.length === 1 ? result.orderProducts[0].productName : `${result.orderProducts.length} products`;
    }
    saveDashboard();
    showToast(`${t("budgetSaved")} ${cur}${fmtMoney(result.total)}`, "success");
    goBackFromBudget();
  };

  renderNav("");
}



// ---------------- ORDER FORM ----------------
function showOrderForm(editIndex = undefined, folderId = null) {
  const form = document.createElement("div");
  form.className = "modal";

  let order = editIndex !== undefined ? { ...dashboardData.orders[editIndex] } : {};
  let title = editIndex !== undefined ? t("editOrder") : t("newOrder");

  const customerOptions = dashboardData.customers.map((c, i) => `
    <option value="${i}" ${order.customerIndex === i ? "selected" : ""}>
      ${c.name} (${c.company})
    </option>
  `).join("");

  const today = new Date();
  const formattedDate = formatDate(today.toISOString());

  const escapeVal = (v) => (v || "").replace(/"/g, "&quot;");

  form.innerHTML = `
    <div class="modal-box" style="min-width: 600px;">
      <h3>${title}</h3>

      <div class="form-grid">
        <div class="form-group full-width">
          <label>Quick-Fill from Customer</label>
          <select id="order-customer">
            <option value="">-- Select Customer --</option>
            ${customerOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Date</label>
          <input id="order-dateTime" value="${escapeVal(order.dateTime) || formattedDate}">
        </div>

        <div class="form-group">
          <label>Status / Category</label>
          <select id="order-status">
            <option value="">Undefined</option>
            <option value="Sold">Sold</option>
            <option value="In production">In production</option>
            <option value="Shipped">Shipped</option>
            <option value="Paid in Full">Paid in Full</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div class="form-group">
          <label>Customer Name *</label>
          <input id="order-customerName" placeholder="Customer Name" value="${escapeVal(order.customerName)}">
        </div>

        <div class="form-group">
          <label>Company</label>
          <input id="order-customerCompany" placeholder="Company" value="${escapeVal(order.customerCompany)}">
        </div>

        <div class="form-group">
          <label>Phone</label>
          <input id="order-customerPhone" placeholder="Phone" value="${escapeVal(order.customerPhone)}">
        </div>

        <div class="form-group">
          <label>Email</label>
          <input id="order-customerEmail" placeholder="Email" type="email" value="${escapeVal(order.customerEmail)}">
        </div>

        <div class="form-group full-width">
          <label>Billing Address</label>
          <input id="order-billingAddress" placeholder="Billing Address" value="${escapeVal(order.billingAddress)}">
        </div>

        <div class="form-group full-width">
          <label>Ship-To Address</label>
          <input id="order-shipTo" placeholder="Ship-To Address" value="${escapeVal(order.shipTo)}">
        </div>

        <div class="form-group">
          <label>Accounting Name - Number</label>
          <input id="order-AccountingNameAccountingNum" placeholder="Accounting Name - Number" value="${escapeVal(order.AccountingNameAccountingNum)}">
        </div>

        <div class="form-group">
          <label>Location</label>
          <input id="order-location" placeholder="Location" value="${escapeVal(order.location)}">
        </div>

        ${isMultiProductMode() ? `
        <div class="form-group full-width" id="order-products-section">
          <label style="font-size:1em; font-weight:700; margin-bottom:8px;">Product Lines</label>
          <table id="order-products-table" style="width:100%; margin-bottom:8px;">
            <thead>
              <tr>
                <th style="text-align:left;">Product</th>
                <th style="text-align:center; width:80px;">Qty</th>
                <th style="text-align:right; width:130px;">Unit Price</th>
                <th style="text-align:right; width:110px;">Subtotal</th>
                <th style="text-align:center; width:50px;"></th>
              </tr>
            </thead>
            <tbody id="order-products-body"></tbody>
          </table>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <button type="button" id="add-order-product" style="padding:8px 16px; font-size:0.88em; background:var(--success-color);">+ Add Product Line</button>
            <div id="order-products-total" style="font-weight:700; font-size:1.05em;"></div>
          </div>
        </div>
        ` : `
        <div class="form-group" id="order-unittype-group">
          <label>Unit Type</label>
          <input id="order-unitType" placeholder="Unit Type" value="${escapeVal(order.unitType || getDefaultProduct().name)}" ${getBusinessMode() === "single" ? 'readonly style="opacity:0.7; cursor:not-allowed;"' : ''}>
        </div>

        <div class="form-group">
          <label>Quantity *</label>
          <input id="order-quantity" type="number" placeholder="Quantity" min="1" value="${order.quantity || ''}">
        </div>
        `}

        <div class="form-group full-width">
          <label>Notes</label>
          <textarea id="order-notes" rows="3" placeholder="Order notes…" style="resize:vertical;">${escapeVal(order.notes)}</textarea>
        </div>
      </div>

      <div id="order-form-errors" style="color:var(--danger-color); font-size:0.88em; margin-top:8px; display:none;"></div>

      <div class="modal-actions">
        <button id="cancel" style="background: var(--border-color); color: var(--text-color);">Cancel</button>
        <button id="save" style="background: var(--success-color);">Save Order</button>
      </div>
    </div>
  `;

  document.body.appendChild(form);

  // Close on backdrop click
  form.addEventListener("click", (e) => { if (e.target === form) form.remove(); });

  // ── Multi-Product Mode: product line items in order form ──
  if (isMultiProductMode()) {
    const cur = getCurrency();
    const productsCatalog = dashboardData.products || [];
    const existingProducts = Array.isArray(order.orderProducts) ? order.orderProducts.map(p => ({ ...p })) : [];
    const orderProductLines = existingProducts.length > 0 ? existingProducts : [{ productName: productsCatalog.length > 0 ? productsCatalog[0].name : "", qty: 1, unitPrice: productsCatalog.length > 0 ? productsCatalog[0].defaultPrice : 0 }];

    // Store on the form element for save handler access
    form._orderProductLines = orderProductLines;

    function renderOrderProductLines() {
      const tbody = document.getElementById("order-products-body");
      if (!tbody) return;
      tbody.innerHTML = "";

      const catalogOptions = productsCatalog.map(p =>
        `<option value="${(p.name || "").replace(/"/g, "&quot;")}" data-price="${p.defaultPrice || 0}">${p.name || "Unnamed"}</option>`
      ).join("");

      orderProductLines.forEach((line, i) => {
        const subtotal = (line.qty || 0) * (line.unitPrice || 0);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            ${productsCatalog.length > 0 ? `
              <select class="op-product" data-idx="${i}" style="width:100%; padding:8px; border:2px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--input-text);">
                <option value="">-- Select --</option>
                ${catalogOptions}
              </select>
            ` : `
              <input type="text" class="op-product-text" data-idx="${i}" value="${(line.productName || "").replace(/"/g, "&quot;")}" placeholder="Product name" style="width:100%; padding:8px; border:2px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--input-text);">
            `}
          </td>
          <td style="text-align:center;">
            <input type="number" class="op-qty" data-idx="${i}" value="${line.qty || 1}" min="1" style="width:70px; padding:8px; border:2px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--input-text); text-align:center;">
          </td>
          <td style="text-align:right;">
            <input type="number" class="op-price" data-idx="${i}" value="${(line.unitPrice || 0).toFixed(2)}" step="0.01" min="0" style="width:110px; padding:8px; border:2px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--input-text); text-align:right;">
          </td>
          <td style="text-align:right; font-weight:600; padding:8px 12px; font-family:'Monaco','Courier New',monospace;">
            ${cur}${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="text-align:center;">
            ${orderProductLines.length > 1 ? `<button type="button" class="op-delete" data-idx="${i}" style="color:var(--danger-color); font-weight:bold; border:none; background:none; cursor:pointer; font-size:1.3em; padding:4px 8px; box-shadow:none;">✕</button>` : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Set select values for catalog dropdowns
      tbody.querySelectorAll(".op-product").forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        sel.value = orderProductLines[idx].productName || "";
      });

      // Wire events
      tbody.querySelectorAll(".op-product").forEach(sel => {
        sel.addEventListener("change", () => {
          const idx = parseInt(sel.dataset.idx);
          orderProductLines[idx].productName = sel.value;
          const selectedOpt = sel.selectedOptions[0];
          if (selectedOpt && selectedOpt.dataset.price) {
            orderProductLines[idx].unitPrice = parseFloat(selectedOpt.dataset.price) || 0;
          }
          renderOrderProductLines();
        });
      });

      tbody.querySelectorAll(".op-product-text").forEach(input => {
        input.addEventListener("input", () => {
          orderProductLines[parseInt(input.dataset.idx)].productName = input.value;
        });
      });

      tbody.querySelectorAll(".op-qty").forEach(input => {
        input.addEventListener("input", () => {
          orderProductLines[parseInt(input.dataset.idx)].qty = parseInt(input.value) || 1;
          renderOrderProductLines();
        });
      });

      tbody.querySelectorAll(".op-price").forEach(input => {
        input.addEventListener("input", () => {
          orderProductLines[parseInt(input.dataset.idx)].unitPrice = parseFloat(input.value) || 0;
          renderOrderProductLines();
        });
      });

      tbody.querySelectorAll(".op-delete").forEach(btn => {
        btn.addEventListener("click", () => {
          orderProductLines.splice(parseInt(btn.dataset.idx), 1);
          form._orderProductLines = orderProductLines;
          renderOrderProductLines();
        });
      });

      // Update total display
      const totalQty = orderProductLines.reduce((s, l) => s + (l.qty || 0), 0);
      const totalValue = orderProductLines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
      const totalEl = document.getElementById("order-products-total");
      if (totalEl) {
        totalEl.innerHTML = `${totalQty} unit${totalQty !== 1 ? 's' : ''} &middot; ${cur}${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }

    renderOrderProductLines();

    const addBtn = document.getElementById("add-order-product");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        orderProductLines.push({ productName: productsCatalog.length > 0 ? productsCatalog[0].name : "", qty: 1, unitPrice: productsCatalog.length > 0 ? productsCatalog[0].defaultPrice : 0 });
        form._orderProductLines = orderProductLines;
        renderOrderProductLines();
      });
    }
  }

  // Autofill customer data
  document.getElementById("order-customer").onchange = () => {
    const i = document.getElementById("order-customer").value;
    if (i !== "") {
      const c = dashboardData.customers[i];
      document.getElementById("order-customerName").value = c.name;
      document.getElementById("order-customerCompany").value = c.company;
      document.getElementById("order-customerPhone").value = c.phone;
      document.getElementById("order-customerEmail").value = c.email;
      document.getElementById("order-billingAddress").value = c.billingAddress;
      document.getElementById("order-shipTo").value = c.shipTo || "";
    }
  };

  // Preselect status if editing
  document.getElementById("order-status").value = order.status || "";

  document.getElementById("cancel").onclick = () => form.remove();

  document.getElementById("save").onclick = async () => {
    const errorsEl = document.getElementById("order-form-errors");
    const multiMode = isMultiProductMode();

    const baseFields = ["dateTime", "AccountingNameAccountingNum", "location"];
    if (!multiMode) {
      baseFields.push("unitType", "quantity");
    }
    const newOrder = {};

    baseFields.forEach(f => {
      const el = document.getElementById(`order-${f}`);
      newOrder[f] = el ? el.value.trim() : "";
    });

    newOrder.notes = document.getElementById("order-notes")?.value?.trim() || "";
    newOrder.status = document.getElementById("order-status").value || "Undefined";
    newOrder.customerName = document.getElementById("order-customerName").value.trim();
    newOrder.customerCompany = document.getElementById("order-customerCompany").value.trim();
    newOrder.customerPhone = document.getElementById("order-customerPhone").value.trim();
    newOrder.customerEmail = document.getElementById("order-customerEmail").value.trim();
    newOrder.billingAddress = document.getElementById("order-billingAddress").value.trim();
    newOrder.shipTo = document.getElementById("order-shipTo").value.trim();

    // Multi-product mode: gather product lines
    if (multiMode) {
      const productLines = form._orderProductLines || [];
      const validLines = productLines.filter(l => l.productName && l.qty > 0);
      if (!validLines.length) {
        errorsEl.innerHTML = "At least one product line is required.";
        errorsEl.style.display = "block";
        return;
      }
      newOrder.orderProducts = validLines.map(l => ({
        productName: l.productName,
        qty: l.qty || 1,
        unitPrice: l.unitPrice || 0
      }));
      newOrder.quantity = validLines.reduce((s, l) => s + (l.qty || 0), 0);
      newOrder.unitType = validLines.length === 1 ? validLines[0].productName : `${validLines.length} products`;
    } else {
      // Single mode: auto-assign default product if unitType is empty
      if (!newOrder.unitType) {
        newOrder.unitType = getDefaultProduct().name;
      }
    }

    // Validation
    const errors = [];
    if (!newOrder.customerName) errors.push("Customer Name is required.");
    if (!multiMode && (!newOrder.quantity || Number(newOrder.quantity) < 1)) errors.push("Quantity must be at least 1.");

    if (errors.length) {
      errorsEl.innerHTML = errors.join("<br>");
      errorsEl.style.display = "block";
      return;
    }

    const sel = document.getElementById("order-customer");
    newOrder.customerIndex = sel.value !== "" ? parseInt(sel.value) : null;

    if (editIndex !== undefined) {
      newOrder.orderNumber = dashboardData.orders[editIndex].orderNumber;
      newOrder.createdAt = dashboardData.orders[editIndex].createdAt;
      newOrder.id = dashboardData.orders[editIndex].id;
      newOrder.folderId = dashboardData.orders[editIndex].folderId;
      if (dashboardData.orders[editIndex].budget) newOrder.budget = dashboardData.orders[editIndex].budget;
      if (!multiMode && dashboardData.orders[editIndex].orderProducts) {
        newOrder.orderProducts = dashboardData.orders[editIndex].orderProducts;
      }
    } else {
      newOrder.folderId = folderId || currentOpenFolderId || null;
    }

    // Server-validated order save (falls back to local if API unavailable)
    if (window.dashboardAPI.createOrder && !editIndex && editIndex !== 0) {
      try {
        const result = await window.dashboardAPI.createOrder(newOrder);
        if (result.success) {
          dashboardData = await window.dashboardAPI.load() || dashboardData;
          form.remove();
          showToast("New order created!", "success");
          if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
          else renderOrdersPage();
          return;
        } else {
          errorsEl.innerHTML = (result.errors || [result.error || "Server error"]).join("<br>");
          errorsEl.style.display = "block";
          return;
        }
      } catch (e) {
        console.warn("Server order create unavailable, using local:", e.message);
      }
    }

    if (editIndex !== undefined && window.dashboardAPI.updateOrder) {
      try {
        const result = await window.dashboardAPI.updateOrder(newOrder.id, newOrder);
        if (result.success) {
          dashboardData = await window.dashboardAPI.load() || dashboardData;
          form.remove();
          showToast("Order updated successfully!", "success");
          if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
          else renderOrdersPage();
          return;
        }
      } catch (e) {
        console.warn("Server order update unavailable, using local:", e.message);
      }
    }

    // Fallback: local mutation (for Electron or standalone mode)
    if (editIndex !== undefined) {
      dashboardData.orders[editIndex] = newOrder;
    } else {
      newOrder.orderNumber = "ORD-" + Math.floor(1000 + Math.random() * 9000);
      newOrder.createdAt = Date.now();
      newOrder.id = crypto.randomUUID();
      dashboardData.orders.unshift(newOrder);
    }

    saveDashboard();
    form.remove();
    showToast(editIndex !== undefined ? "Order updated successfully!" : "New order created!", "success");
    if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
    else renderOrdersPage();
  };
}




function editOrder(i) { showOrderForm(i); }

async function deleteOrder(i) {
  const order = dashboardData.orders[i];
  if (!order) return;
  const orderNum = order.orderNumber || "this order";
  const confirmed = await showConfirm(`Move order ${orderNum} to Trash?`, "Move to Trash");
  if (confirmed) {
    const folder = order.folderId ? getFolderById(order.folderId) : null;
    moveToTrash("order", order, {
      folderName: folder ? folder.name : "",
      originalFolderId: order.folderId || null
    });
    dashboardData.orders.splice(i, 1);
    saveDashboard();
    showToast("Order moved to Trash", "warning");
    if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
    else renderOrdersPage();
  }
}

// Duplicate an order
function duplicateOrder(index) {
  const original = dashboardData.orders[index];
  if (!original) { showToast("Order not found!", "error"); return; }

  const clone = JSON.parse(JSON.stringify(original));
  clone.orderNumber = "ORD-" + Math.floor(1000 + Math.random() * 9000);
  clone.createdAt = Date.now();
  clone.id = crypto.randomUUID();
  clone.status = "Pending";
  clone.dateTime = formatDate(new Date().toISOString());
  delete clone.budget;

  dashboardData.orders.unshift(clone);
  saveDashboard();
  showToast(`Order duplicated as ${clone.orderNumber}`, "success");
  if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
  else renderOrdersPage();
}

async function duplicateOrderById(id) {
  const index = findOrderIndexById(id);
  if (index === -1) { showToast("Order not found!", "error"); return; }

  // Server-validated duplicate
  if (window.dashboardAPI.duplicateOrder) {
    try {
      const result = await window.dashboardAPI.duplicateOrder(id);
      if (result.success) {
        dashboardData = await window.dashboardAPI.load() || dashboardData;
        showToast(`Order duplicated as ${result.order.orderNumber}`, "success");
        if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
        else renderOrdersPage();
        return;
      }
    } catch (e) {
      console.warn("Server duplicate unavailable, using local:", e.message);
    }
  }

  // Fallback: local duplicate
  duplicateOrder(index);
}



// ---------------- INVOICE ----------------
function generateInvoice(index) {
  const order = dashboardData.orders[index];

  if (!order) {
    showToast("Order not found!", "error");
    return;
  }

  if (!order.budget) {
    showToast("Please create a budget for this order before generating an invoice.", "warning", 5000);
    return;
  }

  if (!window.dashboardAPI || !window.dashboardAPI.generateInvoice) {
    showToast("Invoice system not ready", "error");
    console.error("generateInvoice API missing");
    return;
  }

  // Prepare invoice data
  const hasMultiProducts = Array.isArray(order.orderProducts) && order.orderProducts.length > 0;
  const invoiceData = {
    orderNumber: order.orderNumber || "N/A",
    dateTime: formatDate(order.dateTime) || formatDate(new Date().toISOString()),
    AccountingNameAccountingNum: order.AccountingNameAccountingNum || "",
    location: order.location || "",
    unitType: order.unitType || "",
    quantity: order.quantity || 0,
    status: order.status || "",
    customerName: order.customerName || "",
    customerCompany: order.customerCompany || "",
    customerPhone: order.customerPhone || "",
    customerEmail: order.customerEmail || "",
    billingAddress: order.billingAddress || "",
    shipTo: order.shipTo || "",
    notes: order.notes || "",
    description: hasMultiProducts
      ? order.orderProducts.map(p => `${p.productName} (×${p.qty})`).join(", ")
      : (order.description || getSettings().invoiceDescription || "Provide temporary tankless gravity flushing sanitary waste assemblies. BrandSafway Part #M6474."),
    terms: order.terms || getSettings().invoiceTerms || "",
    budget: order.budget,
    companyName: getSettings().companyName || "",
    companyLogoPath: getSettings().companyLogoPath || ""
  };

  // Send data to main process via IPC
  window.dashboardAPI.generateInvoice(invoiceData)
    .then(filePath => {
      console.log("Invoice created:", filePath);
      showToast(`Invoice saved!\n${filePath}`, "success", 6000);
      if (getSettings().autoOpenInvoices && filePath) window.dashboardAPI.openFile(filePath);
    })
    .catch(err => {
      console.error("Invoice error:", err);
      showToast("Failed to generate invoice. Check console for details.", "error", 6000);
    });
}


// ---------------- CUSTOMERS PAGE ----------------
let customerSortCol = null;
let customerSortDir = "asc";

function renderCustomersPage() {
  if (!appDiv) {
    console.error("Cannot render customers page: appDiv not found");
    return;
  }
  
  window.currentPage = "customers";

  const totalCustomers = dashboardData.customers.length;

  appDiv.innerHTML = `
    <div>
      <h1>${t("customers")}</h1>
      <div style="font-size:0.88em; opacity:0.6; margin-top:-10px; margin-bottom:10px;">
        <strong>${totalCustomers}</strong> ${totalCustomers !== 1 ? t("customersOnFilePlural") : t("customersOnFile")}
      </div>
    </div>

    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <button id="addCust">${t("btnAddCustomer")}</button>
      <div class="search-wrapper">
        <input
          id="customerSearch"
          type="text"
          placeholder="${t("searchCustomers")}"
          style="padding:12px 20px; width:350px;"
        >
        <button class="search-clear" id="custSearchClear" style="display:none;" title="Clear search">✕</button>
      </div>
      <span class="search-count" id="custSearchCount"></span>
    </div>

    <div class="table-container">
      <table id="customersTable">
        <thead>
          <tr>
            <th class="sortable" data-col="id" style="width:60px;">ID</th>
            <th class="sortable" data-col="name">${t("thName")}</th>
            <th class="sortable" data-col="company">${t("thCompany")}</th>
            <th class="sortable" data-col="phone">${t("thPhone")}</th>
            <th class="sortable" data-col="email">${t("thEmail")}</th>
            <th class="sortable" data-col="billingAddress">${t("thBillingAddress")}</th>
            <th class="sortable" data-col="shipTo">${t("thShipTo")}</th>
            <th class="sortable" data-col="orderCount" style="text-align:center;">${t("thOrders")}</th>
            <th>${t("thActions")}</th>
          </tr>
        </thead>
        <tbody id="customersTableBody"></tbody>
      </table>
    </div>
  `;

  renderCustomerRows(dashboardData.customers);

  // Sortable headers (asc -> desc -> reset cycle)
  document.querySelectorAll("#customersTable th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (customerSortCol === col) {
        if (customerSortDir === "asc") {
          customerSortDir = "desc";
        } else {
          customerSortCol = null;
          customerSortDir = "asc";
        }
      } else {
        customerSortCol = col;
        customerSortDir = "asc";
      }
      document.querySelectorAll("#customersTable th.sortable").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
      if (customerSortCol) {
        th.classList.add(customerSortDir === "asc" ? "sort-asc" : "sort-desc");
      }
      const query = document.getElementById("customerSearch")?.value?.trim() || "";
      renderCustomerRows(query ? filterCustomers(query) : dashboardData.customers);
    });
  });

  // Search
  const searchInput = document.getElementById("customerSearch");
  const clearBtn = document.getElementById("custSearchClear");
  const countEl = document.getElementById("custSearchCount");

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    countEl.textContent = "";
    renderCustomerRows(dashboardData.customers);
    searchInput.focus();
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearBtn.style.display = query ? "block" : "none";
    if (!query) {
      countEl.textContent = "";
      renderCustomerRows(dashboardData.customers);
      return;
    }
    const filtered = filterCustomers(query);
    countEl.textContent = `${filtered.length} of ${dashboardData.customers.length}`;
    renderCustomerRows(filtered);
  });

  document.getElementById("addCust").onclick = () => showCustomerForm();
  renderNav("customers");
}

function filterCustomers(query) {
  const q = query.toLowerCase();
  return dashboardData.customers.filter(c =>
    [c.name, c.company, c.phone, c.email, c.billingAddress, c.shipTo]
      .filter(Boolean).join(" ").toLowerCase().includes(q)
  );
}

function getCustomerOrderCount(customerName) {
  if (!customerName) return 0;
  return dashboardData.orders.filter(o => (o.customerName || "").toLowerCase() === customerName.toLowerCase()).length;
}

function renderCustomerRows(customerList) {
  // Track for "Export Current" feature
  currentFilteredCustomers = customerList;

  const tbody = document.getElementById("customersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...customerList];
  if (customerSortCol) {
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (customerSortCol === "id") {
        aVal = a.id || 0;
        bVal = b.id || 0;
      } else if (customerSortCol === "orderCount") {
        aVal = getCustomerOrderCount(a.name);
        bVal = getCustomerOrderCount(b.name);
      } else {
        aVal = (a[customerSortCol] || "").toString().toLowerCase();
        bVal = (b[customerSortCol] || "").toString().toLowerCase();
      }
      if (aVal < bVal) return customerSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return customerSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; opacity:0.5;">No customers found</td></tr>`;
    return;
  }

  sorted.forEach(c => {
    const realIndex = dashboardData.customers.indexOf(c);
    const orderCount = getCustomerOrderCount(c.name);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600; opacity:0.6;">${c.id || realIndex + 1}</td>
      <td style="font-weight:600;">${c.name || ""}</td>
      <td>${c.company || ""}</td>
      <td>${c.phone || ""}</td>
      <td>${c.email || ""}</td>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(c.billingAddress || '').replace(/"/g, '&quot;')}">${c.billingAddress || ""}</td>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(c.shipTo || '').replace(/"/g, '&quot;')}">${c.shipTo || ""}</td>
      <td style="text-align:center;">
        <span style="padding:3px 10px; background:${orderCount > 0 ? 'var(--info-color)' : 'var(--border-color)'}; color:${orderCount > 0 ? 'white' : 'var(--text-color)'}; border-radius:12px; font-size:0.85em; font-weight:600;">${orderCount}</span>
      </td>
      <td style="white-space:nowrap;">
        <button onclick="editCustomer(${realIndex})" style="background:var(--warning-color); padding:8px 12px;" title="Edit">✏️</button>
        <button onclick="deleteCustomer(${realIndex})" style="background:var(--danger-color); padding:8px 12px;" title="Delete">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------- CUSTOMER FORM ----------------
function showCustomerForm(editIndex = undefined) {
  const form = document.createElement("div");
  form.className = "modal";
  const cust = editIndex !== undefined ? { ...dashboardData.customers[editIndex] } : { name: "", company: "", phone: "", email: "", billingAddress: "", shipTo: "" };
  const title = editIndex !== undefined ? "Edit Customer" : "New Customer";
  const escapeVal = (v) => (v || "").replace(/"/g, "&quot;");

  form.innerHTML = `
    <div class="modal-box" style="min-width:520px;">
      <h3>${title}</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Name *</label>
          <input id="cust-name" placeholder="Full Name" value="${escapeVal(cust.name)}">
        </div>
        <div class="form-group">
          <label>Company</label>
          <input id="cust-company" placeholder="Company Name" value="${escapeVal(cust.company)}">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input id="cust-phone" placeholder="(555) 123-4567" value="${escapeVal(cust.phone)}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input id="cust-email" placeholder="email@example.com" type="email" value="${escapeVal(cust.email)}">
        </div>
        <div class="form-group full-width">
          <label>Billing Address</label>
          <input id="cust-billing" placeholder="Billing Address" value="${escapeVal(cust.billingAddress)}">
        </div>
        <div class="form-group full-width">
          <label>Ship-To Address</label>
          <input id="cust-shipto" placeholder="Ship-To Address" value="${escapeVal(cust.shipTo)}">
        </div>
      </div>
      <div id="cust-form-errors" style="color:var(--danger-color); font-size:0.88em; margin-top:8px; display:none;"></div>
      <div class="modal-actions">
        <button id="cancelCust" style="background:var(--border-color); color:var(--text-color);">Cancel</button>
        <button id="saveCust" style="background:var(--success-color);">Save Customer</button>
      </div>
    </div>
  `;
  document.body.appendChild(form);

  form.addEventListener("click", (e) => { if (e.target === form) form.remove(); });

  document.getElementById("cancelCust").onclick = () => form.remove();
  document.getElementById("saveCust").onclick = () => {
    const errorsEl = document.getElementById("cust-form-errors");
    const name = document.getElementById("cust-name").value.trim();

    if (!name) {
      errorsEl.textContent = "Customer name is required.";
      errorsEl.style.display = "block";
      return;
    }

    const newCust = {
      id: editIndex !== undefined ? dashboardData.customers[editIndex].id : dashboardData.customers.length + 1,
      name: name,
      company: document.getElementById("cust-company").value.trim(),
      phone: document.getElementById("cust-phone").value.trim(),
      email: document.getElementById("cust-email").value.trim(),
      billingAddress: document.getElementById("cust-billing").value.trim(),
      shipTo: document.getElementById("cust-shipto").value.trim()
    };
    if (editIndex !== undefined) dashboardData.customers[editIndex] = newCust;
    else dashboardData.customers.push(newCust);
    saveDashboard();
    form.remove();
    showToast(editIndex !== undefined ? "Customer updated!" : "New customer added!", "success");
    renderCustomersPage();
  };
}

function editCustomer(i) { showCustomerForm(i); }

async function deleteCustomer(i) {
  const customer = dashboardData.customers[i];
  if (!customer) return;
  const name = customer.name || "this customer";
  if (await showConfirm(`Move ${name} to Trash?`, "Move to Trash")) {
    moveToTrash("customer", customer);
    dashboardData.customers.splice(i, 1);
    saveDashboard();
    showToast("Customer moved to Trash", "warning");
    renderCustomersPage();
  }
}

// ---------------- INVENTORY PAGE ----------------
let inventoryFilter = "all"; // "all", "low", "surplus", "balanced"
let inventorySortCol = null;
let inventorySortDir = "asc";

function renderInventoryPage() {
  if (!appDiv) {
    console.error("Cannot render inventory page: appDiv not found");
    return;
  }

  window.currentPage = "inventory";

  if (!Array.isArray(dashboardData.inventory)) dashboardData.inventory = [];

  const inv = dashboardData.inventory;
  const totalItems = inv.length;
  const lowStock = inv.filter(i => (i.required || 0) - (i.inStock || 0) > 0).length;
  const surplus = inv.filter(i => (i.required || 0) - (i.inStock || 0) < 0).length;
  const balanced = inv.filter(i => (i.required || 0) - (i.inStock || 0) === 0).length;

  appDiv.innerHTML = `
    <div>
      <h1>${t("inventory")}</h1>
      <div style="font-size:0.88em; opacity:0.6; margin-top:-10px; margin-bottom:10px;">
        <strong>${totalItems}</strong> ${t("materialsTracked")}
      </div>
    </div>

    <div class="inv-stats">
      <div class="inv-stat">
        <span class="stat-num" style="color:var(--text-color);">${totalItems}</span>
        ${t("totalItemsLabel")}
      </div>
      <div class="inv-stat">
        <span class="stat-num" style="color:var(--danger-color);">${lowStock}</span>
        ${t("lowStockLabel")}
      </div>
      <div class="inv-stat">
        <span class="stat-num" style="color:var(--success-color);">${surplus}</span>
        ${t("surplusLabel")}
      </div>
      <div class="inv-stat">
        <span class="stat-num" style="color:var(--info-color);">${balanced}</span>
        ${t("balancedLabel")}
      </div>
    </div>

    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
      <button id="inv-add">${t("btnAddItem")}</button>
      <div class="search-wrapper">
        <input
          id="inventorySearch"
          type="text"
          placeholder="Search materials…"
          style="padding:12px 20px; width:300px;"
        >
        <button class="search-clear" id="invSearchClear" style="display:none;" title="Clear search">✕</button>
      </div>

      <div class="filter-tabs">
        <button class="filter-tab ${inventoryFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-tab ${inventoryFilter === 'low' ? 'active' : ''}" data-filter="low" style="${lowStock > 0 ? '' : 'opacity:0.4;'}">${t("lowStockLabel")} (${lowStock})</button>
        <button class="filter-tab ${inventoryFilter === 'surplus' ? 'active' : ''}" data-filter="surplus">${t("surplusLabel")} (${surplus})</button>
        <button class="filter-tab ${inventoryFilter === 'balanced' ? 'active' : ''}" data-filter="balanced">${t("balancedLabel")} (${balanced})</button>
      </div>
    </div>

    <div class="table-container">
      <table id="inventory-table">
        <thead>
          <tr>
            <th class="sortable" data-col="material">${t("thMaterial")}</th>
            <th class="sortable" data-col="inStock" style="text-align:right;">${t("thInStock")}</th>
            <th class="sortable" data-col="required" style="text-align:right;">${t("thRequired")}</th>
            <th class="sortable" data-col="delta" style="text-align:right;">${t("thDelta")}</th>
            <th style="text-align:center;">${t("thStatus")}</th>
            <th style="text-align:center;">${t("thActions")}</th>
          </tr>
        </thead>
        <tbody id="inv-tbody"></tbody>
      </table>
    </div>
  `;

  renderInventoryRows();

  // Sortable inventory headers (asc -> desc -> reset)
  document.querySelectorAll("#inventory-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (inventorySortCol === col) {
        if (inventorySortDir === "asc") {
          inventorySortDir = "desc";
        } else {
          inventorySortCol = null;
          inventorySortDir = "asc";
        }
      } else {
        inventorySortCol = col;
        inventorySortDir = "asc";
      }
      document.querySelectorAll("#inventory-table th.sortable").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
      if (inventorySortCol) {
        th.classList.add(inventorySortDir === "asc" ? "sort-asc" : "sort-desc");
      }
      renderInventoryRows();
    });
  });

  // Filter tabs
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      inventoryFilter = tab.dataset.filter;
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderInventoryRows();
    });
  });

  // Search
  const searchInput = document.getElementById("inventorySearch");
  const clearBtn = document.getElementById("invSearchClear");

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    renderInventoryRows();
    searchInput.focus();
  });

  searchInput.addEventListener("input", () => {
    clearBtn.style.display = searchInput.value ? "block" : "none";
    renderInventoryRows();
  });

  document.getElementById("inv-add").onclick = () => {
    dashboardData.inventory.push({
      id: crypto.randomUUID(),
      material: "",
      inStock: 0,
      required: 0
    });
    saveDashboard();
    renderInventoryRows();
  };

  renderNav("inventory");
}

function updateInventoryStats() {
  const inv = dashboardData.inventory || [];
  const totalItems = inv.length;
  const lowStock = inv.filter(i => (i.required || 0) - (i.inStock || 0) > 0).length;
  const surplus = inv.filter(i => (i.required || 0) - (i.inStock || 0) < 0).length;
  const balanced = inv.filter(i => (i.required || 0) - (i.inStock || 0) === 0).length;

  // Update stat badges
  const statEls = document.querySelectorAll(".inv-stat .stat-num");
  if (statEls.length >= 4) {
    statEls[0].textContent = totalItems;
    statEls[1].textContent = lowStock;
    statEls[2].textContent = surplus;
    statEls[3].textContent = balanced;
  }

  // Update filter tab counts
  const tabs = document.querySelectorAll(".filter-tab");
  tabs.forEach(tab => {
    const filter = tab.dataset.filter;
    if (filter === "all") tab.textContent = "All";
    else if (filter === "low") { tab.textContent = `Low Stock (${lowStock})`; tab.style.opacity = lowStock > 0 ? "" : "0.4"; }
    else if (filter === "surplus") tab.textContent = `Surplus (${surplus})`;
    else if (filter === "balanced") tab.textContent = `Balanced (${balanced})`;
  });

  // Update subtitle
  const subtitle = appDiv.querySelector("div > div[style*='opacity:0.6']");
  if (subtitle) subtitle.innerHTML = `<strong>${totalItems}</strong> materials tracked`;
}

function renderInventoryRows() {
  const tbody = document.getElementById("inv-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Refresh stats every time rows re-render
  updateInventoryStats();

  const searchQuery = (document.getElementById("inventorySearch")?.value || "").trim().toLowerCase();

  let filteredInventory = dashboardData.inventory.map((item, origIdx) => ({ ...item, _origIdx: origIdx }));

  // Apply text search
  if (searchQuery) {
    filteredInventory = filteredInventory.filter(item =>
      (item.material || "").toLowerCase().includes(searchQuery)
    );
  }

  // Apply filter tab
  if (inventoryFilter === "low") {
    filteredInventory = filteredInventory.filter(item => (item.required || 0) - (item.inStock || 0) > 0);
  } else if (inventoryFilter === "surplus") {
    filteredInventory = filteredInventory.filter(item => (item.required || 0) - (item.inStock || 0) < 0);
  } else if (inventoryFilter === "balanced") {
    filteredInventory = filteredInventory.filter(item => (item.required || 0) - (item.inStock || 0) === 0);
  }

  // Apply sorting
  if (inventorySortCol) {
    filteredInventory.sort((a, b) => {
      let aVal, bVal;
      if (inventorySortCol === "material") {
        aVal = (a.material || "").toLowerCase();
        bVal = (b.material || "").toLowerCase();
      } else if (inventorySortCol === "inStock") {
        aVal = a.inStock || 0;
        bVal = b.inStock || 0;
      } else if (inventorySortCol === "required") {
        aVal = a.required || 0;
        bVal = b.required || 0;
      } else if (inventorySortCol === "delta") {
        aVal = (a.required || 0) - (a.inStock || 0);
        bVal = (b.required || 0) - (b.inStock || 0);
      }
      if (aVal < bVal) return inventorySortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return inventorySortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  if (!filteredInventory.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; opacity:0.5;">No inventory items found</td></tr>`;
    return;
  }

  filteredInventory.forEach(item => {
    const i = item._origIdx;
    const delta = (item.required || 0) - (item.inStock || 0);
    const isSurplus = delta < 0;
    const isLow = delta > 0;
    const deltaDisplay = isSurplus ? `(${Math.abs(delta)})` : String(delta);
    const deltaColor = isSurplus ? "var(--success-color)" : isLow ? "var(--danger-color)" : "inherit";

    let statusBadge;
    if (isLow) {
      statusBadge = `<span class="stock-badge deficit">Low Stock</span>`;
    } else if (isSurplus) {
      statusBadge = `<span class="stock-badge surplus">Surplus</span>`;
    } else {
      statusBadge = `<span class="stock-badge balanced">OK</span>`;
    }

    const tr = document.createElement("tr");
    if (isLow) tr.className = "low-stock";
    tr.innerHTML = `
      <td>
        <input type="text" class="inv-material" data-idx="${i}"
               value="${item.material || ""}"
               placeholder="Material name…"
               style="width: 100%; padding: 8px 12px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--input-bg); color: var(--input-text);">
      </td>
      <td style="text-align:right;">
        <input type="number" class="inv-instock" data-idx="${i}"
               value="${item.inStock || 0}" min="0"
               style="width: 100px; padding: 8px 12px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--input-bg); color: var(--input-text); text-align: right;">
      </td>
      <td style="text-align:right;">
        <input type="number" class="inv-required" data-idx="${i}"
               value="${item.required || 0}" min="0"
               style="width: 100px; padding: 8px 12px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--input-bg); color: var(--input-text); text-align: right;">
      </td>
      <td style="text-align: right; font-weight: bold; color: ${deltaColor}; padding: 8px 16px; font-size: 1.1em; font-family: 'Monaco', 'Courier New', monospace;">
        ${deltaDisplay}
      </td>
      <td style="text-align: center;">
        ${statusBadge}
      </td>
      <td style="text-align: center;">
        <button class="inv-delete" data-idx="${i}" style="background:var(--danger-color); padding:8px 12px;" title="Delete">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Live editing – Material
  tbody.querySelectorAll(".inv-material").forEach(input => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.idx);
      dashboardData.inventory[idx].material = input.value.trim();
      saveDashboard();
    });
  });

  // Live editing – In Stock
  tbody.querySelectorAll(".inv-instock").forEach(input => {
    input.addEventListener("input", () => {
      const idx = parseInt(input.dataset.idx);
      dashboardData.inventory[idx].inStock = parseInt(input.value) || 0;
      saveDashboard();
      updateDeltaCell(input, idx);
    });
  });

  // Live editing – Required
  tbody.querySelectorAll(".inv-required").forEach(input => {
    input.addEventListener("input", () => {
      const idx = parseInt(input.dataset.idx);
      dashboardData.inventory[idx].required = parseInt(input.value) || 0;
      saveDashboard();
      updateDeltaCell(input, idx);
    });
  });

  // Delete buttons
  tbody.querySelectorAll(".inv-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx);
      const item = dashboardData.inventory[idx];
      if (!item) return;
      const name = item.material || "this item";
      const confirmed = await showConfirm(`Move ${name} to Trash?`, "Move to Trash");
      if (confirmed) {
        moveToTrash("inventory", item);
        dashboardData.inventory.splice(idx, 1);
        saveDashboard();
        showToast("Inventory item moved to Trash", "warning");
        renderInventoryRows();
      }
    });
  });
}

function updateDeltaCell(input, idx) {
  const item = dashboardData.inventory[idx];
  const delta = (item.required || 0) - (item.inStock || 0);
  const isSurplus = delta < 0;
  const isLow = delta > 0;
  const deltaDisplay = isSurplus ? `(${Math.abs(delta)})` : String(delta);
  const deltaColor = isSurplus ? "var(--success-color)" : isLow ? "var(--danger-color)" : "inherit";

  const row = input.closest("tr");
  const cells = row.querySelectorAll("td");

  // Update delta cell
  const deltaCell = cells[3];
  if (deltaCell) {
    deltaCell.textContent = deltaDisplay;
    deltaCell.style.color = deltaColor;
  }

  // Update status badge cell
  const statusCell = cells[4];
  if (statusCell) {
    if (isLow) {
      statusCell.innerHTML = `<span class="stock-badge deficit">Low Stock</span>`;
    } else if (isSurplus) {
      statusCell.innerHTML = `<span class="stock-badge surplus">Surplus</span>`;
    } else {
      statusCell.innerHTML = `<span class="stock-badge balanced">OK</span>`;
    }
  }

  // Update row highlighting
  row.className = isLow ? "low-stock" : "";

  // Refresh the stats bar and filter tab counts
  updateInventoryStats();
}


// Helper: find real array index by id
function findOrderIndexById(id) {
  return dashboardData.orders.findIndex(o => o.id === id);
}

// Toggle card collapse (h2 header click)
function toggleTableCollapse(tableId) {
  tableCollapseState[tableId] = !tableCollapseState[tableId];

  // When collapsing, reset the visible row count to 10
  if (tableCollapseState[tableId]) {
    tableVisibleRows[tableId] = 10;
  }

  const cardBody = document.getElementById('cardBody-' + tableId);
  const h2 = cardBody && cardBody.previousElementSibling;

  if (cardBody && h2) {
    if (tableCollapseState[tableId]) {
      cardBody.style.display = 'none';
      h2.classList.add('collapsed');
    } else {
      cardBody.style.display = 'block';
      h2.classList.remove('collapsed');
      if (tableId === 'costVsSell') renderCostVsSellChart();
      if (tableId === 'customerProfit') renderCustomerProfitability();
    }
  }
}

// Toggle inner table collapse (table header bar click)
function toggleInnerTable(tableId) {
  innerTableCollapse[tableId] = !innerTableCollapse[tableId];
  const collapsed = innerTableCollapse[tableId];

  if (collapsed) {
    tableVisibleRows[tableId] = 10;
  }

  const wrap = document.getElementById('innerWrap-' + tableId);
  if (!wrap) return;
  const header = wrap.querySelector('.inner-table-header');
  const table = wrap.querySelector('table');
  if (header && table) {
    table.style.display = collapsed ? 'none' : 'table';
    if (collapsed) {
      header.classList.add('collapsed');
    } else {
      header.classList.remove('collapsed');
    }
  }
}

// Show more rows (10 at a time)
function showMoreRows(tableId) {
  tableVisibleRows[tableId] += 10;
  
  if (tableId === 'costVsSell') {
    renderCostVsSellChart();
  } else if (tableId === 'customerProfit') {
    renderCustomerProfitability();
  }
}



// ── Safe versions of your action functions ──

function openBudgetById(id) {
  const index = findOrderIndexById(id);
  if (index === -1) {
    showToast("Order not found!", "error");
    return;
  }
  openBudget(index);
}

function generateInvoiceById(id) {
  const index = findOrderIndexById(id);
  if (index === -1) {
    showToast("Order not found!", "error");
    return;
  }
  generateInvoice(index);
}

function editOrderById(id) {
  const index = findOrderIndexById(id);
  if (index === -1) {
    showToast("Order not found!", "error");
    return;
  }
  showOrderForm(index);
}

async function deleteOrderById(id) {
  const index = findOrderIndexById(id);
  if (index === -1) {
    showToast("Order not found!", "error");
    return;
  }

  const order = dashboardData.orders[index];
  const orderNum = order.orderNumber || "this order";
  const confirmed = await showConfirm(`Move order ${orderNum} to Trash?`, "Move to Trash");
  if (confirmed) {
    // Server-validated delete (moves to trash server-side)
    if (window.dashboardAPI.deleteOrder) {
      try {
        const result = await window.dashboardAPI.deleteOrder(id);
        if (result.success) {
          dashboardData = await window.dashboardAPI.load() || dashboardData;
          showToast("Order moved to Trash", "warning");
          if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
          else renderOrdersPage();
          return;
        }
      } catch (e) {
        console.warn("Server delete unavailable, using local:", e.message);
      }
    }

    // Fallback: local delete
    const folder = order.folderId ? getFolderById(order.folderId) : null;
    moveToTrash("order", order, {
      folderName: folder ? folder.name : "",
      originalFolderId: order.folderId || null
    });
    dashboardData.orders.splice(index, 1);
    saveDashboard();
    showToast("Order moved to Trash", "warning");
    if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
    else renderOrdersPage();
  }
}

// ---------------- INITIAL LOAD ---------------- 
// Dashboard will be rendered after data loads (see load() promise above)
