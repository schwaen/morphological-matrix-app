/*
 * Start der App: Ereignisse verdrahten, geteilte Links übernehmen, erstes Zeichnen.
 * Wird als letztes Skript geladen.
 */
'use strict';

function bindEvents() {
  bindField($('#title'), v => { state.title = v; }, () => {
    document.title = Texts.app.documentTitle(state.title);
    refreshLight();
  });
  const desc = $('#description');
  bindField(desc, v => { state.description = v; }, () => autosize(desc));

  $$('.segmented button').forEach(b => {
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
    btn.addEventListener('click', () => generateConcept(btn.dataset.generate));
  });
  $('#compareToggle').addEventListener('click', () => {
    setPref('compareOpen', prefs.compareOpen === false);
    renderCompare();
  });
  $('#showLines').addEventListener('change', e => {
    setPref('showLines', e.target.checked);
    scheduleLines();
  });

  // Menü
  $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  $('#menuList').addEventListener('click', e => {
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
    if (!/** @type {HTMLElement} */ (e.target).closest('.menu')) toggleMenu(false);
  });

  // Dialoge (Klick auf den Hintergrund schließt)
  for (const id of ['#libraryDialog', '#settingsDialog']) {
    $(id).addEventListener('click', e => { if (e.target === e.currentTarget) closeDialog(e.currentTarget); });
  }
  $('#libraryClose').addEventListener('click', () => closeDialog($('#libraryDialog')));
  $('#settingsClose').addEventListener('click', () => closeDialog($('#settingsDialog')));
  $('#settingsDone').addEventListener('click', () => closeDialog($('#settingsDialog')));
  $('#setCosts').addEventListener('change', e => changeSetting('costs', e.target.checked));
  $('#setUtility').addEventListener('change', e => changeSetting('utility', e.target.checked));
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
    if (!(e.ctrlKey || e.metaKey)) return;
    const inField = /** @type {HTMLElement} */ (e.target).closest('input, textarea');
    const key = e.key.toLowerCase();
    if (key === 's') {
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
    printing = true;
    renderMatrix();
    buildCompareTable();
    $('#compareBody').hidden = false;
    drawLines();
  });
  window.addEventListener('afterprint', () => {
    printing = false;
    renderMatrix();
    renderCompare();
    scheduleLines();
  });

  // Nur wenn ein anderer Tab dieselbe Matrix bearbeitet, dessen Änderungen übernehmen.
  window.addEventListener('storage', e => {
    if (Store.isDocKey(e.key, docId) && e.newValue) adoptExternalChange();
    if ($('#libraryDialog').open) renderLibrary();
  });
}

function init() {
  bindEvents();
  loadFromHash();
  save(); // auch eine neu erzeugte Startmatrix sofort sichern (stabile IDs nach Neuladen)
  // Einstellungen sofort an diesen Tab binden – sonst übernimmt er beim Neuladen die
  // zuletzt in einem anderen Tab verwendeten (Vorgabe aus dem localStorage).
  Store.savePrefs(prefs, { tabOnly: true });
  render();
}

init();
