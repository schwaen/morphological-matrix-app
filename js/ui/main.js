/*
 * Start der App: Ereignisse verdrahten, geteilte Links übernehmen, erstes Zeichnen.
 * Einstieg der App (in index.html als Modul eingebunden).
 */
import { Component, options } from 'preact';
import { Store } from '../storage.js';
import { addConcept, clearActive, randomizeActive } from './actions.js';
import { initConstraints } from './constraints.jsx';
import { bindField, flushSave, prefs, redo, render, save, saveWorkspace, setPrinting, state, undo } from './core.js';
import {
  MENU_ACTIONS, exportBackup, exportJson, importJson, loadFromHash, renderLibrary, restoreBackup,
  switchLanguage, toggleMenu,
} from './dialogs.jsx';
import { $, $$, applyStaticTexts, autosize, closeDialog, darkScheme } from './dom.jsx';
import { drawLines, scheduleLines } from './lines.js';
import { initNotePop } from './notes.jsx';
import { initPanels } from './render-panels.jsx';
import { initSearch } from './search.js';
import { initStart } from './start.jsx';
import { initTabs, onExternalDocChange, tabById, toggleTabMenu } from './tabs.jsx';
import { initMatrix } from './render-matrix.jsx';
import { initChrome } from './chrome.jsx';

function bindEvents() {
  const desc = $('#description');
  bindField(desc, v => { state.description = v; }, () => autosize(desc));

  $('#addConceptBtn').addEventListener('click', addConcept);
  $('#randomBtn').addEventListener('click', randomizeActive);
  $('#clearSelBtn').addEventListener('click', clearActive);

  // Menü
  $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  $('#menuList').addEventListener('click', e => {
    const lang = e.target.closest('[data-lang]');
    if (lang) { toggleMenu(false); switchLanguage(lang.dataset.lang); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    toggleMenu(false);
    MENU_ACTIONS[btn.dataset.action]();
  });
  $('#menuList').addEventListener('keydown', e => {
    const items = $$('button', $('#menuList'));
    const i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener('click', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target.closest('.menu')) toggleMenu(false);
    if (!target.closest('#tabMenu')) toggleTabMenu(false);
  });
  $('#tabMenu').addEventListener('keydown', e => {
    const items = $$('button', $('#tabMenu'));
    const i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });

  // Dialoge (Klick auf den Hintergrund schließt)
  for (const id of ['#libraryDialog', '#examplesDialog', '#settingsDialog']) {
    $(id).addEventListener('click', e => { if (e.target === e.currentTarget) closeDialog(e.currentTarget); });
  }
  $('#libraryClose').addEventListener('click', () => closeDialog($('#libraryDialog')));
  $('#backupExportBtn').addEventListener('click', exportBackup);
  $('#backupRestoreBtn').addEventListener('click', () => $('#backupFile').click());
  $('#backupFile').addEventListener('change', e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) restoreBackup(files);
  });
  $('#examplesClose').addEventListener('click', () => closeDialog($('#examplesDialog')));
  $('#settingsClose').addEventListener('click', () => closeDialog($('#settingsDialog')));
  $('#settingsDone').addEventListener('click', () => closeDialog($('#settingsDialog')));

  $('#importFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) importJson(file);
    e.target.value = '';
  });

  // Tastenkürzel
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#menuList').hidden) {
      toggleMenu(false);
      $('#menuBtn').focus();
      return;
    }
    if (e.key === 'Escape' && !$('#tabMenu').hidden) {
      toggleTabMenu(false);
      $('#tabAddBtn').focus();
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const inField = /** @type {HTMLElement} */ (e.target).closest('input, textarea');
    const key = e.key.toLowerCase();
    if (key === 'f' && !e.shiftKey && !e.altKey && document.activeElement !== $('#matrixSearch')) {
      // Strg+F: Suche der App (findet auch Text in Eingabefeldern und eingeklappten Kategorien);
      // ein zweites Strg+F im Suchfeld öffnet die Suche des Browsers
      e.preventDefault();
      $('#matrixSearch').focus();
      $('#matrixSearch').select();
    } else if (key === 's') {
      e.preventDefault();
      exportJson();
    } else if (!inField && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (!inField && key === 'y') {
      e.preventDefault();
      redo();
    }
  });

  // Linien bei Größenänderungen neu berechnen
  if ('ResizeObserver' in window) new ResizeObserver(scheduleLines).observe($('#matrix'));
  window.addEventListener('resize', scheduleLines);

  // Beim Drucken alle Kategorien und den Vergleich vollständig ausgeben
  window.addEventListener('beforeprint', () => {
    setPrinting(true);
    render();
    drawLines();
  });
  window.addEventListener('afterprint', () => {
    setPrinting(false);
    render();
  });

  // Farbschema des Systems gewechselt: Konzeptfarben in der passenden Stufe neu zeichnen
  darkScheme.addEventListener('change', render);

  // Beim Verlassen der Seite bzw. Wechsel in den Hintergrund ausstehende Eingaben sofort speichern
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

  // Änderungen anderer Browser-Tabs an hier geöffneten Matrizen übernehmen.
  window.addEventListener('storage', e => {
    const id = Store.docIdFromKey(e.key);
    if (id && e.newValue && tabById(id)) onExternalDocChange(id);
    if ($('#libraryDialog').open) renderLibrary();
  });
}

// Komponenten sofort neu zeichnen statt gesammelt im nächsten Mikrotask: Code, der nach einer
// Änderung das DOM braucht (Fokus setzen, Verbindungslinien messen), findet es so schon vor.
options.debounceRendering = cb => cb();
// @preact/signals überspringt Komponenten, die selbst ein Signal lesen, wenn ihre Props gleich
// bleiben. Die Matrix ist aber ein veränderliches Objekt – gleiche Props heißen nicht gleicher
// Inhalt. Daher wie in Preact üblich: jede Komponente zeichnet mit ihrer Elternkomponente neu.
// (Eigene shouldComponentUpdate-Methoden einzelner Komponenten bleiben wirksam.)
delete (/** @type {any} */ (Component.prototype)).shouldComponentUpdate;

function init() {
  applyStaticTexts();
  bindEvents();
  initSearch();
  initNotePop();
  initChrome();
  initTabs();
  initMatrix();
  initPanels();
  initConstraints();
  initStart();
  save(); // auch eine neu erzeugte Startmatrix sofort sichern (stabile IDs nach Neuladen)
  // Einstellungen und geöffnete Tabs sofort an diesen Browser-Tab binden – sonst übernähme er
  // beim Neuladen die zuletzt in einem anderen Browser-Tab verwendeten (Vorgabe im localStorage).
  Store.savePrefs(prefs, { tabOnly: true });
  saveWorkspace({ tabOnly: true });
  render();
  loadFromHash();
}

init();
