/*
 * Attributes – eigene Merkmale der Ausprägungen (z. B. Gewicht, Lautstärke, Reifegrad):
 * Definition je Matrix (`settings.attributes`), Werte je Ausprägung (`option.values`),
 * Zusammenfassung je Konzept und Warnung bei überschrittener Grenze. Merkmale beschreiben
 * nur; sie fließen nicht in Nutzwert, automatische Konzepte oder Pareto-Front ein.
 * Ohne DOM und ohne globalen Zustand; exportiert den Namensraum `Attributes`.
 */
import { Texts } from './texts.js';
import { Util } from './util.js';

export const Attributes = (() => {
  const { uid, str, num } = Util;

  /** @type {AttributeType[]} */
  const TYPES = ['int', 'decimal', 'choice', 'bool', 'text'];

  /** Zusammenfassung je Konzept, die zu einer Form passt (erste = Vorgabe). @type {Record<AttributeType, AttributeAggregate[]>} */
  const AGGREGATES = {
    int: ['sum', 'max', 'min', 'avg', 'none'],
    decimal: ['sum', 'max', 'min', 'avg', 'none'],
    choice: ['max', 'min'],
    bool: ['count'],
    text: ['list'],
  };

  /** Grenzen, die zu einer Form passen. @type {Record<AttributeType, Array<AttributeLimit['op']>>} */
  const LIMITS = {
    int: ['above', 'below'],
    decimal: ['above', 'below'],
    choice: ['level'],
    bool: ['allYes'],
    text: [],
  };

  /** @param {AttributeType} type */
  const isNumeric = type => type === 'int' || type === 'decimal';

  /** @param {AttributeType} [type] @returns {MatrixAttribute} */
  function newAttribute(type = 'int') {
    return {
      id: uid(), name: '', description: '', source: '', type, unit: '',
      decimals: type === 'decimal' ? 1 : 0,
      levels: type === 'choice' ? [newLevel(), newLevel()] : [],
      aggregate: AGGREGATES[type][0],
      limit: null,
    };
  }

  /** @param {string} [name] @returns {AttributeLevel} */
  const newLevel = (name = '') => ({ id: uid(), name });

  /**
   * Grenze prüfen; unpassende oder unvollständige ergeben `null` (keine Grenze).
   * @param {any} raw @param {AttributeType} type @param {AttributeLevel[]} levels
   * @returns {AttributeLimit | null}
   */
  function normalizeLimit(raw, type, levels) {
    const op = raw && raw.op;
    if (!LIMITS[type].includes(op)) return null;
    if (op === 'allYes') return { op };
    if (op === 'level') {
      const level = str(raw.value);
      return levels.some(l => l.id === level) ? { op, value: level } : null;
    }
    const value = num(raw.value);
    return value == null ? null : { op, value };
  }

  /**
   * Merkmale prüfen: eindeutige IDs, bekannte Form (sonst Text), passende Zusammenfassung und Grenze.
   * @param {unknown} raw @returns {MatrixAttribute[]}
   */
  function normalizeAttributes(raw) {
    const seen = new Set();
    /** @type {MatrixAttribute[]} */
    const list = [];
    for (const a of Array.isArray(raw) ? raw : []) {
      if (!a || typeof a !== 'object') continue;
      let id = str(a.id);
      if (!id || seen.has(id)) id = uid();
      seen.add(id);
      /** @type {AttributeType} */
      const type = TYPES.includes(a.type) ? a.type : 'text';
      const levelIds = new Set();
      /** @type {AttributeLevel[]} */
      const levels = type !== 'choice' ? [] : (Array.isArray(a.levels) ? a.levels : []).map(/** @param {any} l */ l => {
        let lid = str(l && l.id);
        if (!lid || levelIds.has(lid)) lid = uid();
        levelIds.add(lid);
        return { id: lid, name: str(l && l.name) };
      });
      const d = num(a.decimals);
      list.push({
        id,
        name: str(a.name),
        description: str(a.description),
        source: str(a.source),
        type,
        unit: isNumeric(type) ? str(a.unit) : '',
        decimals: type === 'decimal' ? (d != null && d >= 1 && d <= 3 ? Math.round(d) : 1) : 0,
        levels,
        aggregate: AGGREGATES[type].includes(a.aggregate) ? a.aggregate : AGGREGATES[type][0],
        limit: normalizeLimit(a.limit, type, levels),
      });
    }
    return list;
  }

  /**
   * Wert passend zur Form oder `undefined` (= nicht erfasst). Ganzzahlen behalten Nachkommastellen
   * (die Oberfläche markiert sie als ungültig, statt still zu runden).
   * @param {MatrixAttribute} a @param {any} v @returns {AttributeValue | undefined}
   */
  function valueFor(a, v) {
    if (isNumeric(a.type)) return num(v) ?? undefined;
    if (a.type === 'bool') return typeof v === 'boolean' ? v : undefined;
    if (a.type === 'choice') return typeof v === 'string' && a.levels.some(l => l.id === v) ? v : undefined;
    return typeof v === 'string' && v.trim() ? v : undefined;
  }

  /**
   * Werte einer Ausprägung: nur bekannte Merkmale mit passendem Wert.
   * @param {MatrixAttribute[]} attributes @param {any} raw @returns {Record<string, AttributeValue>}
   */
  function normalizeValues(attributes, raw) {
    /** @type {Record<string, AttributeValue>} */
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const a of attributes) {
      const v = valueFor(a, raw[a.id]);
      if (v !== undefined) out[a.id] = v;
    }
    return out;
  }

  /** Name eines Merkmals (leer = „Merkmal n“). @param {MatrixAttribute} a @param {number} index */
  const label = (a, index) => a.name.trim() || Texts.fallback.attribute(index + 1);

  /** Name einer Stufe (leer = „Stufe n“). @param {MatrixAttribute} a @param {string} levelId */
  function levelLabel(a, levelId) {
    const i = a.levels.findIndex(l => l.id === levelId);
    if (i < 0) return '';
    return a.levels[i].name.trim() || Texts.fallback.level(i + 1);
  }

  /**
   * Zahl mit den Nachkommastellen des Merkmals (Ganzzahl: keine; `extra` für Mittelwerte von Ganzzahlen).
   * @param {MatrixAttribute} a @param {number} n @param {number} [digits]
   */
  function formatNumber(a, n, digits = a.decimals) {
    const f = new Intl.NumberFormat(Texts.meta.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const text = f.format(n);
    return a.unit.trim() ? `${text} ${a.unit.trim()}` : text;
  }

  /** Ganzzahl-Merkmal mit Nachkommastellen? @param {MatrixAttribute} a @param {AttributeValue | undefined} v */
  const isInvalid = (a, v) => a.type === 'int' && typeof v === 'number' && !Number.isInteger(v);

  /**
   * Wert einer Ausprägung als Text (leer = nicht erfasst). Ganzzahlen mit Nachkommastellen werden
   * so gezeigt, wie sie erfasst sind.
   * @param {MatrixAttribute} a @param {AttributeValue | undefined} v
   */
  function formatValue(a, v) {
    if (v === undefined) return '';
    if (typeof v === 'number') return formatNumber(a, v, isInvalid(a, v) ? 2 : a.decimals);
    if (typeof v === 'boolean') return v ? Texts.attributes.yes : Texts.attributes.no;
    if (a.type === 'choice') return levelLabel(a, v);
    return v;
  }

  /** Grenze als Text („über 65 dB“, „ab Stufe „Prototyp““, „nicht alle Ja“). @param {MatrixAttribute} a */
  function limitText(a) {
    const l = a.limit;
    if (!l) return '';
    if (l.op === 'allYes') return Texts.attributes.limitText.allYes;
    if (l.op === 'level') return Texts.attributes.limitText.level(levelLabel(a, l.value));
    return Texts.attributes.limitText[l.op](formatNumber(a, l.value, Number.isInteger(l.value) ? a.decimals : 2));
  }

  /** Überschreitet ein einzelner Zahlenwert die Grenze? @param {AttributeLimit} l @param {number} v */
  const beyond = (l, v) => (l.op === 'above' ? v > l.value : l.op === 'below' ? v < l.value : false);

  /**
   * Zusammenfassung eines Merkmals für ein Konzept.
   * Berücksichtigt nur Parameter, in denen mindestens eine Ausprägung einen Wert hat – so zählen
   * Merkmale, die nur für einen Teil der Parameter gelten, nicht als unvollständig.
   * `missing`: davon nicht gewählt oder ohne Wert; `sort`: Wert zum Sortieren (`null` = keiner);
   * `warn`: Grenze überschritten.
   * @param {Matrix} m @param {MatrixAttribute} a @param {MatrixConcept} c
   * @returns {AttributeSummary}
   */
  function summarize(m, a, c) {
    /** @type {AttributeValue[]} */
    const values = [];
    let relevant = 0;
    let missing = 0;
    for (const p of m.parameters) {
      if (!p.options.some(o => o.values[a.id] !== undefined)) continue;
      relevant++;
      const o = p.options.find(x => x.id === c.selections[p.id]);
      const v = o ? o.values[a.id] : undefined;
      if (v === undefined) missing++;
      else values.push(v);
    }
    const base = { relevant, missing, filled: values.length };
    const l = a.limit;
    if (a.type === 'text') {
      return { ...base, text: values.map(v => String(v)).join('; '), sort: null, warn: false };
    }
    if (a.type === 'bool') {
      const yes = values.filter(v => v === true).length;
      return {
        ...base,
        text: relevant ? Texts.attributes.yesCount(yes, relevant) : '',
        sort: relevant ? yes : null,
        warn: !!l && l.op === 'allYes' && yes < relevant,
      };
    }
    if (a.type === 'choice') {
      const idx = values.map(v => a.levels.findIndex(x => x.id === v)).filter(i => i >= 0);
      if (!idx.length) return { ...base, text: '', sort: null, warn: false };
      const i = a.aggregate === 'min' ? Math.min(...idx) : Math.max(...idx);
      const at = l && l.op === 'level' ? a.levels.findIndex(x => x.id === l.value) : -1;
      return { ...base, text: levelLabel(a, a.levels[i].id), sort: i, warn: at >= 0 && idx.some(k => k >= at) };
    }
    const nums = /** @type {number[]} */ (values);
    if (!nums.length) return { ...base, text: '', sort: null, warn: false };
    if (a.aggregate === 'none') {
      return {
        ...base,
        text: nums.map(v => formatValue(a, v)).join(' · '),
        sort: null,
        warn: !!l && nums.some(v => beyond(/** @type {AttributeLimit} */ (l), v)),
      };
    }
    const value = a.aggregate === 'sum' ? nums.reduce((s, v) => s + v, 0)
      : a.aggregate === 'min' ? Math.min(...nums)
        : a.aggregate === 'max' ? Math.max(...nums)
          : nums.reduce((s, v) => s + v, 0) / nums.length;
    // Mittelwert von Ganzzahlen mit einer Nachkommastelle
    const digits = a.aggregate === 'avg' && a.type === 'int' ? 1 : (nums.some(v => isInvalid(a, v)) ? 2 : a.decimals);
    return { ...base, text: formatNumber(a, value, digits), sort: value, warn: !!l && beyond(l, value) };
  }

  /** Lässt sich nach dem Merkmal sortieren? @param {MatrixAttribute} a */
  const sortable = a => a.type === 'choice' || a.type === 'bool' || (isNumeric(a.type) && a.aggregate !== 'none');

  /** Bezeichnung der Zusammenfassung („Summe“, „höchste Stufe“ …). @param {MatrixAttribute} a */
  const aggregateLabel = a => Texts.attributes.aggregates[a.type === 'choice' ? (a.aggregate === 'min' ? 'levelMin' : 'levelMax') : a.aggregate];

  /**
   * Kurztext der Werte einer Ausprägung für enge Stellen (Kombinieren, Knopf): Zahlen und Stufen,
   * ohne Ja/Nein und Text.
   * @param {MatrixAttribute[]} attributes @param {MatrixOption} o
   */
  function shortText(attributes, o) {
    return attributes
      .filter(a => a.type !== 'bool' && a.type !== 'text' && o.values[a.id] !== undefined)
      .map(a => formatValue(a, o.values[a.id]))
      .join(' · ');
  }

  /**
   * Wert passend in die neue Form übernehmen (Ganzzahl ↔ Dezimalzahl bleiben, Zahlen werden zu
   * Text); sonst `undefined`.
   * @param {MatrixAttribute} from @param {AttributeType} to @param {AttributeValue} v
   * @returns {AttributeValue | undefined}
   */
  function convertValue(from, to, v) {
    if (isNumeric(to)) return typeof v === 'number' ? v : undefined;
    if (to === 'text') return formatValue(from, v) || undefined;
    return undefined;
  }

  return {
    TYPES, AGGREGATES, LIMITS, isNumeric, newAttribute, newLevel, normalizeAttributes, normalizeValues, normalizeLimit, valueFor,
    label, levelLabel, formatValue, formatNumber, isInvalid, limitText, summarize, sortable, aggregateLabel, shortText, convertValue,
  };
})();
