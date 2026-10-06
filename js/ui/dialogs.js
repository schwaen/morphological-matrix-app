/*
 * Menü „Datei“ und Dialoge: Bibliothek („Meine Matrizen“), Beispiele, Bewertungseinstellungen,
 * Import/Export, Teilen und Drucken.
 */
'use strict';

// ---------- Import / Export / Teilen ----------

function exportJson() {
  download(IO.fileName(state, 'json'), IO.toJson(state), 'application/json');
}

function exportCsv() {
  download(IO.fileName(state, 'csv'), IO.toCsv(state), 'text/csv;charset=utf-8');
}

/** @param {File} file */
function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = Model.normalize(JSON.parse(String(reader.result)));
      openNewDoc(next, Texts.toast.opened(next.title || file.name));
    } catch (e) {
      toast(Texts.errors.fileInvalid(e.message));
    }
  };
  reader.onerror = () => toast(Texts.errors.fileUnreadable);
  reader.readAsText(file);
}

async function shareLink() {
  const url = `${location.href.split('#')[0]}#m=${IO.encodeShare(state)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast(Texts.toast.linkCopied);
  } catch (e) {
    window.prompt(Texts.prompt.shareLink, url);
  }
}

/** Öffnet eine per Link geteilte Matrix als neue Matrix in einem neuen App-Tab. */
function loadFromHash() {
  try {
    const next = IO.decodeShareHash(location.hash);
    if (!next) return;
    openNewDoc(next, Texts.toast.sharedOpened(next.title));
  } catch (e) {
    toast(Texts.errors.shareInvalid);
  }
  history.replaceState(null, '', location.pathname + location.search);
}

function printMatrix() {
  if (prefs.mode !== 'select') setMode('select');
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

// ---------- Bibliothek ----------

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

function openLibrary() {
  renderLibrary();
  openDialog($('#libraryDialog'));
}

function renderLibrary() {
  const docs = Store.listDocs();
  if (!docs.some(d => d.id === docId)) docs.unshift({ id: docId, savedAt: Date.now(), data: state });
  const items = docs.map(doc => {
    const current = doc.id === docId;
    const open = !!tabById(doc.id);
    const data = current ? state : doc.data;
    const title = data.title || Texts.fallback.unnamedMatrix;
    const P = data.parameters.length;
    const C = data.concepts.length;
    return h('li', { class: `doc${current ? ' is-current' : ''}${open ? ' is-open' : ''}` },
      h('div', { class: 'doc-info' },
        h('span', { class: 'doc-title' }, title,
          open ? h('span', { class: 'badge' }, current ? Texts.library.currentTab : Texts.library.openTab) : null),
        h('span', { class: 'doc-meta' }, Texts.library.meta(dateFormat.format(new Date(doc.savedAt)), P, C))),
      h('div', { class: 'doc-actions' },
        h('button', {
          type: 'button', class: 'btn btn-small', disabled: current,
          onclick: () => {
            closeDialog($('#libraryDialog'));
            if (open) { activateTab(doc.id); return; }
            const fresh = Store.readDoc(doc.id);
            if (!fresh) { toast(Texts.errors.docMissing); return; }
            openInTab(fresh.id, fresh.data, Texts.toast.opened(fresh.data.title || Texts.fallback.unnamedMatrix));
          },
        }, open ? Texts.library.show : Texts.library.open),
        iconBtn('trash', open ? Texts.library.deleteOpen : Texts.library.delete, () => {
          if (!window.confirm(Texts.prompt.deleteMatrix(title))) return;
          Store.removeDoc(doc.id);
          closedTabs = closedTabs.filter(x => x !== doc.id);
          saveWorkspace();
          renderLibrary();
        }, { danger: true, disabled: open })));
  });
  $('#docList').replaceChildren(...items);
}

// ---------- Beispiele ----------

function openExamples() {
  renderExamples();
  openDialog($('#examplesDialog'));
}

function renderExamples() {
  const examples = Examples.all();
  const items = examples.map(ex => {
    const d = /** @type {any} */ (ex.data);
    const count = v => (Array.isArray(v) ? v.length : 0);
    return h('li', { class: 'doc' },
      h('div', { class: 'doc-info' },
        h('span', { class: 'doc-title' }, ex.name),
        ex.description ? h('span', { class: 'doc-desc' }, ex.description) : null,
        h('span', { class: 'doc-meta' }, Texts.examples.meta(count(d.parameters), count(d.categories), count(d.concepts)))),
      h('div', { class: 'doc-actions' },
        h('button', {
          type: 'button', class: 'btn btn-small',
          onclick: () => { closeDialog($('#examplesDialog')); openExample(ex.id); },
        }, Texts.examples.open)));
  });
  $('#exampleList').replaceChildren(...(items.length ? items : [h('li', { class: 'doc-empty' }, Texts.examples.empty)]));
}

/** Beispiel als neue Matrix in einem neuen Tab öffnen. @param {string} id */
function openExample(id) {
  let data;
  try {
    data = Examples.load(id);
  } catch (e) {
    toast(Texts.errors.fileInvalid(e.message));
    return;
  }
  if (data) openNewDoc(data, Texts.toast.exampleOpened(Examples.get(id).name));
}

// ---------- Backup ----------

/** Alle Matrizen als ZIP-Archiv herunterladen (je Matrix eine JSON-Datei). */
async function exportBackup() {
  save();
  const docs = Store.listDocs();
  if (!docs.length) { toast(Texts.backup.empty); return; }
  const now = new Date();
  const zip = await Zip.create(IO.backupFiles(docs, now), now);
  download(IO.backupFileName(now), /** @type {BlobPart} */ (zip), 'application/zip');
  toast(Texts.backup.saved(docs.length));
}

/**
 * Backup wiederherstellen: ZIP-Archive und/oder einzelne JSON-Dateien. Vorhandene Matrizen
 * werden nie überschrieben (siehe `IO.planRestore`).
 * @param {File[]} files
 */
async function restoreBackup(files) {
  /** @type {Array<{ name: string, text: string }>} */
  const texts = [];
  const dec = new TextDecoder();
  try {
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (Zip.isZip(bytes)) {
        for (const e of await Zip.read(bytes)) texts.push({ name: e.name, text: dec.decode(e.data) });
      } else {
        texts.push({ name: file.name, text: dec.decode(bytes) });
      }
    }
  } catch (e) {
    toast(Texts.backup.failed(e.message));
    return;
  }
  const { items, errors } = IO.parseBackup(texts);
  if (!items.length) {
    toast(errors.length ? Texts.backup.failed(errors[0].message) : Texts.backup.nothing);
    return;
  }
  save();
  const plan = IO.planRestore(items, Store.listDocs(), Util.uid);
  const written = plan.add.filter(doc => Store.writeDoc(doc.id, doc.data, doc.savedAt));
  if (written.length < plan.add.length) toast(Texts.backup.storageFull(plan.add.length - written.length));
  else {
    toast(Texts.backup.restoredTitle(Texts.backup.restored({
      added: written.length, copies: plan.copies, unchanged: plan.unchanged, failed: errors.length,
    })));
  }
  renderLibrary();
}

// ---------- Bewertungseinstellungen ----------

function syncSettingsForm() {
  const s = state.settings;
  $('#setCosts').checked = s.costs;
  $('#setCurrency').value = s.currency;
  $('#setCurrency').disabled = !s.costs;
  $('#setUtility').checked = s.utility;
  $('#setMoscow').checked = s.moscow;
  $('#setScale').value = String(s.utilityMax);
  $('#setScale').disabled = !s.utility;
}

function openSettings() {
  syncSettingsForm();
  openDialog($('#settingsDialog'));
}

// ---------- Menü ----------

function toggleMenu(open) {
  const btn = $('#menuBtn');
  const list = $('#menuList');
  const willOpen = open ?? list.hidden;
  list.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) list.querySelector('button').focus();
}

/** Aktionen der Menüeinträge (`data-action` in index.html). */
const MENU_ACTIONS = {
  new: () => { openNewDoc(Model.blankState(), Texts.toast.newMatrix); setMode('edit'); },
  example: openExamples,
  open: openLibrary,
  settings: openSettings,
  'export-json': exportJson,
  'import-json': () => $('#importFile').click(),
  'export-csv': exportCsv,
  share: shareLink,
  print: printMatrix,
};
