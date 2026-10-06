/*
 * IO – Export (JSON, CSV) und Teilen-Links. Erzeugt nur Texte; das Herunterladen
 * übernimmt die Oberfläche. Stellt den globalen Namensraum `IO` bereit.
 */
'use strict';

const IO = (() => {
  const { categoryById, optionText } = Model;
  const { weightOf, conceptCost, conceptUtility, priceValue } = Evaluation;

  const L = Texts.csv;

  /** @param {Matrix} m @param {'json' | 'csv'} ext */
  const fileName = (m, ext) => `${Util.slugify(m.title)}.${ext}`;

  /** @param {Matrix} m */
  const toJson = m => JSON.stringify(m, null, 2);

  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  /** Zahl mit Dezimalkomma (Excel, deutsch); leer für fehlende Werte. @param {number | null} n */
  const csvNum = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

  /**
   * CSV für Excel (Semikolon, UTF-8 mit BOM): Matrix, optional Bewertung je Ausprägung
   * und die Konzepte mit ihren Kennzahlen.
   * @param {Matrix} m
   * @returns {string}
   */
  function toCsv(m) {
    const maxOptions = Math.max(0, ...m.parameters.map(p => p.options.length));
    const withCats = m.categories.length > 0;
    const catHead = withCats ? [cell(L.category)] : [];
    const catCell = p => (withCats ? [cell((categoryById(m, p.categoryId) || { name: '' }).name)] : []);
    const lines = [
      [cell(L.title), cell(m.title)],
      [cell(L.description), cell(m.description)],
      [],
      [...catHead, cell(L.parameter), ...Array.from({ length: maxOptions }, (_, i) => cell(L.option(i + 1)))],
      ...m.parameters.map(p => [...catCell(p), cell(p.name), ...p.options.map(o => cell(o.text))]),
    ];
    const { costs, utility, currency, utilityMax, moscow } = m.settings;
    const prio = o => (o.priority ? Texts.moscow.levels[o.priority].label : '');
    if (costs || utility || moscow) {
      lines.push([], [...catHead, cell(L.parameter),
        ...(utility ? [cell(L.weight)] : []),
        cell(L.optionSingle),
        ...(costs ? [cell(L.cost(currency))] : []),
        ...(utility ? [cell(L.utility(utilityMax))] : []),
        ...(moscow ? [cell(L.priority)] : [])]);
      for (const p of m.parameters) {
        for (const o of p.options) {
          lines.push([...catCell(p), cell(p.name),
            ...(utility ? [csvNum(weightOf(p))] : []),
            cell(o.text),
            ...(costs ? [csvNum(o.cost)] : []),
            ...(utility ? [csvNum(o.score)] : []),
            ...(moscow ? [cell(prio(o))] : [])]);
        }
      }
    }
    if (m.concepts.length) {
      lines.push([], [cell(L.concept), ...m.parameters.map(p => cell(p.name)),
        ...(costs ? [cell(L.totalCost(currency))] : []),
        ...(utility ? [cell(L.utilityTotal)] : []),
        ...(costs && utility ? [cell(L.priceValue(currency))] : [])]);
      for (const c of m.concepts) {
        lines.push([cell(c.name), ...m.parameters.map(p => cell(optionText(p, c.selections[p.id]) || '')),
          ...(costs ? [csvNum(conceptCost(m, c).total)] : []),
          ...(utility ? [csvNum(conceptUtility(m, c).value)] : []),
          ...(costs && utility ? [csvNum(priceValue(m, c).value)] : [])]);
      }
    }
    return '\ufeff' + lines.map(l => l.join(';')).join('\r\n');
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
    const isMatrixFile = f => /\.json$/i.test(f.name) && !/(^|\/)(__MACOSX\/|\.)/.test(f.name);
    let meta = new Map();
    const manifestFile = files.find(f => f.name.split('/').pop() === BACKUP_MANIFEST);
    if (manifestFile) {
      try {
        const manifest = JSON.parse(manifestFile.text);
        if (manifest && manifest.format === BACKUP_FORMAT && Array.isArray(manifest.matrices)) {
          meta = new Map(manifest.matrices.map(e => [e.file, e]));
        }
      } catch (e) { /* ohne Übersicht weiter */ }
    }
    const items = [];
    const errors = [];
    for (const f of files) {
      if (f === manifestFile || !isMatrixFile(f)) continue;
      const base = f.name.split('/').pop();
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
        errors.push({ file: base, message: e.message });
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
