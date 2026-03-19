(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════

  let dsCanvas = null;
  let pageBackground = null;
  let pageWidth = 1080;
  let pageHeight = 1080;
  let zoomLevel = 1;
  let gridEnabled = false;
  let snapEnabled = true;
  let undoStack = [];
  let redoStack = [];
  let savingHistory = false;
  let clipboard = null;
  let isPanning = false;
  let lastPanPoint = null;
  let spaceHeld = false;
  let previousPage = null;
  let resizeObserver = null;
  let objectCounter = 0;
  let currentDesignId = null;
  let currentDesignName = '';
  let bgMode = 'solid';
  let bgSolidColor = '#ffffff';
  let bgGradColor1 = '#4f46e5';
  let bgGradColor2 = '#8b5cf6';
  let bgGradAngle = 180;

  const GRID_SIZE = 25;
  const SNAP_THRESHOLD = 8;
  const MAX_HISTORY = 40;

  // ═══════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════

  const PRESETS = {
    'instagram-post': { name: 'Instagram Post', width: 1080, height: 1080 },
    'instagram-story': { name: 'Instagram Story', width: 1080, height: 1920 },
    'facebook-post': { name: 'Facebook Post', width: 1200, height: 630 },
    'twitter-post': { name: 'Twitter / X Post', width: 1200, height: 675 },
    'youtube-thumb': { name: 'YouTube Thumbnail', width: 1280, height: 720 },
    'presentation': { name: 'Presentation 16:9', width: 1920, height: 1080 },
    'logo': { name: 'Logo', width: 500, height: 500 },
    'business-card': { name: 'Business Card', width: 1050, height: 600 },
    'flyer': { name: 'Flyer (8.5 × 11)', width: 1275, height: 1650 },
    'a4': { name: 'A4 Document', width: 794, height: 1123 },
    'us-letter': { name: 'US Letter', width: 816, height: 1056 },
    'poster': { name: 'Poster (18 × 24)', width: 900, height: 1200 },
  };

  const FONTS = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
    'Verdana', 'Impact', 'Trebuchet MS', 'Tahoma', 'Lucida Console',
    'Palatino Linotype', 'Garamond',
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
    'Playfair Display', 'Raleway', 'Oswald',
  ];

  const SVG_ICONS = {
    'arrow-right': 'M5 12h14M13 6l6 6-6 6',
    'arrow-up': 'M12 19V5M6 11l6-6 6 6',
    'check': 'M4 12l5 5L20 7',
    'x-mark': 'M6 6l12 12M18 6L6 18',
    'heart': 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z',
    'star': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    'home': 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10',
    'user': 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
    'mail': 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
    'phone': 'M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 2.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.05 12.05 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.05 12.05 0 002.81.7A2 2 0 0122 16.92z',
    'location': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7a3 3 0 100 6 3 3 0 000-6z',
    'search': 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    'clock': 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2',
    'camera': 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a5 5 0 100-10 5 5 0 000 10z',
    'lightning': 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
    'sun': 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
    'cloud': 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
    'flag': 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
    'music': 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
    'wifi': 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  };

  // ═══════════════════════════════════════════════════════════
  // DESIGN ASSET LIBRARY
  // ═══════════════════════════════════════════════════════════

  var DS_ASSET_BASE = 'assets/design-elements/';

  var DS_ASSET_CATEGORIES = [
    { id: 'all', label: 'All', folder: null },
    { id: 'food', label: 'Food & Baking', folder: 'Baking_Food', tags: 'food baking cook chef kitchen bakery cake dessert breakfast donut ice cream cheese egg honey pepper knife blender hamburger shop' },
    { id: 'bathroom', label: 'Bathroom', folder: 'Bathroom', tags: 'bathroom bath toilet shower soap wash towel clean hygiene comb hair dryer razor sink toothbrush toothpaste mirror tub laundry duck' },
    { id: 'business', label: 'Business', folder: 'Business', tags: 'business office work company meeting chart data report mail phone computer calendar statistics finance money' },
    { id: 'design', label: 'Design', folder: 'Design_Icons', tags: 'design ui ux icon app interface graphic creative art badge camera phone chat coffee label laptop monitor' },
    { id: 'health', label: 'Health & Fitness', folder: 'Health_Fitness', tags: 'health fitness gym exercise fruit food diet nutrition run sport boxing dumbbell scale weight' },
    { id: 'icons', label: 'Icons', folder: 'Icons', tags: 'icon ui interface app symbol bluetooth bookmark cloud gift key link lock music search settings wifi video trophy' },
    { id: 'medical', label: 'Medical', folder: 'Medicine_Medical', tags: 'medical medicine doctor nurse hospital health clinic ambulance stethoscope capsule pill syringe inject microscope wheelchair' },
    { id: 'nature', label: 'Nature', folder: 'Nature', tags: 'nature tree plant leaf flower animal bird deer fox flamingo cactus mountain forest garden pineapple bush' },
    { id: 'office', label: 'Office', folder: 'Office', tags: 'office work desk printer calculator copy document table chart ruler usb format' },
    { id: 'science', label: 'Science', folder: 'Science', tags: 'science biology dna gene cell bacteria chromosome helix molecular nucleus protein lab research genetic' },
    { id: 'travel', label: 'Travel', folder: 'Travel', tags: 'travel vacation trip holiday airplane flight hotel bag suitcase map passport camera compass tent parasol sailboat balloon train' },
  ];

  var DS_ASSET_FILES = {
    'Baking_Food': ['bakery-breakfast-dessert','bakery','birthday-cake','blender','break-eggs','cheese','chef-man-cap','donuts-cake','grater','hat-chef','honey','humberger','ice-cream-cone','knife-cheese','knife','napkin','note','pepper','shop','water-container'],
    'Bathroom': ['body-wash','comb','detergent','duck','garbage-can','hair-dryer','laundry-detergent','mirror','mouthwash-cup','razor','sink','soap','toilet-paper','toilet-suction','toilet','toothbrush','toothpaste','towel','tub','washing-machine'],
    'Business': ['address','analyze','bank','bookshelf','business-card','business','calculator','calendar','cell-phone','column-chart','company','computer','conversation','creativity','data-buried','data','database','distributed','document','figure','indicator','introduce','light_bulb','mail','map','medal','network','notify','office','order','photo','pie-chart','planning','project','report','rocket','set-up','statistics','thumbs-up','trophy','upload'],
    'Design_Icons': ['article','badge','broadcast','browse','calendar','camera-take-pictures','camera','card-holder','cell-phone','chat-chat','coffee','collect','coupons','date','diagnosis','document','earphone','eye-password-eye-password','feet','food','game','gas-station','gift','headphones-music','histogram','honor','information','inspiration','key-password','label','laptop','line-graph','location','magnifying-glass-find-search','microphone-singing','monitor','movie','opinion','pencil-revision','personal-account-account','picture','pie-chart','question-and-answer','record','reminder-alert','savings','schedule','set-up','setting','shopping-cart','shopping','sim-card','social-contact','store-homepage-home','table-of-contents','target','time','tips','toolbox','transportation','upload','user','video','weather'],
    'Health_Fitness': ['apple','avocado','banana','boxing','cherry','coffee','dumbbel','fish','grape','kiwi-fruit','lemon','milk','peach','poached-eggs','running','soda-water','steak','watermelon','weighing-scale'],
    'Icons': ['adjust','application','bluetooth','bookmark','browse_eye','calculator','cd','check-in','cloud','collect','credit-report','currency-exchange','customer-service','delete','deposit','dial','document','earphone','female','financial-security','folder','forward','front-page_home','gift','help','hint','information','key','like','link','loan','location','lock','male','market-analysis','menu','message-center','mike_mic_microphone','mobile-phone-binding','mobile-phone-transfer','music','open-an-account','password-management','pen','personal','picture','play','provident-fund-inquiry','report','risk-assessment','search','set-up','share','shopping','sound_audio','stock-movement','subscription','switch_on_off','take-pictures','the-internet','thumbs-up','time','transaction-record','trophy_Icon','value','verified','video','vip','wifi'],
    'Medicine_Medical': ['ambulance','beaker','capsule','clinic-building','doctor','electrocardiogram','folder','infusion','inject','location','medicine-bottle','medicine-chest','medicine-icon','microscope','nurse','ointment','stethoscope','telephone','wheelchair'],
    'Nature': ['bird','branch','bushes-of-leaves','cactus-2','cactus','deer','flamingo','fox','leaf','leaves-2','leaves-3','leaves-4','leaves-5','pineapple','potted-cactus','shape-embellishment','snow-mountain','tree-2','tree'],
    'Office': ['align-two-columns','calculator','copy','document-lock','format-painter','global-display','help','horizontal-ruler','insert-table','insert-word','look-up','picture','pie-chart','printer','scaling-ratio','set-up','to-cut','trend-analysis','u-disk-data-logger','vertical-ruler'],
    'Science': ['bacteria','cell','chromosome','double-helix','gene-sequence','gene-sequencing','gene-structure','genetic-algorithm','genetic-data','genetic-engineering','genetic-research','genetic-test-report','genetically-modified','microorganism','molecular','nucleus','organic-organism','protein','ribosome','supercoil'],
    'Travel': ['air-ticket','bag','bank-card','bbq','building','camera','coconut-tree','compass','diving-goggles','drinks','glasses','hat','high-speed-rail','hot-air-balloon','hotel','map','medicine-bottle','pants-svgrepo-com','parasol','passport','sailboat','suitcase','swimsuit','tent'],
  };

  function dsGetAllAssets() {
    var all = [];
    DS_ASSET_CATEGORIES.forEach(function (cat) {
      if (!cat.folder) return;
      var files = DS_ASSET_FILES[cat.folder] || [];
      files.forEach(function (f) {
        all.push({ file: f, folder: cat.folder, catId: cat.id, tags: cat.tags || '', path: DS_ASSET_BASE + cat.folder + '/' + f + '.svg' });
      });
    });
    return all;
  }

  var _dsAllAssets = null;
  function dsAssets() {
    if (!_dsAllAssets) _dsAllAssets = dsGetAllAssets();
    return _dsAllAssets;
  }

  // ═══════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════

  var DS_STORAGE_KEY = 'ds_saved_designs';

  function generateId() { return 'ds_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }

  function getSavedDesigns() {
    try { return JSON.parse(localStorage.getItem(DS_STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function persistDesigns(arr) { localStorage.setItem(DS_STORAGE_KEY, JSON.stringify(arr)); }

  function generateThumbnail() {
    if (!dsCanvas) return null;
    dsCanvas.discardActiveObject();
    dsCanvas.requestRenderAll();
    var origVPT = dsCanvas.viewportTransform.slice();
    var origW = dsCanvas.getWidth();
    var origH = dsCanvas.getHeight();
    var origBg = dsCanvas.backgroundColor;
    dsCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    dsCanvas.setDimensions({ width: pageWidth, height: pageHeight });
    dsCanvas.backgroundColor = 'transparent';
    dsCanvas.renderAll();
    var scale = Math.min(250 / pageWidth, 250 / pageHeight);
    var url = dsCanvas.toDataURL({ format: 'jpeg', quality: 0.65, multiplier: scale });
    dsCanvas.viewportTransform = origVPT;
    dsCanvas.setDimensions({ width: origW, height: origH });
    dsCanvas.backgroundColor = origBg;
    dsCanvas.renderAll();
    return url;
  }

  // ═══════════════════════════════════════════════════════════
  // GRADIENT UTILITIES
  // ═══════════════════════════════════════════════════════════

  function gradCoords(w, h, angle) {
    var rad = angle * Math.PI / 180;
    return {
      x1: w / 2 - Math.cos(rad) * w / 2,
      y1: h / 2 - Math.sin(rad) * h / 2,
      x2: w / 2 + Math.cos(rad) * w / 2,
      y2: h / 2 + Math.sin(rad) * h / 2,
    };
  }

  function makeGradient(w, h, c1, c2, angle) {
    var c = gradCoords(w, h, angle);
    return new fabric.Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords: c,
      colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }],
    });
  }

  function readFillState(obj) {
    var fill = obj.fill;
    if (fill && typeof fill === 'object' && fill.colorStops) {
      var cs = fill.colorStops;
      var c1 = (cs[0] && cs[0].color) || '#000000';
      var c2 = (cs[1] && cs[1].color) || '#ffffff';
      var coords = fill.coords || {};
      var dx = (coords.x2 || 0) - (coords.x1 || 0);
      var dy = (coords.y2 || 0) - (coords.y1 || 0);
      var a = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
      if (a < 0) a += 360;
      return { mode: 'gradient', color1: c1, color2: c2, angle: a };
    }
    return { mode: 'solid', color: safeColor(fill || '#000000') };
  }

  // ═══════════════════════════════════════════════════════════
  // ENTRY POINTS
  // ═══════════════════════════════════════════════════════════

  window.renderDesignStudio = function () {
    previousPage = window.currentPage || 'dashboard';
    window.currentPage = 'design-studio';
    hideAppChrome();
    showStartScreen();
  };

  window.exitDesignStudio = function () {
    cleanup();
    restoreAppChrome();
    if (typeof renderDashboard === 'function') renderDashboard();
  };

  window._dsBackToStart = function () {
    autoSave();
    cleanup();
    showStartScreen();
  };

  // ═══════════════════════════════════════════════════════════
  // APP CHROME TOGGLE
  // ═══════════════════════════════════════════════════════════

  function hideAppChrome() {
    ['menubar', 'nav', 'settings-gear', 'user-avatar-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.body.style.paddingTop = '0';
    document.body.style.paddingBottom = '0';
    document.body.style.overflow = 'hidden';
  }

  function restoreAppChrome() {
    ['menubar', 'nav'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    ['settings-gear', 'user-avatar-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    document.body.style.paddingTop = '';
    document.body.style.paddingBottom = '';
    document.body.style.overflow = '';
  }

  // ═══════════════════════════════════════════════════════════
  // START SCREEN
  // ═══════════════════════════════════════════════════════════

  function showStartScreen() {
    var html = '<div class="ds-start-screen">';
    html += '<button class="ds-back-link" onclick="exitDesignStudio()">';
    html += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to App';
    html += '</button>';
    html += '<div class="ds-start-header"><h1>Design Studio</h1></div>';

    html += '<div class="ds-start-tabs">';
    html += '<button class="ds-start-tab active" data-tab="my-designs" onclick="window._dsStartTab(\'my-designs\')">My Designs</button>';
    html += '<button class="ds-start-tab" data-tab="create-new" onclick="window._dsStartTab(\'create-new\')">Create New</button>';
    html += '</div>';

    html += '<div class="ds-start-page active" id="ds-page-my-designs">';
    html += buildSavedDesignsContent();
    html += '</div>';

    html += '<div class="ds-start-page" id="ds-page-create-new">';
    html += buildCreateNewContent();
    html += '</div>';

    html += '</div>';
    document.getElementById('app').innerHTML = html;
  }

  function buildSavedDesignsContent() {
    var saved = getSavedDesigns();
    var html = '';
    if (!saved.length) {
      html += '<div class="ds-empty-state">';
      html += '<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>';
      html += '<p>No saved designs yet.</p>';
      html += '<button class="ds-empty-cta" onclick="window._dsStartTab(\'create-new\')">Create your first design</button>';
      html += '</div>';
      return html;
    }
    html += '<div class="ds-saved-grid">';
    saved.forEach(function (d) {
      var date = d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : '';
      var safeName = escHtml(d.name);
      html += '<div class="ds-saved-card" id="ds-card-' + d.id + '">';
      html += '<div class="ds-saved-thumb" onclick="window._dsOpenDesign(\'' + d.id + '\')">';
      if (d.thumbnail) html += '<img src="' + d.thumbnail + '" alt="">';
      else html += '<div class="ds-saved-placeholder"></div>';
      html += '</div>';
      html += '<div class="ds-saved-info">';
      html += '<div class="ds-saved-name-row">';
      html += '<span class="ds-saved-name" id="ds-name-' + d.id + '" title="' + safeName + '">' + safeName + '</span>';
      html += '<button class="ds-saved-rename-btn" onclick="window._dsRenameDesign(\'' + d.id + '\')" title="Rename">';
      html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
      html += '</button>';
      html += '</div>';
      html += '<span class="ds-saved-meta">' + d.width + '&times;' + d.height + ' &middot; ' + date + '</span>';
      html += '</div>';
      html += '<div class="ds-saved-actions">';
      html += '<button class="ds-saved-open" onclick="window._dsOpenDesign(\'' + d.id + '\')">Open</button>';
      html += '<button class="ds-saved-del" onclick="window._dsDeleteDesignConfirm(\'' + d.id + '\')" title="Delete">';
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      html += '</button></div></div>';
    });
    html += '</div>';
    return html;
  }

  function buildCreateNewContent() {
    var html = '<div class="ds-preset-grid">';
    Object.keys(PRESETS).forEach(function (key) {
      var p = PRESETS[key];
      html += '<div class="ds-preset-card" onclick="window._dsSelectPreset(\'' + key + '\')">';
      html += '<div class="ds-preset-preview" style="aspect-ratio:' + p.width + '/' + p.height + '"></div>';
      html += '<div class="ds-preset-name">' + p.name + '</div>';
      html += '<div class="ds-preset-size">' + p.width + ' &times; ' + p.height + ' px</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="ds-custom-size"><h3>Custom Size</h3><div class="ds-custom-inputs">';
    html += '<input type="number" id="ds-custom-w" value="1080" min="100" max="5000">';
    html += '<span>&times;</span>';
    html += '<input type="number" id="ds-custom-h" value="1080" min="100" max="5000">';
    html += '<span>px</span>';
    html += '<button onclick="window._dsSelectCustom()">Create</button>';
    html += '</div></div>';
    return html;
  }

  window._dsStartTab = function (tab) {
    document.querySelectorAll('.ds-start-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.ds-start-page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'ds-page-' + tab);
    });
  };

  window._dsSelectPreset = function (key) {
    var p = PRESETS[key];
    pageWidth = p.width;
    pageHeight = p.height;
    currentDesignId = null;
    currentDesignName = '';
    bgMode = 'solid'; bgSolidColor = '#ffffff';
    openEditor();
  };

  window._dsSelectCustom = function () {
    var w = parseInt(document.getElementById('ds-custom-w').value) || 1080;
    var h = parseInt(document.getElementById('ds-custom-h').value) || 1080;
    pageWidth = Math.max(100, Math.min(5000, w));
    pageHeight = Math.max(100, Math.min(5000, h));
    currentDesignId = null;
    currentDesignName = '';
    bgMode = 'solid'; bgSolidColor = '#ffffff';
    openEditor();
  };

  window._dsOpenDesign = function (id) {
    var designs = getSavedDesigns();
    var d = designs.find(function (x) { return x.id === id; });
    if (!d) return;
    pageWidth = d.width;
    pageHeight = d.height;
    currentDesignId = d.id;
    currentDesignName = d.name;
    bgMode = 'solid'; bgSolidColor = '#ffffff';
    openEditor(d.canvasJSON);
  };

  window._dsDeleteDesignConfirm = function (id) {
    var designs = getSavedDesigns();
    var d = designs.find(function (x) { return x.id === id; });
    var label = d ? d.name : 'this design';

    if (typeof showConfirm === 'function') {
      showConfirm('Delete "' + label + '"? This cannot be undone.', 'Delete').then(function (ok) {
        if (!ok) return;
        var remaining = getSavedDesigns().filter(function (x) { return x.id !== id; });
        persistDesigns(remaining);
        var container = document.getElementById('ds-page-my-designs');
        if (container) container.innerHTML = buildSavedDesignsContent();
        if (typeof showToast === 'function') showToast('Design deleted.', 'info');
      });
    } else {
      if (!confirm('Delete "' + label + '"? This cannot be undone.')) return;
      designs = designs.filter(function (x) { return x.id !== id; });
      persistDesigns(designs);
      var container = document.getElementById('ds-page-my-designs');
      if (container) container.innerHTML = buildSavedDesignsContent();
      if (typeof showToast === 'function') showToast('Design deleted.', 'info');
    }
  };

  window._dsRenameDesign = function (id) {
    var nameEl = document.getElementById('ds-name-' + id);
    if (!nameEl) return;
    var card = document.getElementById('ds-card-' + id);
    var designs = getSavedDesigns();
    var d = designs.find(function (x) { return x.id === id; });
    if (!d) return;

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ds-rename-input';
    input.value = d.name;
    input.setAttribute('maxlength', '60');

    var row = nameEl.parentElement;
    var renameBtn = row.querySelector('.ds-saved-rename-btn');
    if (renameBtn) renameBtn.style.display = 'none';
    nameEl.style.display = 'none';
    row.insertBefore(input, nameEl);
    input.focus();
    input.select();

    function commit() {
      var newName = input.value.trim();
      if (!newName) newName = d.name;
      var all = getSavedDesigns();
      var entry = all.find(function (x) { return x.id === id; });
      if (entry) {
        entry.name = newName;
        entry.updatedAt = new Date().toISOString();
        persistDesigns(all);
      }
      if (input.parentElement) input.remove();
      nameEl.textContent = newName;
      nameEl.title = newName;
      nameEl.style.display = '';
      if (renameBtn) renameBtn.style.display = '';
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = d.name; input.blur(); }
    });
  };

  // ═══════════════════════════════════════════════════════════
  // EDITOR SHELL
  // ═══════════════════════════════════════════════════════════

  function openEditor(savedJSON) {
    objectCounter = 0;
    undoStack = [];
    redoStack = [];
    document.getElementById('app').innerHTML = buildEditorHTML();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        initCanvas();
        attachCanvasEvents();
        attachKeyboard();

        if (savedJSON) {
          savingHistory = true;
          dsCanvas.loadFromJSON(savedJSON, function () {
            pageBackground = dsCanvas.getObjects().find(function (o) { return o._dsRole === 'page'; });
            if (pageBackground) {
              var fs = readFillState(pageBackground);
              if (fs.mode === 'gradient') {
                bgMode = 'gradient';
                bgGradColor1 = fs.color1;
                bgGradColor2 = fs.color2;
                bgGradAngle = fs.angle;
              } else {
                bgMode = 'solid';
                bgSolidColor = fs.color;
              }
            }
            dsCanvas.renderAll();
            savingHistory = false;
            zoomToFit();
            saveHistory();
            updateLayers();
            refreshBgUI();
          });
        } else {
          zoomToFit();
          saveHistory();
          updateLayers();
        }
      });
    });
  }

  function buildEditorHTML() {
    var presetOpts = '';
    Object.keys(PRESETS).forEach(function (k) {
      var p = PRESETS[k];
      var sel = (p.width === pageWidth && p.height === pageHeight) ? ' selected' : '';
      presetOpts += '<option value="' + k + '"' + sel + '>' + p.name + ' (' + p.width + '\u00d7' + p.height + ')</option>';
    });
    presetOpts += '<option value="custom">Custom</option>';

    var shapeButtons = [
      { shape: 'rect', svg: '<rect x="4" y="8" width="32" height="24" rx="2" fill="var(--button-bg)" opacity="0.8"/>' },
      { shape: 'circle', svg: '<circle cx="20" cy="20" r="14" fill="var(--button-bg)" opacity="0.8"/>' },
      { shape: 'triangle', svg: '<polygon points="20,4 36,36 4,36" fill="var(--button-bg)" opacity="0.8"/>' },
      { shape: 'line', svg: '<line x1="4" y1="36" x2="36" y2="4" stroke="var(--button-bg)" stroke-width="3"/>' },
      { shape: 'star', svg: '<polygon points="20,2 25,15 38,15 27,23 31,37 20,28 9,37 13,23 2,15 15,15" fill="var(--button-bg)" opacity="0.8"/>' },
      { shape: 'diamond', svg: '<polygon points="20,2 38,20 20,38 2,20" fill="var(--button-bg)" opacity="0.8"/>' },
    ];

    var shapesHTML = shapeButtons.map(function (s) {
      return '<button class="ds-element-btn" onclick="window._dsAddShape(\'' + s.shape + '\')" title="' + s.shape + '"><svg viewBox="0 0 40 40">' + s.svg + '</svg></button>';
    }).join('');

    var iconsHTML = Object.keys(SVG_ICONS).map(function (name) {
      return '<button class="ds-element-btn ds-icon-btn" onclick="window._dsAddIcon(\'' + name + '\')" title="' + name + '">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + SVG_ICONS[name] + '"/></svg>' +
        '</button>';
    }).join('');

    return '' +
      '<div id="design-studio" class="ds-editor">' +
        '<div class="ds-toolbar">' +
          '<div class="ds-toolbar-left">' +
            '<button class="ds-tool-btn ds-back-btn" onclick="window._dsBackToStart()" title="Back to designs">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
            '</button>' +
            '<span class="ds-toolbar-title">Design Studio</span>' +
          '</div>' +
          '<div class="ds-toolbar-center">' +
            '<button class="ds-tool-btn" onclick="window._dsUndo()" title="Undo (Ctrl+Z)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg></button>' +
            '<button class="ds-tool-btn" onclick="window._dsRedo()" title="Redo (Ctrl+Y)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5"/></svg></button>' +
            '<span class="ds-toolbar-sep"></span>' +
            '<button class="ds-tool-btn" onclick="window._dsZoomOut()" title="Zoom Out"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>' +
            '<span class="ds-zoom-label" id="ds-zoom-label">100%</span>' +
            '<button class="ds-tool-btn" onclick="window._dsZoomIn()" title="Zoom In"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>' +
            '<button class="ds-tool-btn" onclick="window._dsZoomToFit()" title="Zoom to Fit" style="font-size:0.75em;width:auto;padding:0 8px">Fit</button>' +
            '<span class="ds-toolbar-sep"></span>' +
            '<button class="ds-tool-btn" id="ds-grid-btn" onclick="window._dsToggleGrid()" title="Toggle Grid"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/></svg></button>' +
            '<button class="ds-tool-btn active" id="ds-snap-btn" onclick="window._dsToggleSnap()" title="Toggle Snap"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>' +
          '</div>' +
          '<div class="ds-toolbar-right">' +
            '<button class="ds-save-btn" onclick="window._dsSaveDesign()" title="Save (Ctrl+S)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Save</button>' +
            '<span class="ds-save-indicator" id="ds-save-indicator"></span>' +
            '<span class="ds-toolbar-sep"></span>' +
            '<button class="ds-export-btn" onclick="window._dsExportPNG()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> PNG</button>' +
            '<button class="ds-export-btn" onclick="window._dsExportPDF()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg> PDF</button>' +
          '</div>' +
        '</div>' +
        '<div class="ds-main">' +
          '<div class="ds-sidebar-left" id="ds-sidebar-left">' +
            '<div class="ds-sidebar-tabs">' +
              '<button class="ds-tab active" data-tab="elements" onclick="window._dsSwitchTab(\'elements\')">Elements</button>' +
              '<button class="ds-tab" data-tab="design-assets" onclick="window._dsSwitchTab(\'design-assets\')">Design</button>' +
              '<button class="ds-tab" data-tab="layers" onclick="window._dsSwitchTab(\'layers\')">Layers</button>' +
            '</div>' +
            '<div class="ds-tab-content active" id="ds-tab-elements">' +
              '<div class="ds-panel"><div class="ds-panel-header">Page Size</div>' +
                '<select id="ds-preset-select" onchange="window._dsChangePreset(this.value)">' + presetOpts + '</select>' +
                '<div class="ds-size-row"><label>W</label><input type="number" id="ds-page-w" value="' + pageWidth + '" min="100" max="5000" onchange="window._dsResizePage()"><label>H</label><input type="number" id="ds-page-h" value="' + pageHeight + '" min="100" max="5000" onchange="window._dsResizePage()"></div>' +
              '</div>' +
              '<div class="ds-panel"><div class="ds-panel-header">Background</div>' +
                '<div class="ds-fill-mode-row">' +
                  '<button class="ds-fill-mode-btn' + (bgMode === 'solid' ? ' active' : '') + '" onclick="window._dsBgMode(\'solid\')">Solid</button>' +
                  '<button class="ds-fill-mode-btn' + (bgMode === 'gradient' ? ' active' : '') + '" onclick="window._dsBgMode(\'gradient\')">Gradient</button>' +
                '</div>' +
                '<div id="ds-bg-controls">' +
                  (bgMode === 'solid'
                    ? '<div class="ds-prop-row"><label class="wide">Color</label><input type="color" id="ds-bg-color" value="' + bgSolidColor + '" oninput="window._dsBgSolid(this.value)"></div>'
                    : '<div class="ds-prop-row"><label class="wide">Color 1</label><input type="color" id="ds-bg-gc1" value="' + bgGradColor1 + '" oninput="window._dsBgGradUpdate()"></div>' +
                      '<div class="ds-prop-row"><label class="wide">Color 2</label><input type="color" id="ds-bg-gc2" value="' + bgGradColor2 + '" oninput="window._dsBgGradUpdate()"></div>' +
                      '<div class="ds-prop-row"><label class="wide">Angle</label><input type="range" id="ds-bg-ga" min="0" max="360" value="' + bgGradAngle + '" oninput="window._dsBgGradUpdate();this.nextElementSibling.textContent=this.value+\'\\u00b0\'"><span class="ds-range-val">' + bgGradAngle + '\u00b0</span></div>'
                  ) +
                '</div>' +
              '</div>' +
              '<div class="ds-panel"><div class="ds-panel-header">Shapes</div><div class="ds-element-grid">' + shapesHTML + '</div></div>' +
              '<div class="ds-panel"><div class="ds-panel-header">Icons</div><div class="ds-element-grid ds-icon-grid">' + iconsHTML + '</div></div>' +
              '<div class="ds-panel"><div class="ds-panel-header">Text</div><div class="ds-text-btns">' +
                '<button class="ds-add-text-btn" onclick="window._dsAddText(\'heading\')"><strong style="font-size:18px">Add a heading</strong></button>' +
                '<button class="ds-add-text-btn" onclick="window._dsAddText(\'subheading\')"><strong style="font-size:14px">Add a subheading</strong></button>' +
                '<button class="ds-add-text-btn" onclick="window._dsAddText(\'body\')"><span style="font-size:12px">Add body text</span></button>' +
              '</div></div>' +
              '<div class="ds-panel"><div class="ds-panel-header">Images</div>' +
                '<button class="ds-upload-btn" onclick="window._dsUploadImage()">' +
                  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg> Upload Image' +
                '</button>' +
                '<input type="file" id="ds-image-input" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg" style="display:none" onchange="window._dsHandleImageUpload(event)">' +
              '</div>' +
            '</div>' +
            '<div class="ds-tab-content" id="ds-tab-design-assets">' +
              '<div class="ds-asset-controls">' +
                '<input type="text" id="ds-asset-search" class="ds-asset-search" placeholder="Search assets\u2026" oninput="window._dsFilterAssets()">' +
                '<select id="ds-asset-category" class="ds-asset-category" onchange="window._dsFilterAssets()">' +
                  DS_ASSET_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + c.label + '</option>'; }).join('') +
                '</select>' +
              '</div>' +
              '<div id="ds-asset-grid" class="ds-asset-grid"></div>' +
            '</div>' +
            '<div class="ds-tab-content" id="ds-tab-layers"><div id="ds-layers-list"></div></div>' +
          '</div>' +
          '<div class="ds-canvas-wrapper" id="ds-canvas-wrapper"><canvas id="ds-canvas"></canvas></div>' +
          '<div class="ds-sidebar-right" id="ds-sidebar-right"><div id="ds-props-panel">' +
            '<div class="ds-no-selection"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg><p>Select an element<br>to edit properties</p></div>' +
          '</div></div>' +
        '</div>' +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════
  // TAB SWITCHING
  // ═══════════════════════════════════════════════════════════

  window._dsSwitchTab = function (tab) {
    document.querySelectorAll('.ds-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === tab); });
    document.querySelectorAll('.ds-tab-content').forEach(function (c) { c.classList.toggle('active', c.id === 'ds-tab-' + tab); });
    if (tab === 'layers') updateLayers();
    if (tab === 'design-assets') window._dsFilterAssets();
  };

  // ═══════════════════════════════════════════════════════════
  // DESIGN ASSET LIBRARY UI
  // ═══════════════════════════════════════════════════════════

  window._dsFilterAssets = function () {
    var grid = document.getElementById('ds-asset-grid');
    if (!grid) return;
    var searchEl = document.getElementById('ds-asset-search');
    var catEl = document.getElementById('ds-asset-category');
    var query = (searchEl ? searchEl.value : '').toLowerCase().trim();
    var catId = catEl ? catEl.value : 'all';

    var items = dsAssets();
    var filtered = items.filter(function (a) {
      if (catId !== 'all' && a.catId !== catId) return false;
      if (!query) return true;
      var searchable = (a.file + ' ' + a.tags + ' ' + a.folder).toLowerCase().replace(/[-_]/g, ' ');
      var words = query.split(/\s+/);
      return words.every(function (w) { return searchable.indexOf(w) !== -1; });
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="ds-asset-empty">No matching assets</div>';
      return;
    }

    var html = '';
    filtered.forEach(function (a) {
      html += '<button class="ds-asset-tile" onclick="window._dsAddAssetSVG(\'' + a.path.replace(/'/g, "\\'") + '\')" title="' + a.file.replace(/-/g, ' ') + '">';
      html += '<img src="' + a.path + '" loading="lazy" draggable="false">';
      html += '</button>';
    });
    grid.innerHTML = html;
  };

  window._dsAddAssetSVG = function (path) {
    fabric.loadSVGFromURL(path, function (objects, options) {
      if (!objects || !objects.length) return;
      var svgObj = fabric.util.groupSVGElements(objects, options);
      svgObj.set({ lockUniScaling: true, padding: 5 });
      var maxW = pageWidth * 0.5;
      var maxH = pageHeight * 0.5;
      if (svgObj.width > maxW || svgObj.height > maxH) {
        var scale = Math.min(maxW / svgObj.width, maxH / svgObj.height);
        svgObj.scale(scale);
      }
      var name = path.split('/').pop().replace('.svg', '').substring(0, 20);
      addToCanvas(svgObj, name);
    });
  };

  // ═══════════════════════════════════════════════════════════
  // CANVAS INIT
  // ═══════════════════════════════════════════════════════════

  function initCanvas() {
    var wrapper = document.getElementById('ds-canvas-wrapper');

    fabric.Object.prototype.set({
      transparentCorners: false,
      cornerColor: '#4f46e5',
      cornerStrokeColor: '#ffffff',
      cornerSize: 9,
      cornerStyle: 'circle',
      borderColor: '#4f46e5',
      borderScaleFactor: 1.5,
      padding: 5,
    });

    dsCanvas = new fabric.Canvas('ds-canvas', {
      width: wrapper.clientWidth,
      height: wrapper.clientHeight,
      backgroundColor: '#e5e5e5',
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      enableRetinaScaling: true,
    });

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) dsCanvas.backgroundColor = '#1a1a2e';

    pageBackground = new fabric.Rect({
      left: 0,
      top: 0,
      width: pageWidth,
      height: pageHeight,
      fill: '#ffffff',
      selectable: false,
      evented: false,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.18)', blur: 20, offsetX: 0, offsetY: 4 }),
      _dsRole: 'page',
    });
    dsCanvas.add(pageBackground);

    dsCanvas.on('after:render', drawGridOverlay);

    resizeObserver = new ResizeObserver(function () {
      if (!dsCanvas) return;
      var w = wrapper.clientWidth;
      var h = wrapper.clientHeight;
      dsCanvas.setDimensions({ width: w, height: h });
      centerPage();
    });
    resizeObserver.observe(wrapper);
  }

  // ═══════════════════════════════════════════════════════════
  // CANVAS EVENTS
  // ═══════════════════════════════════════════════════════════

  function attachCanvasEvents() {
    dsCanvas.on('selection:created', function () { updatePropsPanel(); updateLayers(); });
    dsCanvas.on('selection:updated', function () { updatePropsPanel(); updateLayers(); });
    dsCanvas.on('selection:cleared', function () { clearPropsPanel(); updateLayers(); });
    dsCanvas.on('object:modified', function () { saveHistory(); updatePropsPanel(); updateLayers(); });

    dsCanvas.on('object:moving', function (e) {
      if (!snapEnabled) return;
      var obj = e.target;
      if (obj._dsRole) return;
      var l = Math.round(obj.left / GRID_SIZE) * GRID_SIZE;
      var t = Math.round(obj.top / GRID_SIZE) * GRID_SIZE;
      if (Math.abs(obj.left - l) < SNAP_THRESHOLD) obj.set('left', l);
      if (Math.abs(obj.top - t) < SNAP_THRESHOLD) obj.set('top', t);
    });

    dsCanvas.on('mouse:wheel', function (opt) {
      var delta = opt.e.deltaY;
      var z = dsCanvas.getZoom() * (0.999 ** delta);
      z = Math.min(5, Math.max(0.05, z));
      dsCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
      zoomLevel = z;
      updateZoomLabel();
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    dsCanvas.on('mouse:down', function (opt) {
      if (spaceHeld || opt.e.button === 1) {
        isPanning = true;
        lastPanPoint = { x: opt.e.clientX, y: opt.e.clientY };
        dsCanvas.selection = false;
        dsCanvas.defaultCursor = 'grabbing';
        dsCanvas.setCursor('grabbing');
      }
    });

    dsCanvas.on('mouse:move', function (opt) {
      if (isPanning && lastPanPoint) {
        dsCanvas.viewportTransform[4] += opt.e.clientX - lastPanPoint.x;
        dsCanvas.viewportTransform[5] += opt.e.clientY - lastPanPoint.y;
        lastPanPoint = { x: opt.e.clientX, y: opt.e.clientY };
        dsCanvas.requestRenderAll();
      }
    });

    dsCanvas.on('mouse:up', function () {
      if (isPanning) {
        isPanning = false;
        lastPanPoint = null;
        dsCanvas.selection = true;
        dsCanvas.defaultCursor = spaceHeld ? 'grab' : 'default';
        dsCanvas.setCursor(dsCanvas.defaultCursor);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════

  function attachKeyboard() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  }

  function handleKeyDown(e) {
    if (window.currentPage !== 'design-studio') return;
    if (!dsCanvas) return;

    var tag = (e.target.tagName || '').toLowerCase();
    var isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.code === 'Space' && !isInput) {
      e.preventDefault();
      spaceHeld = true;
      if (dsCanvas) { dsCanvas.defaultCursor = 'grab'; dsCanvas.setCursor('grab'); }
    }

    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); window._dsSaveDesign(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copyObject(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteObject(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateObject(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    if (e.key === 'Escape') { dsCanvas.discardActiveObject(); dsCanvas.requestRenderAll(); }
  }

  function handleKeyUp(e) {
    if (e.code === 'Space') {
      spaceHeld = false;
      if (dsCanvas && !isPanning) { dsCanvas.defaultCursor = 'default'; dsCanvas.setCursor('default'); }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CLIPBOARD
  // ═══════════════════════════════════════════════════════════

  function copyObject() {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    obj.clone(function (cloned) { clipboard = cloned; });
  }

  function pasteObject() {
    if (!clipboard) return;
    clipboard.clone(function (cloned) {
      cloned.set({ left: cloned.left + 20, top: cloned.top + 20, evented: true });
      if (cloned.type === 'activeSelection') {
        cloned.canvas = dsCanvas;
        cloned.forEachObject(function (o) { dsCanvas.add(o); });
        cloned.setCoords();
      } else {
        dsCanvas.add(cloned);
      }
      dsCanvas.setActiveObject(cloned);
      dsCanvas.requestRenderAll();
      saveHistory();
      updateLayers();
    });
  }

  function duplicateObject() {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    obj.clone(function (cloned) {
      cloned.set({ left: obj.left + 20, top: obj.top + 20, evented: true });
      dsCanvas.add(cloned);
      dsCanvas.setActiveObject(cloned);
      dsCanvas.requestRenderAll();
      saveHistory();
      updateLayers();
    });
  }

  function deleteSelected() {
    var objs = dsCanvas.getActiveObjects();
    if (!objs.length) return;
    objs.forEach(function (o) { if (!o._dsRole) dsCanvas.remove(o); });
    dsCanvas.discardActiveObject();
    dsCanvas.requestRenderAll();
    saveHistory();
    clearPropsPanel();
    updateLayers();
  }

  // ═══════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════

  function saveHistory() {
    if (savingHistory) return;
    var json = JSON.stringify(dsCanvas.toJSON(['_dsRole', '_dsName', 'selectable', 'evented']));
    undoStack.push(json);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length <= 1) return;
    savingHistory = true;
    redoStack.push(undoStack.pop());
    dsCanvas.loadFromJSON(undoStack[undoStack.length - 1], function () {
      pageBackground = dsCanvas.getObjects().find(function (o) { return o._dsRole === 'page'; });
      dsCanvas.renderAll();
      savingHistory = false;
      updatePropsPanel();
      updateLayers();
    });
  }

  window._dsUndo = undo;

  function redo() {
    if (!redoStack.length) return;
    savingHistory = true;
    var state = redoStack.pop();
    undoStack.push(state);
    dsCanvas.loadFromJSON(state, function () {
      pageBackground = dsCanvas.getObjects().find(function (o) { return o._dsRole === 'page'; });
      dsCanvas.renderAll();
      savingHistory = false;
      updatePropsPanel();
      updateLayers();
    });
  }

  window._dsRedo = redo;

  // ═══════════════════════════════════════════════════════════
  // ZOOM
  // ═══════════════════════════════════════════════════════════

  function setZoom(z) {
    zoomLevel = Math.min(5, Math.max(0.05, z));
    var wrapper = document.getElementById('ds-canvas-wrapper');
    if (wrapper && dsCanvas) {
      dsCanvas.zoomToPoint(
        new fabric.Point(wrapper.clientWidth / 2, wrapper.clientHeight / 2),
        zoomLevel
      );
    }
    updateZoomLabel();
  }

  function zoomToFit() {
    var wrapper = document.getElementById('ds-canvas-wrapper');
    if (!wrapper) return;
    var pad = 80;
    var sx = (wrapper.clientWidth - pad) / pageWidth;
    var sy = (wrapper.clientHeight - pad) / pageHeight;
    zoomLevel = Math.min(sx, sy, 1);
    dsCanvas.setZoom(zoomLevel);
    centerPage();
    updateZoomLabel();
  }

  function centerPage() {
    var wrapper = document.getElementById('ds-canvas-wrapper');
    if (!wrapper || !dsCanvas) return;
    dsCanvas.viewportTransform[4] = (wrapper.clientWidth - pageWidth * zoomLevel) / 2;
    dsCanvas.viewportTransform[5] = (wrapper.clientHeight - pageHeight * zoomLevel) / 2;
    dsCanvas.requestRenderAll();
  }

  function updateZoomLabel() {
    var el = document.getElementById('ds-zoom-label');
    if (el) el.textContent = Math.round(zoomLevel * 100) + '%';
  }

  window._dsZoomIn = function () { setZoom(zoomLevel * 1.2); };
  window._dsZoomOut = function () { setZoom(zoomLevel / 1.2); };
  window._dsZoomToFit = zoomToFit;

  // ═══════════════════════════════════════════════════════════
  // GRID & SNAP
  // ═══════════════════════════════════════════════════════════

  function drawGridOverlay() {
    if (!gridEnabled || !dsCanvas) return;
    var ctx = dsCanvas.getContext('2d');
    var vpt = dsCanvas.viewportTransform;
    ctx.save();
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5 / zoomLevel;
    for (var x = 0; x <= pageWidth; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, pageHeight); ctx.stroke();
    }
    for (var y = 0; y <= pageHeight; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pageWidth, y); ctx.stroke();
    }
    ctx.restore();
  }

  window._dsToggleGrid = function () {
    gridEnabled = !gridEnabled;
    var btn = document.getElementById('ds-grid-btn');
    if (btn) btn.classList.toggle('active', gridEnabled);
    dsCanvas.requestRenderAll();
  };

  window._dsToggleSnap = function () {
    snapEnabled = !snapEnabled;
    var btn = document.getElementById('ds-snap-btn');
    if (btn) btn.classList.toggle('active', snapEnabled);
  };

  // ═══════════════════════════════════════════════════════════
  // PAGE SIZE
  // ═══════════════════════════════════════════════════════════

  window._dsChangePreset = function (key) {
    if (key === 'custom') return;
    var p = PRESETS[key];
    if (!p) return;
    pageWidth = p.width;
    pageHeight = p.height;
    applyPageSize();
    var wIn = document.getElementById('ds-page-w');
    var hIn = document.getElementById('ds-page-h');
    if (wIn) wIn.value = pageWidth;
    if (hIn) hIn.value = pageHeight;
  };

  window._dsResizePage = function () {
    var w = parseInt(document.getElementById('ds-page-w').value) || pageWidth;
    var h = parseInt(document.getElementById('ds-page-h').value) || pageHeight;
    pageWidth = Math.max(100, Math.min(5000, w));
    pageHeight = Math.max(100, Math.min(5000, h));
    applyPageSize();
  };

  function applyPageSize() {
    if (pageBackground) {
      pageBackground.set({ width: pageWidth, height: pageHeight });
      pageBackground.setCoords();
    }
    zoomToFit();
    saveHistory();
  }

  // ═══════════════════════════════════════════════════════════
  // ADD SHAPES
  // ═══════════════════════════════════════════════════════════

  function addToCanvas(obj, name) {
    objectCounter++;
    obj.set({
      left: pageWidth / 2,
      top: pageHeight / 2,
      originX: 'center',
      originY: 'center',
      _dsName: name || ('Object ' + objectCounter),
    });
    dsCanvas.add(obj);
    dsCanvas.setActiveObject(obj);
    dsCanvas.requestRenderAll();
    saveHistory();
    updateLayers();
  }

  window._dsAddShape = function (type) {
    var obj;
    var fill = '#4f46e5';
    switch (type) {
      case 'rect':
        obj = new fabric.Rect({ width: 200, height: 150, fill: fill, rx: 4, ry: 4 });
        addToCanvas(obj, 'Rectangle ' + (objectCounter + 1));
        break;
      case 'circle':
        obj = new fabric.Circle({ radius: 80, fill: fill });
        addToCanvas(obj, 'Circle ' + (objectCounter + 1));
        break;
      case 'triangle':
        obj = new fabric.Triangle({ width: 180, height: 156, fill: fill });
        addToCanvas(obj, 'Triangle ' + (objectCounter + 1));
        break;
      case 'line':
        obj = new fabric.Line([0, 0, 250, 0], { stroke: fill, strokeWidth: 4, fill: null });
        addToCanvas(obj, 'Line ' + (objectCounter + 1));
        break;
      case 'star':
        var pts = makeStarPoints(5, 80, 35);
        obj = new fabric.Polygon(pts, { fill: fill });
        addToCanvas(obj, 'Star ' + (objectCounter + 1));
        break;
      case 'diamond':
        obj = new fabric.Polygon([
          { x: 0, y: -80 }, { x: 80, y: 0 }, { x: 0, y: 80 }, { x: -80, y: 0 },
        ], { fill: fill });
        addToCanvas(obj, 'Diamond ' + (objectCounter + 1));
        break;
    }
  };

  function makeStarPoints(n, outer, inner) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = (Math.PI / n) * i - Math.PI / 2;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  // ═══════════════════════════════════════════════════════════
  // ADD ICONS
  // ═══════════════════════════════════════════════════════════

  window._dsAddIcon = function (name) {
    var pathData = SVG_ICONS[name];
    if (!pathData) return;
    var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"' +
      ' fill="none" stroke="#333333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + pathData + '"/></svg>';
    fabric.loadSVGFromString(svgStr, function (objects, options) {
      var icon = fabric.util.groupSVGElements(objects, options);
      icon.set({
        scaleX: 3,
        scaleY: 3,
        padding: 10,
        cornerSize: 8,
        borderDashArray: [5, 3],
        lockUniScaling: true,
      });
      addToCanvas(icon, name + ' icon');
    });
  };

  // ═══════════════════════════════════════════════════════════
  // ADD TEXT
  // ═══════════════════════════════════════════════════════════

  window._dsAddText = function (type) {
    var opts = { fontFamily: 'Arial', fill: '#333333' };
    switch (type) {
      case 'heading':
        opts.fontSize = 48;
        opts.fontWeight = 'bold';
        opts.text = 'Add a heading';
        break;
      case 'subheading':
        opts.fontSize = 32;
        opts.fontWeight = 'bold';
        opts.text = 'Add a subheading';
        break;
      default:
        opts.fontSize = 20;
        opts.text = 'Add body text';
    }
    var text = new fabric.IText(opts.text, opts);
    addToCanvas(text, (type === 'heading' ? 'Heading' : type === 'subheading' ? 'Subheading' : 'Text') + ' ' + (objectCounter + 1));
  };

  // ═══════════════════════════════════════════════════════════
  // ADD IMAGES
  // ═══════════════════════════════════════════════════════════

  window._dsUploadImage = function () {
    document.getElementById('ds-image-input').click();
  };

  window._dsHandleImageUpload = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var isSvg = file.type === 'image/svg+xml' || (file.name || '').toLowerCase().endsWith('.svg');
    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = ev.target.result;
      if (isSvg) {
        fabric.loadSVGFromURL(dataUrl, function (objects, options) {
          var svgObj = fabric.util.groupSVGElements(objects, options);
          svgObj.set({ selectable: true, evented: true, lockUniScaling: true, padding: 5 });
          var maxW = pageWidth * 0.6;
          var maxH = pageHeight * 0.6;
          if (svgObj.width > maxW || svgObj.height > maxH) {
            var scale = Math.min(maxW / svgObj.width, maxH / svgObj.height);
            svgObj.scale(scale);
          }
          addToCanvas(svgObj, file.name.substring(0, 20));
        });
      } else {
        fabric.Image.fromURL(dataUrl, function (img) {
          var maxW = pageWidth * 0.6;
          var maxH = pageHeight * 0.6;
          if (img.width > maxW || img.height > maxH) {
            var scale = Math.min(maxW / img.width, maxH / img.height);
            img.scale(scale);
          }
          addToCanvas(img, file.name.substring(0, 20));
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ═══════════════════════════════════════════════════════════
  // PROPERTIES PANEL
  // ═══════════════════════════════════════════════════════════

  function clearPropsPanel() {
    var panel = document.getElementById('ds-props-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="ds-no-selection"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg><p>Select an element<br>to edit properties</p></div>';
  }

  function updatePropsPanel() {
    var panel = document.getElementById('ds-props-panel');
    if (!panel || !dsCanvas) return;
    var obj = dsCanvas.getActiveObject();
    if (!obj || obj._dsRole) { clearPropsPanel(); return; }

    var isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
    var isImage = obj.type === 'image';
    var isLine = obj.type === 'line';

    var w = Math.round(obj.getScaledWidth());
    var h = Math.round(obj.getScaledHeight());
    var x = Math.round(obj.left);
    var y = Math.round(obj.top);
    var rot = Math.round(obj.angle || 0);
    var opacity = Math.round((obj.opacity || 1) * 100);

    var html = '';

    // Transform
    html += '<div class="ds-prop-group"><div class="ds-prop-group-title">Transform</div>';
    html += '<div class="ds-prop-row"><label>X</label><input type="number" value="' + x + '" onchange="window._dsPropSet(\'left\',+this.value)"><label>Y</label><input type="number" value="' + y + '" onchange="window._dsPropSet(\'top\',+this.value)"></div>';
    html += '<div class="ds-prop-row"><label>W</label><input type="number" value="' + w + '" min="1" onchange="window._dsPropSetSize(\'w\',+this.value)"><label>H</label><input type="number" value="' + h + '" min="1" onchange="window._dsPropSetSize(\'h\',+this.value)"></div>';
    html += '<div class="ds-prop-row"><label class="wide">Rotation</label><input type="number" value="' + rot + '" min="0" max="360" onchange="window._dsPropSet(\'angle\',+this.value)"></div>';
    html += '<div class="ds-prop-row"><label class="wide">Opacity</label><input type="range" min="0" max="100" value="' + opacity + '" oninput="window._dsPropSet(\'opacity\',+this.value/100);this.nextElementSibling.textContent=this.value+\'%\'"><span class="ds-range-val">' + opacity + '%</span></div>';
    html += '</div>';

    // Text properties
    if (isText) {
      var fontFamily = obj.fontFamily || 'Arial';
      var fontSize = obj.fontSize || 20;
      var isBold = (obj.fontWeight === 'bold' || obj.fontWeight >= 700);
      var isItalic = obj.fontStyle === 'italic';
      var isUnderline = obj.underline;
      var textAlign = obj.textAlign || 'left';
      var charSpacing = Math.round(obj.charSpacing || 0);
      var lineHeight = (obj.lineHeight || 1.16).toFixed(2);
      var textColor = obj.fill || '#333333';

      html += '<div class="ds-prop-group"><div class="ds-prop-group-title">Text</div>';
      html += '<div class="ds-prop-row"><select onchange="window._dsPropSet(\'fontFamily\',this.value)">';
      FONTS.forEach(function (f) {
        html += '<option value="' + f + '"' + (f === fontFamily ? ' selected' : '') + ' style="font-family:\'' + f + '\'">' + f + '</option>';
      });
      html += '</select></div>';
      html += '<div class="ds-prop-row"><label>Size</label><input type="number" value="' + fontSize + '" min="6" max="500" onchange="window._dsPropSet(\'fontSize\',+this.value)"></div>';
      html += '<div class="ds-text-format">';
      html += '<button class="ds-fmt-btn' + (isBold ? ' active' : '') + '" onclick="window._dsToggleBold()" title="Bold"><b>B</b></button>';
      html += '<button class="ds-fmt-btn' + (isItalic ? ' active' : '') + '" onclick="window._dsToggleItalic()" title="Italic"><i>I</i></button>';
      html += '<button class="ds-fmt-btn' + (isUnderline ? ' active' : '') + '" onclick="window._dsToggleUnderline()" title="Underline"><u>U</u></button>';
      html += '</div>';
      html += '<div class="ds-align-btns">';
      html += '<button class="ds-align-btn' + (textAlign === 'left' ? ' active' : '') + '" onclick="window._dsPropSet(\'textAlign\',\'left\')" title="Align left"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 10H3M21 6H3M21 14H3M17 18H3"/></svg></button>';
      html += '<button class="ds-align-btn' + (textAlign === 'center' ? ' active' : '') + '" onclick="window._dsPropSet(\'textAlign\',\'center\')" title="Align center"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10H6M21 6H3M21 14H3M18 18H6"/></svg></button>';
      html += '<button class="ds-align-btn' + (textAlign === 'right' ? ' active' : '') + '" onclick="window._dsPropSet(\'textAlign\',\'right\')" title="Align right"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H7M21 6H3M21 14H3M21 18H7"/></svg></button>';
      html += '</div>';
      var textFillSt = readFillState(obj);
      html += '<div class="ds-fill-mode-row" style="margin-bottom:6px">';
      html += '<button class="ds-fill-mode-btn' + (textFillSt.mode === 'solid' ? ' active' : '') + '" onclick="window._dsObjFillMode(\'solid\')">Solid</button>';
      html += '<button class="ds-fill-mode-btn' + (textFillSt.mode === 'gradient' ? ' active' : '') + '" onclick="window._dsObjFillMode(\'gradient\')">Gradient</button>';
      html += '</div>';
      if (textFillSt.mode === 'solid') {
        html += '<div class="ds-prop-row"><label class="wide">Color</label><input type="color" value="' + safeColor(textColor) + '" onchange="window._dsPropSet(\'fill\',this.value)"></div>';
      } else {
        html += '<div class="ds-prop-row"><label class="wide">Color 1</label><input type="color" id="ds-obj-gc1" value="' + safeColor(textFillSt.color1) + '" oninput="window._dsObjGradUpdate()"></div>';
        html += '<div class="ds-prop-row"><label class="wide">Color 2</label><input type="color" id="ds-obj-gc2" value="' + safeColor(textFillSt.color2) + '" oninput="window._dsObjGradUpdate()"></div>';
        html += '<div class="ds-prop-row"><label class="wide">Angle</label><input type="range" id="ds-obj-ga" min="0" max="360" value="' + textFillSt.angle + '" oninput="window._dsObjGradUpdate();this.nextElementSibling.textContent=this.value+\'\\u00b0\'"><span class="ds-range-val">' + textFillSt.angle + '\u00b0</span></div>';
      }
      html += '<div class="ds-prop-row"><label class="wide">Spacing</label><input type="number" value="' + charSpacing + '" step="10" onchange="window._dsPropSet(\'charSpacing\',+this.value)"></div>';
      html += '<div class="ds-prop-row"><label class="wide">Line H.</label><input type="number" value="' + lineHeight + '" step="0.1" min="0.5" max="5" onchange="window._dsPropSet(\'lineHeight\',+this.value)"></div>';
      html += '</div>';
    }

    // Shape appearance
    if (!isText && !isImage) {
      var fillSt = readFillState(obj);
      var stroke = obj.stroke || '#000000';
      var strokeW = obj.strokeWidth || 0;

      html += '<div class="ds-prop-group"><div class="ds-prop-group-title">Fill</div>';
      if (!isLine) {
        html += '<div class="ds-fill-mode-row">';
        html += '<button class="ds-fill-mode-btn' + (fillSt.mode === 'solid' ? ' active' : '') + '" onclick="window._dsObjFillMode(\'solid\')">Solid</button>';
        html += '<button class="ds-fill-mode-btn' + (fillSt.mode === 'gradient' ? ' active' : '') + '" onclick="window._dsObjFillMode(\'gradient\')">Gradient</button>';
        html += '</div>';
        if (fillSt.mode === 'solid') {
          html += '<div class="ds-prop-row"><label class="wide">Color</label><input type="color" value="' + fillSt.color + '" onchange="window._dsPropSet(\'fill\',this.value)"></div>';
        } else {
          html += '<div class="ds-prop-row"><label class="wide">Color 1</label><input type="color" id="ds-obj-gc1" value="' + safeColor(fillSt.color1) + '" oninput="window._dsObjGradUpdate()"></div>';
          html += '<div class="ds-prop-row"><label class="wide">Color 2</label><input type="color" id="ds-obj-gc2" value="' + safeColor(fillSt.color2) + '" oninput="window._dsObjGradUpdate()"></div>';
          html += '<div class="ds-prop-row"><label class="wide">Angle</label><input type="range" id="ds-obj-ga" min="0" max="360" value="' + fillSt.angle + '" oninput="window._dsObjGradUpdate();this.nextElementSibling.textContent=this.value+\'\\u00b0\'"><span class="ds-range-val">' + fillSt.angle + '\u00b0</span></div>';
        }
      }
      html += '</div>';
      html += '<div class="ds-prop-group"><div class="ds-prop-group-title">Stroke</div>';
      html += '<div class="ds-prop-row"><label class="wide">Color</label><input type="color" value="' + safeColor(stroke) + '" onchange="window._dsPropSet(\'stroke\',this.value)"></div>';
      html += '<div class="ds-prop-row"><label class="wide">Width</label><input type="number" value="' + strokeW + '" min="0" max="50" onchange="window._dsPropSet(\'strokeWidth\',+this.value)"></div>';
      html += '</div>';
    }

    // Image section
    if (isImage) {
      html += '<div class="ds-prop-group"><div class="ds-prop-group-title">Image</div>';
      html += '<button class="ds-removebg-btn" onclick="window._dsRemoveBg()">Remove Background</button>';
      html += '</div>';
    }

    // Layer controls
    html += '<div class="ds-prop-group"><div class="ds-prop-group-title">Layer</div>';
    html += '<div class="ds-layer-actions">';
    html += '<button class="ds-layer-btn" onclick="window._dsLayerAction(\'forward\')">Bring Forward</button>';
    html += '<button class="ds-layer-btn" onclick="window._dsLayerAction(\'backward\')">Send Backward</button>';
    html += '<button class="ds-layer-btn" onclick="window._dsLayerAction(\'front\')">To Front</button>';
    html += '<button class="ds-layer-btn" onclick="window._dsLayerAction(\'back\')">To Back</button>';
    html += '</div></div>';

    // Actions
    html += '<div class="ds-prop-group"><div class="ds-obj-actions">';
    html += '<button class="ds-obj-action-btn ds-duplicate-btn" onclick="window._dsDuplicateObj()">Duplicate</button>';
    html += '<button class="ds-obj-action-btn ds-delete-btn" onclick="window._dsDeleteObj()">Delete</button>';
    html += '</div></div>';

    panel.innerHTML = html;
  }

  function safeColor(c) {
    if (!c || c === 'transparent' || c === 'null' || c === 'undefined') return '#000000';
    if (c.startsWith('#') && (c.length === 7 || c.length === 4)) return c;
    if (c.startsWith('rgb')) {
      var m = c.match(/(\d+)/g);
      if (m && m.length >= 3) {
        return '#' + ((1 << 24) + (+m[0] << 16) + (+m[1] << 8) + +m[2]).toString(16).slice(1);
      }
    }
    return '#000000';
  }

  // ═══════════════════════════════════════════════════════════
  // PROPERTY SETTERS
  // ═══════════════════════════════════════════════════════════

  window._dsPropSet = function (prop, val) {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    obj.set(prop, val);
    obj.setCoords();
    dsCanvas.requestRenderAll();
    saveHistory();
    if (prop === 'textAlign' || prop === 'fontWeight' || prop === 'fontStyle' || prop === 'underline') updatePropsPanel();
  };

  window._dsPropSetSize = function (dim, val) {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    if (dim === 'w') {
      obj.set('scaleX', val / (obj.width || 1));
    } else {
      obj.set('scaleY', val / (obj.height || 1));
    }
    obj.setCoords();
    dsCanvas.requestRenderAll();
    saveHistory();
  };

  window._dsToggleBold = function () {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
    dsCanvas.requestRenderAll();
    saveHistory();
    updatePropsPanel();
  };

  window._dsToggleItalic = function () {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
    dsCanvas.requestRenderAll();
    saveHistory();
    updatePropsPanel();
  };

  window._dsToggleUnderline = function () {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    obj.set('underline', !obj.underline);
    dsCanvas.requestRenderAll();
    saveHistory();
    updatePropsPanel();
  };

  window._dsDuplicateObj = duplicateObject;
  window._dsDeleteObj = deleteSelected;

  // ═══════════════════════════════════════════════════════════
  // LAYER ACTIONS
  // ═══════════════════════════════════════════════════════════

  window._dsLayerAction = function (action) {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    switch (action) {
      case 'forward': dsCanvas.bringForward(obj); break;
      case 'backward':
        var idx = dsCanvas.getObjects().indexOf(obj);
        if (idx > 1) dsCanvas.sendBackwards(obj);
        break;
      case 'front': dsCanvas.bringToFront(obj); break;
      case 'back':
        dsCanvas.sendToBack(obj);
        if (pageBackground) dsCanvas.sendToBack(pageBackground);
        break;
    }
    dsCanvas.requestRenderAll();
    saveHistory();
    updateLayers();
  };

  // ═══════════════════════════════════════════════════════════
  // LAYERS PANEL
  // ═══════════════════════════════════════════════════════════

  function updateLayers() {
    var container = document.getElementById('ds-layers-list');
    if (!container || !dsCanvas) return;

    var objects = dsCanvas.getObjects().filter(function (o) { return !o._dsRole; });
    var activeObj = dsCanvas.getActiveObject();

    if (!objects.length) {
      container.innerHTML = '<div class="ds-layers-empty">No elements yet.<br>Add shapes, text, or images.</div>';
      return;
    }

    var html = '';
    for (var i = objects.length - 1; i >= 0; i--) {
      var obj = objects[i];
      var isActive = obj === activeObj;
      var name = obj._dsName || obj.type || 'Object';
      var visOff = !obj.visible;
      var locked = obj.lockMovementX && obj.lockMovementY;

      html += '<div class="ds-layer-item' + (isActive ? ' active' : '') + '" onclick="window._dsSelectLayerIdx(' + i + ')">';
      html += '<button class="ds-layer-vis' + (visOff ? ' off' : '') + '" onclick="event.stopPropagation();window._dsToggleVis(' + i + ')" title="Toggle visibility">';
      html += visOff ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></svg>'
             : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      html += '</button>';
      html += '<svg class="ds-layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + layerIcon(obj.type) + '</svg>';
      html += '<span class="ds-layer-name">' + escHtml(name) + '</span>';
      html += '<button class="ds-layer-lock' + (locked ? ' on' : '') + '" onclick="event.stopPropagation();window._dsToggleLock(' + i + ')" title="Toggle lock">';
      html += locked ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'
                     : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
      html += '</button></div>';
    }
    container.innerHTML = html;
  }

  function layerIcon(type) {
    switch (type) {
      case 'rect': return '<rect x="3" y="3" width="18" height="18" rx="2"/>';
      case 'circle': return '<circle cx="12" cy="12" r="10"/>';
      case 'triangle': return '<path d="M12 2L22 22H2z"/>';
      case 'line': return '<line x1="4" y1="20" x2="20" y2="4"/>';
      case 'polygon': return '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
      case 'i-text': case 'text': case 'textbox': return '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>';
      case 'image': return '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>';
      case 'path': return '<path d="M12 2L2 12l10 10 10-10z"/>';
      default: return '<circle cx="12" cy="12" r="10"/>';
    }
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window._dsSelectLayerIdx = function (idx) {
    var objects = dsCanvas.getObjects().filter(function (o) { return !o._dsRole; });
    if (objects[idx]) {
      dsCanvas.setActiveObject(objects[idx]);
      dsCanvas.requestRenderAll();
    }
  };

  window._dsToggleVis = function (idx) {
    var objects = dsCanvas.getObjects().filter(function (o) { return !o._dsRole; });
    if (objects[idx]) {
      objects[idx].set('visible', !objects[idx].visible);
      dsCanvas.requestRenderAll();
      updateLayers();
      saveHistory();
    }
  };

  window._dsToggleLock = function (idx) {
    var objects = dsCanvas.getObjects().filter(function (o) { return !o._dsRole; });
    if (objects[idx]) {
      var locked = !objects[idx].lockMovementX;
      objects[idx].set({
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockRotation: locked,
        hasControls: !locked,
        selectable: !locked,
      });
      dsCanvas.requestRenderAll();
      updateLayers();
    }
  };

  // ═══════════════════════════════════════════════════════════
  // SAVE / LOAD
  // ═══════════════════════════════════════════════════════════

  function formatSaveTime(date) {
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function updateSaveIndicator(label) {
    var el = document.getElementById('ds-save-indicator');
    if (el) {
      el.textContent = label;
      el.classList.add('ds-just-saved');
      setTimeout(function () { el.classList.remove('ds-just-saved'); }, 1500);
    }
  }

  function saveDesignData(silent) {
    if (!dsCanvas) return false;
    var canvasJSON = dsCanvas.toJSON(['_dsRole', '_dsName', 'selectable', 'evented']);
    var thumb = generateThumbnail();
    var now = new Date();

    if (currentDesignId) {
      var designs = getSavedDesigns();
      var existing = designs.find(function (x) { return x.id === currentDesignId; });
      if (existing) {
        existing.canvasJSON = canvasJSON;
        existing.thumbnail = thumb;
        existing.width = pageWidth;
        existing.height = pageHeight;
        existing.updatedAt = now.toISOString();
        existing.bgMode = bgMode;
        existing.bgSolidColor = bgSolidColor;
        existing.bgGradColor1 = bgGradColor1;
        existing.bgGradColor2 = bgGradColor2;
        existing.bgGradAngle = bgGradAngle;
        persistDesigns(designs);
        updateSaveIndicator('Saved at ' + formatSaveTime(now));
        return true;
      }
    }

    if (silent) {
      var autoName = currentDesignName || 'Untitled Design';
      currentDesignId = generateId();
      currentDesignName = autoName;
    } else {
      var name = prompt('Design name:', currentDesignName || 'Untitled Design');
      if (!name) return false;
      currentDesignId = generateId();
      currentDesignName = name;
    }

    var designs = getSavedDesigns();
    designs.unshift({
      id: currentDesignId,
      name: currentDesignName,
      width: pageWidth,
      height: pageHeight,
      canvasJSON: canvasJSON,
      thumbnail: thumb,
      bgMode: bgMode,
      bgSolidColor: bgSolidColor,
      bgGradColor1: bgGradColor1,
      bgGradColor2: bgGradColor2,
      bgGradAngle: bgGradAngle,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    persistDesigns(designs);
    updateSaveIndicator('Saved at ' + formatSaveTime(now));
    return true;
  }

  function autoSave() {
    if (!dsCanvas) return;
    saveDesignData(true);
  }

  window._dsSaveDesign = function () {
    if (saveDesignData(false)) {
      if (typeof showToast === 'function') showToast('Design saved!', 'success');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // BACKGROUND CONTROLS
  // ═══════════════════════════════════════════════════════════

  window._dsBgMode = function (mode) {
    bgMode = mode;
    if (mode === 'solid') {
      if (pageBackground) pageBackground.set('fill', bgSolidColor);
    } else {
      if (pageBackground) pageBackground.set('fill', makeGradient(pageWidth, pageHeight, bgGradColor1, bgGradColor2, bgGradAngle));
    }
    if (dsCanvas) dsCanvas.requestRenderAll();
    saveHistory();
    refreshBgUI();
  };

  window._dsBgSolid = function (color) {
    bgSolidColor = color;
    if (pageBackground) pageBackground.set('fill', color);
    if (dsCanvas) { dsCanvas.requestRenderAll(); saveHistory(); }
  };

  window._dsBgGradUpdate = function () {
    var c1El = document.getElementById('ds-bg-gc1');
    var c2El = document.getElementById('ds-bg-gc2');
    var aEl = document.getElementById('ds-bg-ga');
    if (c1El) bgGradColor1 = c1El.value;
    if (c2El) bgGradColor2 = c2El.value;
    if (aEl) bgGradAngle = parseInt(aEl.value);
    if (pageBackground) pageBackground.set('fill', makeGradient(pageWidth, pageHeight, bgGradColor1, bgGradColor2, bgGradAngle));
    if (dsCanvas) { dsCanvas.requestRenderAll(); saveHistory(); }
  };

  function refreshBgUI() {
    var container = document.getElementById('ds-bg-controls');
    if (!container) return;
    document.querySelectorAll('.ds-panel .ds-fill-mode-btn').forEach(function (b) {
      if (b.closest('#ds-bg-controls') || b.onclick) return;
    });
    var btns = container.parentElement.querySelectorAll('.ds-fill-mode-btn');
    btns.forEach(function (b) {
      var isSolid = b.textContent.trim() === 'Solid';
      b.classList.toggle('active', (bgMode === 'solid') === isSolid);
    });

    if (bgMode === 'solid') {
      container.innerHTML = '<div class="ds-prop-row"><label class="wide">Color</label><input type="color" id="ds-bg-color" value="' + bgSolidColor + '" oninput="window._dsBgSolid(this.value)"></div>';
    } else {
      container.innerHTML = '<div class="ds-prop-row"><label class="wide">Color 1</label><input type="color" id="ds-bg-gc1" value="' + bgGradColor1 + '" oninput="window._dsBgGradUpdate()"></div>' +
        '<div class="ds-prop-row"><label class="wide">Color 2</label><input type="color" id="ds-bg-gc2" value="' + bgGradColor2 + '" oninput="window._dsBgGradUpdate()"></div>' +
        '<div class="ds-prop-row"><label class="wide">Angle</label><input type="range" id="ds-bg-ga" min="0" max="360" value="' + bgGradAngle + '" oninput="window._dsBgGradUpdate();this.nextElementSibling.textContent=this.value+\'\\u00b0\'"><span class="ds-range-val">' + bgGradAngle + '\u00b0</span></div>';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // OBJECT GRADIENT CONTROLS
  // ═══════════════════════════════════════════════════════════

  window._dsObjFillMode = function (mode) {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    if (mode === 'solid') {
      var st = readFillState(obj);
      obj.set('fill', st.mode === 'gradient' ? st.color1 : (st.color || '#4f46e5'));
    } else {
      var w = obj.width || 100;
      var h = obj.height || 100;
      obj.set('fill', makeGradient(w, h, '#4f46e5', '#8b5cf6', 0));
    }
    dsCanvas.requestRenderAll();
    saveHistory();
    updatePropsPanel();
  };

  window._dsObjGradUpdate = function () {
    var obj = dsCanvas.getActiveObject();
    if (!obj) return;
    var c1El = document.getElementById('ds-obj-gc1');
    var c2El = document.getElementById('ds-obj-gc2');
    var aEl = document.getElementById('ds-obj-ga');
    var c1 = c1El ? c1El.value : '#4f46e5';
    var c2 = c2El ? c2El.value : '#8b5cf6';
    var a = aEl ? parseInt(aEl.value) : 0;
    var w = obj.width || 100;
    var h = obj.height || 100;
    obj.set('fill', makeGradient(w, h, c1, c2, a));
    dsCanvas.requestRenderAll();
    saveHistory();
  };

  // ═══════════════════════════════════════════════════════════
  // BACKGROUND REMOVAL (placeholder)
  // ═══════════════════════════════════════════════════════════

  window._dsRemoveBg = function () {
    if (typeof showToast === 'function') {
      showToast('Background removal requires a server-side ML API. This is a placeholder for future integration.', 'info');
    } else {
      alert('Background removal requires a server-side ML API.\nThis is a placeholder for future integration.');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  function getExportDataURL(multiplier) {
    if (!dsCanvas) return null;
    dsCanvas.discardActiveObject();
    dsCanvas.requestRenderAll();

    var origVPT = dsCanvas.viewportTransform.slice();
    var origW = dsCanvas.getWidth();
    var origH = dsCanvas.getHeight();
    var origBg = dsCanvas.backgroundColor;

    dsCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    dsCanvas.setDimensions({ width: pageWidth, height: pageHeight });
    dsCanvas.backgroundColor = 'transparent';
    dsCanvas.renderAll();

    var url = dsCanvas.toDataURL({ format: 'png', quality: 1, multiplier: multiplier || 2 });

    dsCanvas.viewportTransform = origVPT;
    dsCanvas.setDimensions({ width: origW, height: origH });
    dsCanvas.backgroundColor = origBg;
    dsCanvas.renderAll();

    return url;
  }

  window._dsExportPNG = function () {
    var url = getExportDataURL(2);
    if (!url) return;
    var a = document.createElement('a');
    a.href = url;
    a.download = 'design-' + Date.now() + '.png';
    a.click();
    if (typeof showToast === 'function') showToast('PNG exported successfully!', 'success');
  };

  window._dsExportPDF = function () {
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
      if (typeof showToast === 'function') showToast('jsPDF library not loaded. PDF export unavailable.', 'error');
      else alert('jsPDF library not loaded.');
      return;
    }
    var url = getExportDataURL(2);
    if (!url) return;

    var orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';
    var pdf = new jspdf.jsPDF({ orientation: orientation, unit: 'px', format: [pageWidth, pageHeight], hotfixes: ['px_scaling'] });
    pdf.addImage(url, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.save('design-' + Date.now() + '.pdf');
    if (typeof showToast === 'function') showToast('PDF exported successfully!', 'success');
  };

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════

  function cleanup() {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (dsCanvas) { dsCanvas.dispose(); dsCanvas = null; }
    fabric.Object.prototype.set({
      transparentCorners: true,
      cornerColor: 'rgb(178,204,255)',
      cornerStrokeColor: '',
      cornerSize: 13,
      cornerStyle: 'rect',
      borderColor: 'rgb(178,204,255)',
      borderScaleFactor: 1,
      padding: 0,
    });
    pageBackground = null;
    undoStack = [];
    redoStack = [];
    clipboard = null;
    isPanning = false;
    spaceHeld = false;
    gridEnabled = false;
    objectCounter = 0;
    currentDesignId = null;
    currentDesignName = '';
    bgMode = 'solid';
    bgSolidColor = '#ffffff';
  }

})();
