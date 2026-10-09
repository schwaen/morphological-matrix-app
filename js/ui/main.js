/*
 * Start der App: Ereignisse verdrahten, geteilte Links übernehmen, erstes Zeichnen.
 * Einstieg der App (in index.html als Modul eingebunden).
 */
import { Store } from '../storage.js';
import {
  addCategory, addConcept, addParameter, changeScale, changeSetting, clearActive, generateConcept,
  randomizeActive,
} from './actions.js';
import { initConstraints } from './constraints.js';
import { bindField, flushSave, prefs, redo, save, saveWorkspace, setMode, setPref, setPrinting, state, undo } from './core.js';
import {
  MENU_ACTIONS, exportBackup, exportJson, importJson, loadFromHash, renderLibrary, restoreBackup,
  switchLanguage, toggleMenu,
} from './dialogs.js';
import { $, $$, applyStaticTexts, autosize, closeDialog, darkScheme } from './dom.js';
import { drawLines, scheduleLines } from './lines.js';
import { initNotePop } from './notes.js';
import { renderMatrix } from './render-matrix.js';
import { buildCompareTable, compareContent, render, renderCompare } from './render-panels.js';
import { initSearch } from './search.js';
import { initStart } from './start.js';
import { onExternalDocChange, tabById, toggleTabMenu } from './tabs.js';

function bindEvents() {
  const desc = $('#description');
  bindField(desc, v => { state.description = v; }, () => autosize(desc));

  $$('[data-mode]').forEach(b => {
    b.addEventListener('click', () => setMode(/** @type {TabPrefs['mode']} */ (b.dataset.mode)));
  });
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#addParamBtn').addEventListener('click', () => addParameter(null));
  $('#addCategoryBtn').addEventListener('click', addCategory);
  $('#addConceptBtn').addEventListener('click', addConcept);
  $('#randomBtn').addEventListener('click', randomizeActive);
  $('#clearSelBtn').addEventListener('click', clearActive);
  $$('[data-generate]').forEach(btn => {
    btn.addEventListener('click', () => generateConcept(btn.dataset.generate || ''));
  });
  $$('[data-compare-view]').forEach(b => b.addEventListener('click', () => {
    setPref('compareView', /** @type {'table' | 'chart'} */ (b.dataset.compareView));
    setPref('compareOpen', true);
    renderCompare();
  }));
  $('#compareToggle').addEventListener('click', () => {
    setPref('compareOpen', prefs.compareOpen === false);
    renderCompare();
  });
  $$('[data-lines]').forEach(btn => btn.addEventListener('click', () => {
    setPref('lines', /** @type {TabPrefs['lines']} */ (btn.dataset.lines));
    $$('[data-lines]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    scheduleLines();
  }));

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
  $('#setCosts').addEventListener('change', e => changeSetting('costs', e.target.checked));
  $('#setUtility').addEventListener('change', e => changeSetting('utility', e.target.checked));
  $('#setMoscow').addEventListener('change', e => changeSetting('moscow', e.target.checked));
  $('#setCurrency').addEventListener('change', e => changeSetting('currency', e.target.value));
  $('#setScale').addEventListener('change', e => changeScale(Number(e.target.value)));

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
    renderMatrix();
    buildCompareTable(compareContent());
    $('#compareTable').hidden = false;
    $('#compareChart').hidden = true;
    $('#compareBody').hidden = false;
    drawLines();
  });
  window.addEventListener('afterprint', () => {
    setPrinting(false);
    renderMatrix();
    renderCompare();
    scheduleLines();
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

function init() {
  applyStaticTexts();
  bindEvents();
  initSearch();
  initNotePop();
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
