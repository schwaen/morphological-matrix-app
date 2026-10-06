/*
 * Menü „Datei“ und Dialoge: Bibliothek („Meine Matrizen“), Bewertungseinstellungen,
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

/** Öffnet eine per Link geteilte Matrix als neue Matrix in diesem Tab. */
function loadFromHash() {
  try {
    const next = IO.decodeShareHash(location.hash);
    if (!next) return;
    docId = Util.uid();
    state = next;
    save();
    toast(Texts.toast.sharedOpened(next.title));
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
    const data = current ? state : doc.data;
    const title = data.title || Texts.fallback.unnamedMatrix;
    const P = data.parameters.length;
    const C = data.concepts.length;
    return h('li', { class: `doc${current ? ' is-current' : ''}` },
      h('div', { class: 'doc-info' },
        h('span', { class: 'doc-title' }, title, current ? h('span', { class: 'badge' }, Texts.library.currentTab) : null),
        h('span', { class: 'doc-meta' }, Texts.library.meta(dateFormat.format(new Date(doc.savedAt)), P, C))),
      h('div', { class: 'doc-actions' },
        h('button', {
          type: 'button', class: 'btn btn-small', disabled: current,
          onclick: () => {
            const fresh = Store.readDoc(doc.id);
            if (!fresh) { toast(Texts.errors.docMissing); renderLibrary(); return; }
            closeDialog($('#libraryDialog'));
            openDoc(fresh.id, fresh.data, Texts.toast.opened(fresh.data.title || Texts.fallback.unnamedMatrix));
          },
        }, Texts.library.open),
        h('a', {
          class: 'btn btn-small', href: `?doc=${encodeURIComponent(doc.id)}`, target: '_blank', rel: 'noopener',
          title: Texts.library.newTabTitle,
        }, Texts.library.newTab),
        iconBtn('trash', current ? Texts.library.deleteCurrent : Texts.library.delete, () => {
          if (!window.confirm(Texts.prompt.deleteMatrix(title))) return;
          Store.removeDoc(doc.id);
          renderLibrary();
        }, { danger: true, disabled: current })));
  });
  $('#docList').replaceChildren(...items);
}

// ---------- Bewertungseinstellungen ----------

function syncSettingsForm() {
  const s = state.settings;
  $('#setCosts').checked = s.costs;
  $('#setCurrency').value = s.currency;
  $('#setCurrency').disabled = !s.costs;
  $('#setUtility').checked = s.utility;
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
  example: () => openNewDoc(Model.exampleState(), Texts.toast.exampleOpened),
  open: openLibrary,
  settings: openSettings,
  'export-json': exportJson,
  'import-json': () => $('#importFile').click(),
  'export-csv': exportCsv,
  share: shareLink,
  print: printMatrix,
};
