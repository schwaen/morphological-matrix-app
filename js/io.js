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
    const { costs, utility, currency, utilityMax } = m.settings;
    if (costs || utility) {
      lines.push([], [...catHead, cell(L.parameter),
        ...(utility ? [cell(L.weight)] : []),
        cell(L.optionSingle),
        ...(costs ? [cell(L.cost(currency))] : []),
        ...(utility ? [cell(L.utility(utilityMax))] : [])]);
      for (const p of m.parameters) {
        for (const o of p.options) {
          lines.push([...catCell(p), cell(p.name),
            ...(utility ? [csvNum(weightOf(p))] : []),
            cell(o.text),
            ...(costs ? [csvNum(o.cost)] : []),
            ...(utility ? [csvNum(o.score)] : [])]);
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

  return { fileName, toJson, toCsv, encodeShare, decodeShareHash };
})();
