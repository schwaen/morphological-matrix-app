/*
 * App-Tabs in der Kopfzeile: mehrere Matrizen gleichzeitig geöffnet halten und wechseln.
 * Jeder Tab behält Ansicht, Rückgängig-Verlauf und Scroll-Position. Der aktive Tab zeigt den
 * Titel als Eingabefeld (Doppelklick zum Umbenennen).
 */
import { signal } from '@preact/signals';
import { render as mount } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Icon } from './components.jsx';
import {
  adoptExternalChange, CLOSED_LIMIT, closedTabs, DEFAULT_PREFS, docId, fieldProps, flushSave, lastSaved,
  pickView, prefs, redoStack, save, saveWorkspace, setActiveDoc, setClosedTabs, state, tabs, undoStack,
  useMatrix,
} from './core.js';
import { MENU_ACTIONS } from './dialogs.jsx';
import { $, placeNear, toast } from './dom.jsx';
import { render } from './render-panels.jsx';
import { Util } from '../util.js';

const activeTab = () => tabs.find(t => t.docId === docId);
/** @param {string} id */
export const tabById = id => tabs.find(t => t.docId === id) || null;

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
  setActiveDoc(t);
  // Ansicht des Tabs übernehmen; fehlende Werte (z. B. neuer Tab) mit Standardwerten
  prefs.mode = t.view.mode || DEFAULT_PREFS.mode;
  prefs.compareOpen = t.view.compareOpen ?? DEFAULT_PREFS.compareOpen;
  prefs.compareView = t.view.compareView || DEFAULT_PREFS.compareView;
  prefs.compareDiff = t.view.compareDiff ?? DEFAULT_PREFS.compareDiff;
  prefs.compareSort = t.view.compareSort || DEFAULT_PREFS.compareSort;
  prefs.compareHideConflicts = t.view.compareHideConflicts ?? DEFAULT_PREFS.compareHideConflicts;
  prefs.collapsed = t.view.collapsed || {};
  t.external = false;
}

/** Zu einem geöffneten Tab wechseln. @param {string} id */
export function activateTab(id) {
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
export function openInTab(id, data, message) {
  if (tabById(id)) {
    activateTab(id);
  } else {
    stashActiveTab();
    const current = activeTab();
    const at = current ? tabs.indexOf(current) + 1 : tabs.length;
    /** @type {AppTab} */
    const t = { docId: id, view: { mode: prefs.mode, compareOpen: prefs.compareOpen, compareView: prefs.compareView, compareDiff: prefs.compareDiff, compareSort: prefs.compareSort, compareHideConflicts: prefs.compareHideConflicts }, state: data, lastSaved: null };
    tabs.splice(at, 0, t);
    setClosedTabs(closedTabs.filter(x => x !== id));
    loadTab(t);
    save();
    saveWorkspace();
    render();
    window.scrollTo(0, 0);
  }
  if (message) toast(message);
}

/** Neue Matrix anlegen und in einem neuen Tab öffnen. */
export function openNewDoc(data, message) {
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
  setClosedTabs([id, ...closedTabs.filter(x => x !== id)].slice(0, CLOSED_LIMIT));
  if (wasActive) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    loadTab(next);
    saveWorkspace();
    render();
    window.scrollTo(0, next.scrollY || 0);
  } else {
    saveWorkspace();
    render();
  }
}

