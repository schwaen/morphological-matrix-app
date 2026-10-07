/*
 * App-Tabs in der Kopfzeile: mehrere Matrizen gleichzeitig geöffnet halten und wechseln.
 * Jeder Tab behält Ansicht, Rückgängig-Verlauf und Scroll-Position. Der aktive Tab zeigt den
 * Titel als Eingabefeld (Doppelklick zum Umbenennen).
 */
'use strict';

const activeTab = () => tabs.find(t => t.docId === docId);
/** @param {string} id */
const tabById = id => tabs.find(t => t.docId === id) || null;

/** Stand des aktiven Tabs in seinem Eintrag ablegen (vor einem Wechsel). */
function stashActiveTab() {
  flushSave(); // ausstehende Eingaben noch unter der bisherigen Matrix speichern
  const t = activeTab();
  if (!t) return;
  Object.assign(t, {
    state, undo: undoStack, redo: redoStack, lastSaved, view: pickView(prefs), scrollY: window.scrollY,
  });
}

/** Stand eines Tab-Eintrags als aktiven Stand laden. @param {AppTab} t */
function loadTab(t) {
  docId = t.docId;
  state = /** @type {Matrix} */ (t.state); // Tab-Einträge halten ihre Matrix immer bereit
  undoStack = t.undo || [];
  redoStack = t.redo || [];
  // `null` heißt „noch nie gespeichert“ (neuer Tab) – nicht mit „unbekannt“ verwechseln
  lastSaved = t.lastSaved !== undefined ? t.lastSaved : JSON.stringify(state);
  // Ansicht des Tabs übernehmen; fehlende Werte (z. B. neuer Tab) mit Standardwerten
  prefs.mode = t.view.mode || DEFAULT_PREFS.mode;
  prefs.compareOpen = t.view.compareOpen ?? DEFAULT_PREFS.compareOpen;
  prefs.compareView = t.view.compareView || DEFAULT_PREFS.compareView;
  prefs.collapsed = t.view.collapsed || {};
  t.external = false;
}

/** Zu einem geöffneten Tab wechseln. @param {string} id */
function activateTab(id) {
  if (id === docId) return;
  const t = tabById(id);
  if (!t) return;
  stashActiveTab();
  loadTab(t);
  saveWorkspace();
  render();
  window.scrollTo(0, t.scrollY || 0);
}

/**
 * Matrix in einem App-Tab öffnen – ist sie schon offen, dorthin wechseln.
 * @param {string} id @param {Matrix} data @param {string} [message]
 */
function openInTab(id, data, message) {
  if (tabById(id)) {
    activateTab(id);
  } else {
    stashActiveTab();
    const current = activeTab();
    const at = current ? tabs.indexOf(current) + 1 : tabs.length;
    /** @type {AppTab} */
    const t = { docId: id, view: { mode: prefs.mode, compareOpen: prefs.compareOpen, compareView: prefs.compareView }, state: data, lastSaved: null };
    tabs.splice(at, 0, t);
    closedTabs = closedTabs.filter(x => x !== id);
    loadTab(t);
    save();
    saveWorkspace();
    render();
    window.scrollTo(0, 0);
  }
  if (message) toast(message);
}

/** Neue Matrix anlegen und in einem neuen Tab öffnen. */
function openNewDoc(data, message) {
  openInTab(Util.uid(), data, message);
}

/** Tab schließen; die Matrix bleibt gespeichert. Der letzte Tab bleibt immer offen. @param {string} id */
function closeTab(id) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex(t => t.docId === id);
  if (idx < 0) return;
  const wasActive = id === docId;
  if (wasActive) stashActiveTab();
  tabs.splice(idx, 1);
  closedTabs = [id, ...closedTabs.filter(x => x !== id)].slice(0, CLOSED_LIMIT);
  if (wasActive) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    loadTab(next);
    saveWorkspace();
    render();
    window.scrollTo(0, next.scrollY || 0);
  } else {
    saveWorkspace();
    renderTabs();
  }
}

/** Zuletzt geschlossenen Tab wieder öffnen. @param {string} id */
function reopenTab(id) {
  const doc = Store.readDoc(id);
  if (!doc) {
    closedTabs = closedTabs.filter(x => x !== id);
    saveWorkspace();
    toast(Texts.errors.docMissing);
    return;
  }
  openInTab(doc.id, doc.data);
}

/** Tab an eine neue Position verschieben. @param {string} id @param {number} to */
function moveTab(id, to) {
  const from = tabs.findIndex(t => t.docId === id);
  if (from < 0 || from === to) return;
  const [t] = tabs.splice(from, 1);
  tabs.splice(Math.min(to, tabs.length), 0, t);
  saveWorkspace();
  renderTabs();
}

/**
 * Ein anderer Browser-Tab hat eine hier geöffnete Matrix geändert: aktiven Tab sofort
 * aktualisieren, inaktive neu laden und mit einem Punkt markieren.
 * @param {string} id
 */
function onExternalDocChange(id) {
  if (id === docId) { adoptExternalChange(); return; }
  const t = tabById(id);
  const doc = t && Store.readDoc(id);
  if (!doc) return;
  Object.assign(t, { state: doc.data, undo: [], redo: [], lastSaved: JSON.stringify(doc.data), external: true });
  renderTabs();
}

