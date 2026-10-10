/*
 * Dialog „Exportieren“: Bericht (HTML, Markdown), Tabelle (CSV) oder Drucken/PDF. Format und
 * Inhalt des Berichts merkt sich der Browser. JSON (Speichern/Öffnen) bleibt eigenständig im
 * Menü „Datei“, weil es zum Weiterbearbeiten dient. Der Bericht entsteht in js/report.js, das
 * erst beim Export geladen wird.
 */
import { signal } from '@preact/signals';
import { render as mount } from 'preact';
import { IO } from '../io.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { prefs, setMode, state, useMatrix } from './core.js';
import { $, closeDialog, download, openDialog } from './dom.jsx';

/** @typedef {'html' | 'md' | 'csv' | 'print'} ExportFormat */
/** @type {ExportFormat[]} */
const FORMATS = ['html', 'md', 'csv', 'print'];
const FILE = /** @type {const} */ ({ html: { ext: 'html', type: 'text/html;charset=utf-8' }, md: { ext: 'md', type: 'text/markdown;charset=utf-8' } });

/** Vorgabe für den Inhalt des Berichts (wie `Report.defaultParts`; das Modul wird erst beim Export geladen). @type {ReportParts} */
const DEFAULT_PARTS = {
  facts: true, concepts: true, hideDropped: false, compare: true, evaluation: true, chart: true, matrix: true, constraints: true,
};

const choice = signal(Store.loadExportPrefs({ format: 'html', parts: DEFAULT_PARTS }));
/** Gewähltes Format (unbekannte gespeicherte Werte: Bericht als HTML). */
const format = () => /** @type {ExportFormat} */ (FORMATS.includes(/** @type {any} */ (choice.value.format)) ? choice.value.format : 'html');
const parts = () => /** @type {ReportParts} */ (/** @type {unknown} */ (choice.value.parts));

/** @param {{ format?: ExportFormat, parts?: Partial<ReportParts> }} change */
function update(change) {
  const next = { format: change.format ?? format(), parts: { ...choice.value.parts, ...change.parts } };
  choice.value = next;
  Store.saveExportPrefs(next);
}

/** Aktuelle Ansicht über den Druckdialog (im Modus „Kombinieren“, damit die Auswahl sichtbar ist). */
function printMatrix() {
  if (prefs.mode !== 'select') setMode('select');
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

async function runExport() {
  const f = format();
  const dialog = $('#exportDialog');
  if (f === 'print') {
    closeDialog(dialog);
    printMatrix();
    return;
  }
  if (f === 'csv') download(IO.fileName(state, 'csv'), IO.toCsv(state), 'text/csv;charset=utf-8');
  else {
    const { Report } = await import('../report.js');
    const content = f === 'html' ? Report.toHtml(state, parts()) : Report.toMarkdown(state, parts());
    download(IO.fileName(state, FILE[f].ext), content, FILE[f].type);
  }
  closeDialog(dialog);
}

function ExportForm() {
  const m = useMatrix();
  const f = format();
  const p = parts();
  const report = f === 'html' || f === 'md';
  const dropped = m.concepts.filter(c => c.status === 'dropped').length;
  const s = m.settings;
  /** Ein Teil des Berichts als Kästchen. @param {keyof ReportParts} key @param {string} label @param {boolean} [sub] */
  const part = (key, label, sub = false) => (
    <label key={key} class={`check${sub ? ' export-sub' : ''}`}>
      <input type="checkbox" data-part={key} checked={p[key]} onChange={e => update({ parts: { [key]: /** @type {HTMLInputElement} */ (e.currentTarget).checked } })} />
      {label}
    </label>
  );
  const ext = f === 'html' || f === 'md' ? FILE[f].ext : f === 'csv' ? 'csv' : null;
  return (
    <>
      <p class="dialog-hint">{Texts.exportDialog.hint(m.title || Texts.fallback.unnamed)}</p>
      <div class="export-formats" role="radiogroup" aria-label={Texts.exportDialog.formatsLabel}>
        {FORMATS.map(key => {
          const t = Texts.exportDialog.formats[key];
          return (
            <label key={key} class={`export-format${f === key ? ' is-on' : ''}`}>
              <input type="radio" name="exportFormat" value={key} checked={f === key} onChange={() => update({ format: key })} />
              <b>{t.label}{t.tag ? <span class="export-tag">{t.tag}</span> : null}</b>
              <small>{t.desc}</small>
            </label>
          );
        })}
      </div>
      {report ? (
        <>
          <div class="export-heading">{Texts.exportDialog.partsHeading}</div>
          <div class="export-parts">
            {part('facts', Texts.exportDialog.parts.facts)}
            {part('concepts', Texts.exportDialog.parts.concepts)}
            {dropped && p.concepts ? part('hideDropped', Texts.exportDialog.parts.hideDropped(dropped), true) : null}
            {part('compare', Texts.exportDialog.parts.compare)}
            {s.costs || s.utility || s.moscow ? part('evaluation', Texts.exportDialog.parts.evaluation) : null}
            {f === 'html' && s.costs && s.utility ? part('chart', Texts.exportDialog.parts.chart) : null}
            {part('matrix', Texts.exportDialog.parts.matrix)}
            {m.constraints.length ? part('constraints', Texts.exportDialog.parts.constraints(m.constraints.length)) : null}
          </div>
        </>
      ) : null}
      <div class="dialog-foot export-foot">
        <p class="export-file">{ext ? Texts.exportDialog.file(IO.fileName(m, ext)) : ''}</p>
        <span class="export-actions">
          <button type="button" class="btn" onClick={() => closeDialog($('#exportDialog'))}>{Texts.exportDialog.cancel}</button>
          <button type="button" class="btn btn-primary" id="exportRun" onClick={runExport}>
            {f === 'print' ? Texts.exportDialog.print : Texts.exportDialog.download}
          </button>
        </span>
      </div>
    </>
  );
}

export function openExport() {
  openDialog($('#exportDialog'));
}

export function initExport() {
  mount(<ExportForm />, $('#exportBody'));
  $('#exportClose').addEventListener('click', () => closeDialog($('#exportDialog')));
}
