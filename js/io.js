/*
 * IO – Export (JSON, CSV) und Teilen-Links. Erzeugt nur Texte; das Herunterladen
 * übernimmt die Oberfläche. Stellt den globalen Namensraum `IO` bereit.
 */
'use strict';

const IO = (() => {
  const { categoryById, optionText } = Model;
  const { weightOf, conceptCost, conceptUtility, priceValue } = Evaluation;

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
    const catHead = withCats ? [cell('Kategorie')] : [];
    const catCell = p => (withCats ? [cell((categoryById(m, p.categoryId) || { name: '' }).name)] : []);
    const lines = [
      [cell('Titel'), cell(m.title)],
      [cell('Beschreibung'), cell(m.description)],
      [],
      [...catHead, cell('Parameter'), ...Array.from({ length: maxOptions }, (_, i) => cell(`Ausprägung ${i + 1}`))],
      ...m.parameters.map(p => [...catCell(p), cell(p.name), ...p.options.map(o => cell(o.text))]),
    ];
    const { costs, utility, currency, utilityMax } = m.settings;
    if (costs || utility) {
      lines.push([], [...catHead, cell('Parameter'),
        ...(utility ? [cell('Gewicht')] : []),
        cell('Ausprägung'),
        ...(costs ? [cell(`Kosten (${currency})`)] : []),
        ...(utility ? [cell(`Nutzwert (0–${utilityMax})`)] : [])]);
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
      lines.push([], [cell('Konzept'), ...m.parameters.map(p => cell(p.name)),
        ...(costs ? [cell(`Gesamtkosten (${currency})`)] : []),
        ...(utility ? [cell('Nutzwert')] : []),
        ...(costs && utility ? [cell(`Kosten je Nutzwertpunkt (${currency})`)] : [])]);
      for (const c of m.concepts) {
        lines.push([cell(c.name), ...m.parameters.map(p => cell(optionText(p, c.selections[p.id]) || '')),
          ...(costs ? [csvNum(conceptCost(m, c).total)] : []),
          ...(utility ? [csvNum(conceptUtility(m, c).value)] : []),
          ...(costs && utility ? [csvNum(priceValue(m, c).value)] : [])]);
      }
    }
    return '﻿' + lines.map(l => l.join(';')).join('\r\n');
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