// ---------- Darstellung ----------

/** Titel eines Tabs (aktiver Tab: aktueller Stand). @param {AppTab} t */
const tabTitle = t => ((t.docId === docId ? state : t.state)?.title || Texts.fallback.unnamedMatrix);

function renderTabs() {
  const nav = $('#appTabs');
  const closable = tabs.length > 1;
  const items = tabs.map((t, i) => {
    const active = t.docId === docId;
    const title = tabTitle(t);
    const el = h('div', {
      class: `app-tab${active ? ' is-active' : ''}`,
      role: 'tab', 'aria-selected': String(active), draggable: 'true',
      title: active ? Texts.tabs.renameHint : title,
      dataset: { doc: t.docId },
      onclick: e => { if (!e.target.closest('.tab-close')) activateTab(t.docId); },
      ondblclick: e => { if (!e.target.closest('.tab-close')) startRenaming(); },
      // Mittlere Maustaste schließt den Tab
      onauxclick: e => { if (e.button === 1) { e.preventDefault(); closeTab(t.docId); } },
      onmousedown: e => { if (e.button === 1) e.preventDefault(); },
      ondragstart: e => {
        e.dataTransfer.setData('text/plain', t.docId);
        e.dataTransfer.effectAllowed = 'move';
      },
      ondragover: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
      ondrop: e => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) moveTab(id, i);
      },
    },
    t.external ? h('span', { class: 'tab-dot', title: Texts.tabs.external, 'aria-label': Texts.tabs.external }) : null,
    active ? titleInput() : h('span', { class: 'tab-title' }, title),
    closable
      ? h('button', {
        type: 'button', class: 'tab-close', title: Texts.tabs.close, 'aria-label': Texts.tabs.closeNamed(title),
        onclick: () => closeTab(t.docId),
      }, icon('x'))
      : null);
    return el;
  });
  replaceWith(nav, ...items,
    h('button', {
      type: 'button', class: 'tab-add', id: 'tabAddBtn', title: Texts.tabs.add, 'aria-label': Texts.tabs.add,
      'aria-haspopup': 'true', 'aria-expanded': 'false',
      onclick: e => { e.stopPropagation(); toggleTabMenu(); },
    }, icon('plus')));
  scrollActiveTabIntoView(nav);
}

/** Aktiven Tab nur waagerecht in Sicht bringen (scrollIntoView würde auch die Seite verschieben). */
function scrollActiveTabIntoView(nav) {
  const current = nav.querySelector('.app-tab.is-active');
  if (!current) return;
  const left = current.offsetLeft - nav.offsetLeft;
  const right = left + current.offsetWidth;
  if (left < nav.scrollLeft) nav.scrollLeft = left;
  else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
}

/** Titel des aktiven Tabs: schreibgeschützt, Doppelklick zum Bearbeiten. */
function titleInput() {
  const input = h('input', {
    id: 'title', class: 'tab-title-input', type: 'text', value: state.title, readonly: true,
    autocomplete: 'off', 'aria-label': Texts.tabs.titleLabel, placeholder: Texts.tabs.titleLabel,
    size: Math.max(8, Math.min(32, (state.title || '').length + 1)),
    onkeydown: e => {
      if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
    },
    // Nicht neu zeichnen: ein Klick auf einen anderen Tab, der das Feld verlässt, ginge sonst verloren
    onblur: () => { input.readOnly = true; },
  });
  bindField(input, v => { state.title = v; }, () => {
    document.title = Texts.app.documentTitle(state.title);
    input.size = Math.max(8, Math.min(32, input.value.length + 1));
    refreshLight();
  });
  return input;
}

function startRenaming() {
  const input = $('#title');
  if (!input) return;
  input.readOnly = false;
  input.focus();
  input.select();
}

// ---------- Menü „+“ ----------

function toggleTabMenu(open) {
  const menu = $('#tabMenu');
  const btn = $('#tabAddBtn');
  const willOpen = open ?? menu.hidden;
  if (willOpen) {
    renderTabMenu();
    const r = btn.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 280))}px`;
    menu.style.top = `${r.bottom + 6}px`;
  }
  menu.hidden = !willOpen;
  if (btn) btn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) menu.querySelector('button').focus();
}

function renderTabMenu() {
  const item = (label, action) => h('button', {
    type: 'button', role: 'menuitem',
    onclick: () => { toggleTabMenu(false); action(); },
  }, label);
  const recent = closedTabs
    .filter(id => !tabById(id))
    .flatMap(id => { const doc = Store.readDoc(id); return doc ? [doc] : []; })
    .slice(0, 5);
  replaceWith($('#tabMenu'),
    item(Texts.tabs.newBlank, MENU_ACTIONS.new),
    item(Texts.tabs.example, MENU_ACTIONS.example),
    item(Texts.tabs.importJson, MENU_ACTIONS['import-json']),
    h('hr'),
    item(Texts.tabs.fromLibrary, MENU_ACTIONS.open),
    recent.length ? [h('hr'), h('div', { class: 'menu-label' }, Texts.tabs.recentlyClosed)] : null,
    recent.map(doc => item(doc.data.title || Texts.fallback.unnamedMatrix, () => reopenTab(doc.id))));
}
