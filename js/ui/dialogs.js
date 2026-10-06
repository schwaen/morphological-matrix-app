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
      openNewDoc(next, `„${next.title || file.name}“ geöffnet.`);
    } catch (e) {
      toast(`Datei konnte nicht gelesen werden: ${e.message}`);
    }
  };
  reader.onerror = () => toast('Datei konnte nicht gelesen werden.');
  reader.readAsText(file);
}

async function shareLink() {
  const url = `${location.href.split('#')[0]}#m=${IO.encodeShare(state)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link in die Zwischenablage kopiert.');
  } catch (e) {
    window.prompt('Link zum Teilen (kopieren mit Strg+C):', url);
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
    toast(`Geteilte Matrix „${next.title}“ als neue Matrix geöffnet.`);
  } catch (e) {
    toast('Der geteilte Link ist ungültig.');
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
    const title = data.title || 'Unbenannte Matrix';
    const P = data.parameters.length;
    const C = data.concepts.length;
    return h('li', { class: `doc${current ? ' is-current' : ''}` },
      h('div', { class: 'doc-info' },
        h('span', { class: 'doc-title' }, title, current ? h('span', { class: 'badge' }, 'dieser Tab') : null),
        h('span', { class: 'doc-meta' },
          `${dateFormat.format(new Date(doc.savedAt))} · ${P} Parameter · ${C} ${C === 1 ? 'Konzept' : 'Konzepte'}`)),
      h('div', { class: 'doc-actions' },
        h('button', {
          type: 'button', class: 'btn btn-small', disabled: current,
          onclick: () => {
            const fresh = Store.readDoc(doc.id);
            if (!fresh) { toast('Diese Matrix existiert nicht mehr.'); renderLibrary(); return; }
            closeDialog($('#libraryDialog'));
            openDoc(fresh.id, fresh.data, `„${fresh.data.title || 'Unbenannte Matrix'}“ geöffnet.`);
          },
        }, 'Öffnen'),
        h('a', {
          class: 'btn btn-small', href: `?doc=${encodeURIComponent(doc.id)}`, target: '_blank', rel: 'noopener',
          title: 'In einem neuen Tab öffnen',
        }, 'Neuer Tab'),
        iconBtn('trash', current ? 'Die Matrix dieses Tabs kann nicht gelöscht werden' : 'Matrix löschen', () => {
          if (!window.confirm(`Matrix „${title}“ endgültig löschen?`)) return;
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
  new: () => { openNewDoc(Model.blankState(), 'Neue Matrix angelegt.'); setMode('edit'); },
  example: () => openNewDoc(Model.exampleState(), 'Beispiel als neue Matrix geöffnet.'),
  open: openLibrary,
  settings: openSettings,
  'export-json': exportJson,
  'import-json': () => $('#importFile').click(),
  'export-csv': exportCsv,
  share: shareLink,
  print: printMatrix,
};
