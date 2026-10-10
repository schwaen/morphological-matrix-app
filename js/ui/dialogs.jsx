/*
 * Menü „Datei“ und Dialoge: Bibliothek („Meine Matrizen“), Beispiele, Bewertungseinstellungen,
 * Import/Export, Teilen und Drucken.
 */
import { Examples } from '../examples.js';
import { IO } from '../io.js';
import { Model } from '../model.js';
import { Store } from '../storage.js';
import { Languages, Texts } from '../texts.js';
import { openConsDialog } from './constraints.jsx';
import { closedTabs, docId, save, saveWorkspace, setClosedTabs, setMode, state } from './core.js';
import { openExport } from './export.jsx';
import { $, closeDialog, download, openDialog, toast } from './dom.jsx';
import { activateTab, openInTab, openNewDoc, tabById } from './tabs.jsx';
import { Util } from '../util.js';
import { IconButton } from './components.jsx';
import { render as mount } from 'preact';

// ---------- Import / Export / Teilen ----------

export function exportJson() {
  download(IO.fileName(state, 'json'), IO.toJson(state), 'application/json');
}

/** @param {File} file */
export function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = Model.normalize(JSON.parse(String(reader.result)));
      openNewDoc(next, Texts.toast.opened(next.title || file.name));
    } catch (e) {
      toast(Texts.errors.fileInvalid(Util.errorMessage(e)));
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
export function loadFromHash() {
  try {
    const next = IO.decodeShareHash(location.hash);
    if (!next) return;
    openNewDoc(next, Texts.toast.sharedOpened(next.title));
  } catch (e) {
    toast(Texts.errors.shareInvalid);
  }
  history.replaceState(null, '', location.pathname + location.search);
}

// ---------- Bibliothek ----------

const dateFormat = new Intl.DateTimeFormat(Texts.meta.locale, { dateStyle: 'medium', timeStyle: 'short' });

function openLibrary() {
  renderLibrary();
  openDialog($('#libraryDialog'));
}

/** „Meine Matrizen“ (neu zeichnen nach Änderungen, z. B. Löschen oder Wiederherstellen). */
export function renderLibrary() {
  mount(<Library />, $('#docList'));
}

function Library() {
  const docs = Store.listDocs();
  if (!docs.some(d => d.id === docId)) docs.unshift({ id: docId, savedAt: Date.now(), data: state });
  return (
    <>
      {docs.map(doc => {
        const current = doc.id === docId;
        const open = !!tabById(doc.id);
        const data = current ? state : doc.data;
        const title = data.title || Texts.fallback.unnamedMatrix;
        return (
          <li key={doc.id} class={`doc${current ? ' is-current' : ''}${open ? ' is-open' : ''}`}>
            <div class="doc-info">
              <span class="doc-title">
                {title}
                {open ? <span class="badge">{current ? Texts.library.currentTab : Texts.library.openTab}</span> : null}
              </span>
              <span class="doc-meta">{Texts.library.meta(dateFormat.format(new Date(doc.savedAt)), data.parameters.length, data.concepts.length)}</span>
            </div>
            <div class="doc-actions">
              <button
                type="button" class="btn btn-small" disabled={current}
                onClick={() => {
                  closeDialog($('#libraryDialog'));
                  if (open) { activateTab(doc.id); return; }
                  const fresh = Store.readDoc(doc.id);
                  if (!fresh) { toast(Texts.errors.docMissing); return; }
                  openInTab(fresh.id, fresh.data, Texts.toast.opened(fresh.data.title || Texts.fallback.unnamedMatrix));
                }}
              >{open ? Texts.library.show : Texts.library.open}</button>
              <IconButton
                icon="trash" label={open ? Texts.library.deleteOpen : Texts.library.delete} danger disabled={open}
                onClick={() => {
                  if (!window.confirm(Texts.prompt.deleteMatrix(title))) return;
                  Store.removeDoc(doc.id);
                  setClosedTabs(closedTabs.filter(x => x !== doc.id));
                  saveWorkspace();
                  renderLibrary();
                }}
              />
            </div>
          </li>
        );
      })}
    </>
  );
}

// ---------- Beispiele ----------

/** Auswahl sofort öffnen; die Liste folgt, sobald die Beispiele geladen sind. */
async function openExamples() {
  const list = $('#exampleList');
  list.setAttribute('aria-busy', 'true');
  mount(<li class="doc-empty">{Texts.examples.loading}</li>, list);
  openDialog($('#examplesDialog'));
  try {
    mount(<ExampleList examples={await Examples.all()} />, list);
  } catch (e) {
    closeDialog($('#examplesDialog'));
    toast(Texts.errors.fileInvalid(Util.errorMessage(e)));
  } finally {
    list.removeAttribute('aria-busy');
  }
}

/** @param {{ examples: ExampleDef[] }} props */
function ExampleList({ examples }) {
  if (!examples.length) return <li class="doc-empty">{Texts.examples.empty}</li>;
  const count = (/** @type {unknown} */ v) => (Array.isArray(v) ? v.length : 0);
  return (
    <>
      {examples.map(ex => {
        const d = /** @type {any} */ (ex.data);
        return (
          <li key={ex.id} class="doc">
            <div class="doc-info">
              <span class="doc-title">{ex.name}</span>
              {ex.description ? <span class="doc-desc">{ex.description}</span> : null}
              <span class="doc-meta">{Texts.examples.meta(count(d.parameters), count(d.categories), count(d.concepts))}</span>
            </div>
            <div class="doc-actions">
              <button type="button" class="btn btn-small" onClick={() => { closeDialog($('#examplesDialog')); openExample(ex); }}>{Texts.examples.open}</button>
            </div>
          </li>
        );
      })}
    </>
  );
}

/** Beispiel als neue Matrix in einem neuen Tab öffnen. @param {ExampleDef} ex */
function openExample(ex) {
  let data;
  try {
    data = Examples.toMatrix(ex);
  } catch (e) {
    toast(Texts.errors.fileInvalid(Util.errorMessage(e)));
    return;
  }
  openNewDoc(data, Texts.toast.exampleOpened(ex.name));
}

// ---------- Backup ----------

/** ZIP-Modul (mit fflate) erst laden, wenn ein Backup erstellt oder eingelesen wird. */
const loadZip = () => import('../zip.js');

/** Alle Matrizen als ZIP-Archiv herunterladen (je Matrix eine JSON-Datei). */
export async function exportBackup() {
  save();
  const docs = Store.listDocs();
  if (!docs.length) { toast(Texts.backup.empty); return; }
  const now = new Date();
  const { Zip } = await loadZip();
  const zip = await Zip.create(IO.backupFiles(docs, now), now);
  download(IO.backupFileName(now), /** @type {BlobPart} */ (zip), 'application/zip');
  toast(Texts.backup.saved(docs.length));
}

/**
 * Backup wiederherstellen: ZIP-Archive und/oder einzelne JSON-Dateien. Vorhandene Matrizen
 * werden nie überschrieben (siehe `IO.planRestore`).
 * @param {File[]} files
 */
export async function restoreBackup(files) {
  /** @type {Array<{ name: string, text: string }>} */
  const texts = [];
  const dec = new TextDecoder();
  try {
    const { Zip } = await loadZip();
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (Zip.isZip(bytes)) {
        for (const e of await Zip.read(bytes)) texts.push({ name: e.name, text: dec.decode(e.data) });
      } else {
        texts.push({ name: file.name, text: dec.decode(bytes) });
      }
    }
  } catch (e) {
    toast(Texts.backup.failed(Util.errorMessage(e)));
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

function openSettings() {
  openDialog($('#settingsDialog'));
}

// ---------- Menü ----------

export function toggleMenu(open) {
  const btn = $('#menuBtn');
  const list = $('#menuList');
  const willOpen = open ?? list.hidden;
  list.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) list.querySelector('button').focus();
}

/**
 * Sprache wechseln: Wahl merken und die Seite neu laden (auch statische Texte und Formate
 * wechseln). Ausstehende Eingaben werden vorher gespeichert; die geöffneten Tabs bleiben.
 * @param {string} lang
 */
export function switchLanguage(lang) {
  if (lang === Texts.meta.lang || !Languages.packs[lang]) return;
  save();
  saveWorkspace();
  Languages.choose(lang);
  location.reload();
}

/** Aktionen der Menüeinträge (`data-action` in index.html). */
export const MENU_ACTIONS = {
  new: () => { openNewDoc(Model.blankState(), Texts.toast.newMatrix); setMode('edit'); },
  example: openExamples,
  open: openLibrary,
  settings: openSettings,
  constraints: openConsDialog,
  'export-json': exportJson,
  'import-json': () => $('#importFile').click(),
  export: openExport,
  share: shareLink,
};