/** Zuletzt geschlossenen Tab wieder öffnen. @param {string} id */
export function reopenTab(id) {
  const doc = Store.readDoc(id);
  if (!doc) {
    setClosedTabs(closedTabs.filter(x => x !== id));
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
  render();
}

/**
 * Ein anderer Browser-Tab hat eine hier geöffnete Matrix geändert: aktiven Tab sofort
 * aktualisieren, inaktive neu laden und mit einem Punkt markieren.
 * @param {string} id
 */
export function onExternalDocChange(id) {
  if (id === docId) { adoptExternalChange(); return; }
  const t = tabById(id);
  const doc = t && Store.readDoc(id);
  if (!doc) return;
  Object.assign(t, { state: doc.data, undo: [], redo: [], lastSaved: JSON.stringify(doc.data), external: true });
  render();
}

// ---------- Darstellung ----------

/** Titel eines Tabs (aktiver Tab: aktueller Stand). @param {AppTab} t */
const tabTitle = t => ((t.docId === docId ? state : t.state)?.title || Texts.fallback.unnamedMatrix);

/** Titel des aktiven Tabs wird gerade umbenannt (Doppelklick). */
const renaming = signal(false);
/** Menü „+“ geöffnet. */
const tabMenuOpen = signal(false);

/** Tab-Leiste mit dem Knopf „+“ (`#appTabs`). */
function TabBar() {
  useMatrix();
  // Aktiven Tab nur waagerecht in Sicht bringen (scrollIntoView würde auch die Seite verschieben)
  useLayoutEffect(() => {
    const bar = /** @type {HTMLElement} */ (document.getElementById('appTabs'));
    const current = /** @type {HTMLElement | null} */ (bar.querySelector('.app-tab.is-active'));
    if (!current) return;
    const left = current.offsetLeft - bar.offsetLeft;
    const right = left + current.offsetWidth;
    if (left < bar.scrollLeft) bar.scrollLeft = left;
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  });
  const closable = tabs.length > 1;
  /** @param {Event} e */
  const onClose = e => !!/** @type {HTMLElement} */ (e.target).closest('.tab-close');
  return (
    <>
      {tabs.map((t, i) => {
        const active = t.docId === docId;
        const title = tabTitle(t);
        return (
          <div
            key={t.docId}
            class={`app-tab${active ? ' is-active' : ''}`} role="tab" aria-selected={active} draggable
            title={active ? Texts.tabs.renameHint : title} data-doc={t.docId}
            onClick={e => { if (!onClose(e)) activateTab(t.docId); }}
            onDblClick={e => { if (!onClose(e)) startRenaming(); }}
            // Mittlere Maustaste schließt den Tab
            onAuxClick={e => { if (e.button === 1) { e.preventDefault(); closeTab(t.docId); } }}
            onMouseDown={e => { if (e.button === 1) e.preventDefault(); }}
            onDragStart={e => {
              const dt = /** @type {DataTransfer} */ (e.dataTransfer);
              dt.setData('text/plain', t.docId);
              dt.effectAllowed = 'move';
            }}
            onDragOver={e => { e.preventDefault(); /** @type {DataTransfer} */ (e.dataTransfer).dropEffect = 'move'; }}
            onDrop={e => {
              e.preventDefault();
              const id = /** @type {DataTransfer} */ (e.dataTransfer).getData('text/plain');
              if (id) moveTab(id, i);
            }}
          >
            {t.external ? <span class="tab-dot" title={Texts.tabs.external} aria-label={Texts.tabs.external} /> : null}
            {active ? <TitleInput /> : <span class="tab-title">{title}</span>}
            {closable ? (
              <button type="button" class="tab-close" title={Texts.tabs.close} aria-label={Texts.tabs.closeNamed(title)} onClick={() => closeTab(t.docId)}>
                <Icon name="x" />
              </button>
            ) : null}
          </div>
        );
      })}
      <button
        type="button" class="tab-add" id="tabAddBtn" title={Texts.tabs.add} aria-label={Texts.tabs.add}
        aria-haspopup="true" aria-expanded={tabMenuOpen.value}
        onClick={e => { e.stopPropagation(); toggleTabMenu(); }}
      ><Icon name="plus" /></button>
    </>
  );
}

/** Titel des aktiven Tabs: schreibgeschützt, Doppelklick zum Bearbeiten. */
function TitleInput() {
  useMatrix();
  return (
    <input
      id="title" class="tab-title-input" type="text" value={state.title} readOnly={!renaming.value}
      autocomplete="off" aria-label={Texts.tabs.titleLabel} placeholder={Texts.tabs.titleLabel}
      size={Math.max(8, Math.min(32, (state.title || '').length + 1))}
      {...fieldProps(v => { state.title = v; })}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') /** @type {HTMLElement} */ (e.currentTarget).blur(); }}
      onBlur={() => { renaming.value = false; }}
    />
  );
}

function startRenaming() {
  renaming.value = true;
  const input = $('#title');
  if (!input) return;
  input.focus();
  input.select();
}

// ---------- Menü „+“ ----------

/** @param {boolean} [open] */
export function toggleTabMenu(open) {
  const menu = $('#tabMenu');
  const willOpen = open ?? menu.hidden;
  if (!willOpen && menu.hidden) return;
  tabMenuOpen.value = willOpen;
  menu.hidden = !willOpen;
  if (willOpen) {
    placeNear(menu, $('#tabAddBtn'));
    menu.querySelector('button').focus();
  }
}

/** Einträge des Menüs „+“: neu, Beispiel, Import, Bibliothek, zuletzt geschlossene Tabs. */
function TabMenu() {
  useMatrix();
  if (!tabMenuOpen.value) return null;
  /** @param {{ label: string, action: () => void }} props */
  const Item = ({ label, action }) => (
    <button type="button" role="menuitem" onClick={() => { toggleTabMenu(false); action(); }}>{label}</button>
  );
  const recent = closedTabs
    .filter(id => !tabById(id))
    .flatMap(id => { const doc = Store.readDoc(id); return doc ? [doc] : []; })
    .slice(0, 5);
  return (
    <>
      <Item label={Texts.tabs.newBlank} action={MENU_ACTIONS.new} />
      <Item label={Texts.tabs.example} action={MENU_ACTIONS.example} />
      <Item label={Texts.tabs.importJson} action={MENU_ACTIONS['import-json']} />
      <hr />
      <Item label={Texts.tabs.fromLibrary} action={MENU_ACTIONS.open} />
      {recent.length ? <><hr /><div class="menu-label">{Texts.tabs.recentlyClosed}</div></> : null}
      {recent.map(doc => <Item key={doc.id} label={doc.data.title || Texts.fallback.unnamedMatrix} action={() => reopenTab(doc.id)} />)}
    </>
  );
}

export function initTabs() {
  mount(<TabBar />, $('#appTabs'));
  mount(<TabMenu />, $('#tabMenu'));
}
