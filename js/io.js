/*
 * IO – Export (JSON, CSV) und Teilen-Links. Erzeugt nur Texte; das Herunterladen
 * übernimmt die Oberfläche. Exportiert den Namensraum `IO`.
 */
import { Attributes } from './attributes.js';
import { Consistency } from './consistency.js';
import { Evaluation } from './evaluation.js';
import { Model } from './model.js';
import { Texts } from './texts.js';
import { Util } from './util.js';

export const IO = (() => {
  const { categoryById, optionText } = Model;
  const { weightOf, conceptReport } = Evaluation;

  const L = Texts.csv;

  /** @param {Matrix} m @param {'json' | 'csv' | 'html' | 'md'} ext */
  const fileName = (m, ext) => `${Util.slugify(m.title)}.${ext}`;

  /** @param {Matrix} m */
  const toJson = m => JSON.stringify(m, null, 2);

  /** Textzelle in Anführungszeichen. @param {unknown} v */
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  /** Zahl mit dem Dezimaltrenner der Sprache (Excel); leer für fehlende Werte. @param {number | null} n */
  const csvNum = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', Texts.meta.csvDecimal));

  /**
   * CSV für Excel (Trennzeichen der Sprache: Semikolon/Dezimalkomma bzw. Komma/Dezimalpunkt; UTF-8 mit BOM): Matrix, optional
   * Bewertung und Notizen je Ausprägung und die Konzepte mit ihren Kennzahlen und Begründungen. Spalten für Notizen
   * erscheinen nur, wenn mindestens eine Notiz vorhanden ist.
   * @param {Matrix} m
   * @returns {string}
   */
  function toCsv(m) {
    const maxOptions = Math.max(0, ...m.parameters.map(p => p.options.length));
    const withCats = m.categories.length > 0;
    const catHead = withCats ? [cell(L.category)] : [];
    /** @param {MatrixParameter} p */
    const catCell = p => (withCats ? [cell((categoryById(m, p.categoryId) || { name: '' }).name)] : []);
    const lines = [
      [cell(L.title), cell(m.title)],
      [cell(L.description), cell(m.description)],
      [],
      [...catHead, cell(L.parameter), ...Array.from({ length: maxOptions }, (_, i) => cell(L.option(i + 1)))],
      ...m.parameters.map(p => [...catCell(p), cell(p.name), ...p.options.map(o => cell(o.text))]),
    ];
    const { costs, utility, currency, utilityMax, moscow } = m.settings;
    // Bei mehreren Kriterien zusätzlich je Kriterium eine Spalte (Ausprägungen und Konzepte)
    const criteria = utility && m.settings.criteria.length > 1 ? m.settings.criteria : [];
    const criterionHeads = criteria.map(c => cell(L.criterionScore(Model.criterionLabel(c), utilityMax)));
    /** @param {MatrixOption} o */
    const prio = o => (o.priority ? Texts.moscow.levels[o.priority].label : '');
    const paramNotes = m.parameters.some(p => p.note);
    const optionNotes = m.parameters.some(p => p.options.some(o => o.note));
    // Eigene Merkmale: je Merkmal eine Spalte (Zahlen als Zahl, sonst als Text)
    const attrs = m.settings.attributes;
    const attrHeads = attrs.map((a, i) => cell(Texts.attributes.csvColumn(Attributes.label(a, i), a.unit.trim())));
    /** @param {MatrixAttribute} a @param {MatrixOption} o */
    const attrCell = (a, o) => {
      const v = o.values[a.id];
      return typeof v === 'number' ? csvNum(v) : cell(Attributes.formatValue(a, v));
    };
    if (costs || utility || moscow || paramNotes || optionNotes || attrs.length) {
      lines.push([], [...catHead, cell(L.parameter),
        ...(paramNotes ? [cell(L.parameterNote)] : []),
        ...(utility ? [cell(L.weight)] : []),
        cell(L.optionSingle),
        ...(costs ? [cell(L.cost(currency))] : []),
        ...criterionHeads,
        ...(utility ? [cell(L.utility(utilityMax))] : []),
        ...(moscow ? [cell(L.priority)] : []),
        ...attrHeads,
        ...(optionNotes ? [cell(L.note)] : [])]);
      for (const p of m.parameters) {
        for (const o of p.options) {
          lines.push([...catCell(p), cell(p.name),
            ...(paramNotes ? [cell(p.note)] : []),
            ...(utility ? [csvNum(weightOf(p))] : []),
            cell(o.text),
            ...(costs ? [csvNum(o.cost)] : []),
            ...criteria.map(c => csvNum(o.scores[c.id] ?? null)),
            ...(utility ? [csvNum(Evaluation.optionScore(m, o).value)] : []),
            ...(moscow ? [cell(prio(o))] : []),
            ...attrs.map(a => attrCell(a, o)),
            ...(optionNotes ? [cell(o.note)] : [])]);
        }
      }
    }
    // Verträglichkeiten: je Paar eine Zeile
    const index = Model.optionIndex(m);
    /** @param {string} oid */
    const ref = oid => {
      const r = index.get(oid);
      return r ? { param: r.p.name, text: r.o.text } : { param: '', text: '' };
    };
    if (m.constraints.length) {
      lines.push([], [cell(L.parameter), cell(L.optionSingle), cell(L.parameter), cell(L.optionSingle), cell(L.constraintType), cell(L.constraintNote)]);
      for (const c of m.constraints) {
        const a = ref(c.a);
        const b = ref(c.b);
        lines.push([cell(a.param), cell(a.text), cell(b.param), cell(b.text), cell(Texts.cons.types[c.type]), cell(c.note)]);
      }
    }
    if (m.concepts.length) {
      const conceptNotes = m.concepts.some(c => c.note);
      // Status nur, wenn ein Konzept mehr als „Entwurf“ ist
      const withStatus = m.concepts.some(c => c.status !== 'draft' || c.statusNote);
      const withConstraints = m.constraints.length > 0;
      /** Unverträgliche Paare eines Konzepts als Text. @param {MatrixConcept} c */
      const clashes = c => Consistency.conflicts(m, c).excluded.map(x => `${ref(x.a).text} ✕ ${ref(x.b).text}`).join('; ');
      lines.push([], [cell(L.concept), ...m.parameters.map(p => cell(p.name)),
        ...(costs ? [cell(L.totalCost(currency))] : []),
        ...(utility ? [cell(L.utilityTotal)] : []),
        ...criterionHeads,
        ...(costs && utility ? [cell(L.priceValue(currency))] : []),
        ...attrs.map((a, i) => cell(Texts.attributes.csvColumn(
          Texts.attributes.compareRow(Attributes.label(a, i), Attributes.aggregateLabel(a)), a.unit.trim()))),
        ...(withConstraints ? [cell(L.conflicts)] : []),
        ...(conceptNotes ? [cell(L.conceptNote)] : []),
        ...(withStatus ? [cell(L.status), cell(L.statusNote)] : [])]);
      for (const { concept: c, cost, utility: util, priceValue } of conceptReport(m)) {
        lines.push([cell(c.name), ...m.parameters.map(p => cell(optionText(p, c.selections[p.id]) || '')),
          ...(cost ? [csvNum(cost.total)] : []),
          ...(util ? [csvNum(util.value)] : []),
          ...(criteria.length ? Evaluation.conceptCriteria(m, c).map(x => csvNum(x.value)) : []),
          ...(priceValue ? [csvNum(priceValue.value)] : []),
          ...attrs.map(a => {
            const sum = Attributes.summarize(m, a, c);
            // Zusammengefasste Zahlen als Zahl, sonst der angezeigte Text
            return Attributes.isNumeric(a.type) && a.aggregate !== 'none' ? csvNum(sum.sort) : cell(sum.text);
          }),
          ...(withConstraints ? [cell(clashes(c))] : []),
          ...(conceptNotes ? [cell(c.note)] : []),
          ...(withStatus ? [cell(Texts.status.levels[c.status].label), cell(c.statusNote)] : [])]);
      }
    }
    return '\ufeff' + lines.map(l => l.join(Texts.meta.csvSeparator)).join('\r\n');
  }

  /** Teil hinter `#m=` eines Teilen-Links. @param {Matrix} m */
  const encodeShare = m => Util.toBase64Url(JSON.stringify(m));

  /**
   * Liest den Hash eines Teilen-Links; `null`, wenn der Hash kein Teilen-Link ist.
   * Wirft bei beschädigten Daten.
   * @param {string} hash
   * @returns {Matrix | null}
   */
  function decodeShareHash(hash) {
    const match = hash.match(/^#m=([A-Za-z0-9_-]+)$/);
    if (!match) return null;
    return Model.normalize(JSON.parse(Util.fromBase64Url(match[1])));
  }

  // ---------- Backup ----------

  const BACKUP_MANIFEST = 'backup.json';
  const BACKUP_FORMAT = 'morphologische-matrix-backup';

  /** @typedef {{ id: string, savedAt: number, data: Matrix }} BackupDoc */

  /**
   * Dateien eines Backups: je Matrix eine JSON-Datei wie bei „Als JSON speichern“ und eine
   * Inhaltsübersicht mit den internen Kennungen (für das Wiederherstellen).
   * @param {BackupDoc[]} docs @param {Date} [now]
   * @returns {Array<{ name: string, text: string }>}
   */
  function backupFiles(docs, now = new Date()) {
    const used = new Set([BACKUP_MANIFEST]);
    const files = docs.map(doc => {
      const base = Util.slugify(doc.data.title);
      let name = `${base}.json`;
      for (let i = 2; used.has(name); i++) name = `${base}-${i}.json`;
      used.add(name);
      return { name, text: toJson(doc.data), doc };
    });
    const manifest = {
      format: BACKUP_FORMAT,
      version: 1,
      created: now.toISOString(),
      matrices: files.map(f => ({ file: f.name, id: f.doc.id, savedAt: f.doc.savedAt, title: f.doc.data.title })),
    };
    return [{ name: BACKUP_MANIFEST, text: JSON.stringify(manifest, null, 2) }, ...files.map(({ name, text }) => ({ name, text }))];
  }

  /** @param {Date} now */
  const backupFileName = now => `morphologische-matrizen-backup-${now.toISOString().slice(0, 10)}.zip`;

  /**
   * Dateien eines Backups (oder beliebige JSON-Exporte) einlesen. Ohne Inhaltsübersicht
   * gelten alle Matrizen als neu. Ungültige Dateien landen in `errors`.
   * @param {Array<{ name: string, text: string }>} files
   * @returns {{ items: Array<{ file: string, id: string | null, savedAt: number | null, data: Matrix }>, errors: Array<{ file: string, message: string }> }}
   */
  function parseBackup(files) {
    /** @param {{ name: string }} f */
    const isMatrixFile = f => /\.json$/i.test(f.name) && !/(^|\/)(__MACOSX\/|\.)/.test(f.name);
    let meta = new Map();
    const manifestFile = files.find(f => f.name.split('/').pop() === BACKUP_MANIFEST);
    if (manifestFile) {
      try {
        const manifest = JSON.parse(manifestFile.text);
        if (manifest && manifest.format === BACKUP_FORMAT && Array.isArray(manifest.matrices)) {
          meta = new Map(manifest.matrices.map(/** @param {any} e */ e => [e.file, e]));
        }
      } catch (e) { /* ohne Übersicht weiter */ }
    }
    const items = [];
    const errors = [];
    for (const f of files) {
      if (f === manifestFile || !isMatrixFile(f)) continue;
      const base = f.name.split('/').pop() || f.name;
      try {
        const data = Model.normalize(JSON.parse(f.text));
        const info = meta.get(base) || meta.get(f.name) || {};
        items.push({
          file: base,
          id: typeof info.id === 'string' && info.id ? info.id : null,
          savedAt: Number(info.savedAt) || null,
          data,
        });
      } catch (e) {
        errors.push({ file: base, message: Util.errorMessage(e) });
      }
    }
    return { items, errors };
  }

  /**
   * Wiederherstellen ohne Datenverlust planen: Neue Matrizen werden hinzugefügt, identische
   * übersprungen; weicht eine vorhandene Matrix gleicher Kennung ab, wird das Backup als Kopie
   * angelegt – vorhandene Matrizen werden nie überschrieben.
   * @param {ReturnType<typeof parseBackup>['items']} items
   * @param {BackupDoc[]} existing
   * @param {() => string} newId
   * @returns {{ add: BackupDoc[], copies: number, unchanged: number }}
   */
  function planRestore(items, existing, newId) {
    const byId = new Map(existing.map(d => [d.id, d]));
    const contents = new Set(existing.map(d => JSON.stringify(d.data)));
    /** @type {BackupDoc[]} */
    const add = [];
    let copies = 0;
    let unchanged = 0;
    for (const item of items) {
      const json = JSON.stringify(item.data);
      if (contents.has(json)) { unchanged++; continue; }
      contents.add(json);
      const savedAt = item.savedAt || Date.now();
      if (item.id && !byId.has(item.id)) {
        add.push({ id: item.id, savedAt, data: item.data });
        byId.set(item.id, add[add.length - 1]);
      } else if (item.id) {
        copies++;
        add.push({ id: newId(), savedAt, data: { ...item.data, title: Texts.backup.copyTitle(item.data.title) } });
      } else {
        add.push({ id: newId(), savedAt, data: item.data });
      }
    }
    return { add, copies, unchanged };
  }

  return {
    fileName, toJson, toCsv, encodeShare, decodeShareHash,
    backupFiles, backupFileName, parseBackup, planRestore,
  };
})();
