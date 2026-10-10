/*
 * Model – Datenmodell der Matrix: Standardwerte, Beispiel, Normalisierung importierter
 * Daten und reine Abfragen. Ohne DOM; exportiert den Namensraum `Model`.
 */
import { Texts } from './texts.js';
import { Util } from './util.js';

export const Model = (() => {
  const { uid, str, num, isColor } = Util;

  /**
   * Konzeptfarben in fester Reihenfolge (auf Unterscheidbarkeit geprüft, auch bei Farbfehlsichtigkeit:
   * benachbarte Farben ΔE ≥ 8, normales Sehen ΔE ≥ 15). Gespeichert wird die helle Stufe;
   * im Dunkelmodus zeigt die Oberfläche die zugehörige Stufe aus COLORS_DARK.
   */
  const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  /** Dieselben Farbtöne für den dunklen Hintergrund (Helligkeit und Kontrast ≥ 3:1 geprüft). */
  const COLORS_DARK = /** @type {Record<string, string>} */ (Object.fromEntries(COLORS.map((c, i) =>
    [c, ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'][i]])));
  const CATEGORY_COLORS = ['#4f46e5', '#0891b2', '#d97706', '#059669', '#db2777', '#7c3aed', '#475569', '#65a30d'];
  /** @type {MatrixSettings['currency'][]} */
  const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'];
  /** @type {MatrixSettings['utilityMax'][]} */
  const SCALES = [5, 10, 100];
  /** MoSCoW-Prioritäten in absteigender Wichtigkeit. @type {MatrixPriority[]} */
  const PRIORITIES = ['must', 'should', 'could', 'wont'];
  /** Schlüssel der Gruppe „Ohne Kategorie“ (z. B. für den Einklappzustand). */
  const NO_CATEGORY = '__none';
  /** @type {MatrixConstraintType[]} */
  const CONSTRAINT_TYPES = ['excluded', 'conditional'];
  /** Status eines Konzepts; „draft“ (Entwurf) ist der Ausgangszustand. @type {ConceptStatus[]} */
  const CONCEPT_STATUSES = ['draft', 'favorite', 'dropped', 'chosen'];

  /**
   * Aktuelle Version des Datenformats (gespeicherte Matrizen, JSON-Export, Teilen-Links).
   * Beschreibung: docs/DATENFORMAT.md. Bei inkompatiblen Änderungen erhöhen und in
   * MIGRATIONS eine Umwandlung von der Vorgängerversion ergänzen.
   */
  const SCHEMA_VERSION = 6;

  /**
   * Umwandlungen von Version n auf n + 1. Sie erhalten die Rohdaten und liefern Rohdaten;
   * fehlende optionale Felder ergänzt anschließend `normalize()`.
   * @type {Record<number, (data: any) => any>}
   */
  const MIGRATIONS = {
    // 1 → 2: In der ersten Fassung waren Ausprägungen reine Texte. Version 1 umfasst außerdem
    // alle Stände vor der Versionierung (ohne Bewertung/Kategorien – diese Felder sind optional).
    1: data => ({
      ...data,
      parameters: data.parameters.map(/** @param {any} p */ p => (p && Array.isArray(p.options)
        ? { ...p, options: p.options.map(/** @param {any} o */ o => (typeof o === 'string' ? { text: o } : o)) }
        : p)),
    }),
    // 2 → 3: optionale Priorität (MoSCoW) je Ausprägung und Schalter `settings.moscow`.
    // Keine Umwandlung nötig – die neue Version verhindert, dass ältere App-Versionen
    // die Prioritäten beim Öffnen stillschweigend verwerfen.
    2: data => data,
    // 3 → 4: optionale Notizen (`note`) je Ausprägung, Parameter und Konzept. Keine Umwandlung
    // nötig – die neue Version verhindert, dass ältere App-Versionen die Notizen verwerfen.
    3: data => data,
    // 4 → 5: Verträglichkeiten zwischen Ausprägungen (`constraints`). Keine Umwandlung nötig –
    // die neue Version verhindert, dass ältere App-Versionen sie verwerfen.
    4: data => data,
    // 5 → 6: Status je Konzept (`status`, `statusNote`). Keine Umwandlung nötig (fehlt der
    // Status, gilt „Entwurf“) – die neue Version verhindert, dass ältere App-Versionen ihn verwerfen.
    5: data => data,
  };

  /**
   * Bringt Rohdaten auf die aktuelle Formatversion. Fehlt die Version, gilt 1.
   * Wirft bei Dateien aus einer neueren App-Version, statt unbekannte Felder still zu verwerfen.
   * @param {any} data
   */
  function migrate(data) {
    let version = Number.isInteger(data.version) && data.version >= 1 ? data.version : 1;
    if (version > SCHEMA_VERSION) {
      throw new Error(Texts.errors.newerFormat(version, SCHEMA_VERSION));
    }
    let result = data;
    while (version < SCHEMA_VERSION) {
      result = MIGRATIONS[version](result);
      version++;
    }
    return result;
  }

  /** @returns {MatrixSettings} */
  function defaultSettings() {
    return { costs: false, utility: false, currency: 'EUR', utilityMax: 10, moscow: false };
  }

  /** @returns {MatrixOption} */
  function newOption() {
    return { id: uid(), text: '', cost: null, score: null, priority: null, note: '' };
  }

  /** @param {string | null} [categoryId] @returns {MatrixParameter} */
  function newParameter(categoryId = null, name = '') {
    return { id: uid(), name, note: '', weight: null, categoryId, options: [newOption(), newOption()] };
  }

  /** Erste noch nicht verwendete Farbe einer Palette. @param {string[]} palette @param {string[]} used */
  function nextFreeColor(palette, used) {
    const taken = new Set(used.map(c => c.toLowerCase()));
    return palette.find(c => !taken.has(c)) || palette[used.length % palette.length];
  }

  /** @param {MatrixConcept[]} concepts */
  const nextConceptColor = concepts => nextFreeColor(COLORS, concepts.map(c => c.color));
  /** @param {MatrixCategory[]} categories */
  const nextCategoryColor = categories => nextFreeColor(CATEGORY_COLORS, categories.map(k => k.color));

  /** @param {Matrix} m @param {string} [base] @returns {MatrixConcept} */
  function newConcept(m, base) {
    return {
      id: uid(),
      name: uniqueName(m.concepts.map(c => c.name), base || Texts.fallback.concept(m.concepts.length + 1)),
      color: nextConceptColor(m.concepts),
      note: '',
      status: 'draft',
      statusNote: '',
      selections: {},
    };
  }

  /** „Name“, sonst „Name 2“, „Name 3“, … @param {string[]} existing @param {string} base */
  function uniqueName(existing, base) {
    const names = new Set(existing);
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }

  /** @returns {Matrix} */
  function blankState() {
    const parameters = [1, 2, 3].map(i => newParameter(null, Texts.fallback.parameter(i)));
    /** @type {MatrixConcept} */
    const concept = { id: uid(), name: Texts.fallback.concept(1), color: COLORS[0], note: '', status: 'draft', statusNote: '', selections: {} };
    return {
      version: SCHEMA_VERSION,
      title: Texts.fallback.newMatrixTitle,
      description: '',
      settings: defaultSettings(),
      categories: [],
      parameters,
      concepts: [concept],
      constraints: [],
      activeConceptId: concept.id,
    };
  }

  /**
   * Prüft, migriert (siehe `migrate`) und bereinigt beliebige – z. B. importierte – Daten.
   * Wirft bei unbrauchbarem Format oder Daten aus einer neueren App-Version.
   * @param {any} data
   * @returns {Matrix}
   */
  function normalize(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.parameters)) {
      throw new Error(Texts.errors.invalidFormat);
    }
    data = migrate(data);
    // Rohdaten (any) werden hier geprüft und in typisierte Objekte überführt
    const seen = new Set();
    /** @param {unknown} v */
    const id = v => {
      let s = str(v);
      if (!s || seen.has(s)) s = uid();
      seen.add(s);
      return s;
    };
    /** @type {MatrixParameter[]} */
    const parameters = data.parameters.map(/** @param {any} p */ p => {
      const weight = num(p && p.weight);
      return {
        id: id(p && p.id),
        name: str(p && p.name),
        note: str(p && p.note),
        weight: weight != null && weight >= 0 ? weight : null,
        categoryId: str(p && p.categoryId) || null,
        options: (Array.isArray(p && p.options) ? p.options : []).map(/** @param {any} o */ o =>
          ({
            id: id(o && o.id), text: str(o && o.text), cost: num(o && o.cost), score: num(o && o.score),
            priority: PRIORITIES.includes(o && o.priority) ? o.priority : null,
            note: str(o && o.note),
          })),
      };
    });
    /** @type {MatrixCategory[]} */
    const categories = (Array.isArray(data.categories) ? data.categories : []).map(/** @param {any} k @param {number} i */ (k, i) => ({
      id: id(k && k.id),
      name: str(k && k.name),
      color: isColor(k && k.color) ? k.color : CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
    for (const p of parameters) {
      if (!categories.some(k => k.id === p.categoryId)) p.categoryId = null;
    }
    const src = (data.settings && typeof data.settings === 'object') ? data.settings : {};
    const settings = {
      costs: src.costs === true,
      utility: src.utility === true,
      currency: CURRENCIES.includes(src.currency) ? src.currency : 'EUR',
      utilityMax: SCALES.includes(src.utilityMax) ? src.utilityMax : 10,
      moscow: src.moscow === true,
    };
    /** @type {MatrixConcept[]} */
    const concepts = (Array.isArray(data.concepts) ? data.concepts : []).map(/** @param {any} c @param {number} i */ (c, i) => {
      /** @type {Record<string, string>} */
      const selections = {};
      const sel = (c && c.selections) || {};
      for (const p of parameters) {
        const oid = str(sel[p.id]);
        if (oid && p.options.some(o => o.id === oid)) selections[p.id] = oid;
      }
      return {
        id: id(c && c.id),
        name: str(c && c.name, Texts.fallback.concept(i + 1)),
        color: isColor(c && c.color) ? c.color : COLORS[i % COLORS.length],
        note: str(c && c.note),
        status: CONCEPT_STATUSES.includes(c && c.status) ? c.status : 'draft',
        statusNote: str(c && c.statusNote),
        selections,
      };
    });
    // Verträglichkeiten: nur Paare aus vorhandenen Ausprägungen verschiedener Parameter, je Paar einmal
    const index = optionIndex({ parameters });
    const owner = (/** @type {string} */ oid) => { const r = index.get(oid); return r ? r.p.id : null; };
    const pairs = new Set();
    /** @type {MatrixConstraint[]} */
    const constraints = [];
    for (const x of Array.isArray(data.constraints) ? data.constraints : []) {
      const a = str(x && x.a);
      const b = str(x && x.b);
      if (!owner(a) || !owner(b) || owner(a) === owner(b)) continue;
      if (!CONSTRAINT_TYPES.includes(x.type)) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (pairs.has(k)) continue;
      pairs.add(k);
      constraints.push({ a: a < b ? a : b, b: a < b ? b : a, type: x.type, note: str(x.note) });
    }
    const activeConceptId = concepts.some(c => c.id === data.activeConceptId)
      ? data.activeConceptId
      : (concepts[0] ? concepts[0].id : null);
    return {
      version: SCHEMA_VERSION,
      title: str(data.title, Texts.fallback.matrixTitle),
      description: str(data.description),
      settings,
      categories,
      parameters: sortedByCategory(categories, parameters),
      concepts,
      constraints,
      activeConceptId,
    };
  }

  /**
   * Parameter nach Kategorien gruppiert sortieren (Reihenfolge der Kategorien, ohne
   * Kategorie zuletzt; innerhalb einer Gruppe stabil). So entspricht die Reihenfolge
   * im Array immer der Anzeige – Linien, Vergleich und Export brauchen keine Sonderfälle.
   * @param {MatrixCategory[]} categories
   * @param {MatrixParameter[]} parameters
   * @returns {MatrixParameter[]}
   */
  function sortedByCategory(categories, parameters) {
    const rank = new Map(categories.map((k, i) => [k.id, i]));
    /** @param {MatrixParameter} p */
    const r = p => rank.get(p.categoryId ?? '') ?? categories.length;
    return parameters.map((p, i) => ({ p, i }))
      .sort((a, b) => r(a.p) - r(b.p) || a.i - b.i)
      .map(x => x.p);
  }

  /** Stellt die Sortierung nach Kategorien in einer Matrix wieder her. @param {Matrix} m */
  function resort(m) {
    m.parameters = sortedByCategory(m.categories, m.parameters);
  }

  /** @param {Matrix} m @param {string | null} id @returns {MatrixCategory | null} */
  function categoryById(m, id) {
    return m.categories.find(k => k.id === id) || null;
  }

  /**
   * Parametergruppen in Anzeigereihenfolge; ohne Kategorien genau eine Gruppe ohne Kopfzeile.
   * @param {Matrix} m
   * @returns {Array<{ cat: MatrixCategory | null, items: Array<{ p: MatrixParameter, pi: number }> }>}
   */
  function categoryGroups(m) {
    /** @typedef {{ cat: MatrixCategory | null, items: Array<{ p: MatrixParameter, pi: number }> }} Group */
    /** @type {Group[]} */
    const groups = m.categories.map(cat => ({ cat, items: [] }));
    /** @type {Group} */
    const none = { cat: null, items: [] };
    m.parameters.forEach((p, pi) => {
      const g = groups.find(x => x.cat && x.cat.id === p.categoryId) || none;
      g.items.push({ p, pi });
    });
    if (none.items.length || !groups.length) groups.push(none);
    return groups;
  }

  /** Nur innerhalb der eigenen Kategorie verschiebbar. @param {Matrix} m @param {number} index @param {number} delta */
  function canMoveParameter(m, index, delta) {
    const p = m.parameters[index];
    const q = m.parameters[index + delta];
    return !!p && !!q && q.categoryId === p.categoryId;
  }

  /** @param {MatrixParameter} p @param {MatrixConcept} c @returns {MatrixOption | null} */
  function selectedOption(p, c) {
    const oid = c.selections[p.id];
    return oid ? p.options.find(o => o.id === oid) || null : null;
  }

  /**
   * Verzeichnis Ausprägungs-ID → Ausprägung samt Parameter (für viele Zugriffe).
   * @param {{ parameters: MatrixParameter[] }} m @returns {Map<string, OptionRef>}
   */
  function optionIndex(m) {
    /** @type {Map<string, OptionRef>} */
    const map = new Map();
    m.parameters.forEach((p, pi) => p.options.forEach((o, oi) => map.set(o.id, { p, pi, o, oi })));
    return map;
  }

  /**
   * Eine Ausprägung samt Parameter, `null`, wenn es sie nicht gibt (für einzelne Zugriffe).
   * @param {{ parameters: MatrixParameter[] }} m @param {string} oid @returns {OptionRef | null}
   */
  function findOption(m, oid) {
    for (const [pi, p] of m.parameters.entries()) {
      const oi = p.options.findIndex(o => o.id === oid);
      if (oi >= 0) return { p, pi, o: p.options[oi], oi };
    }
    return null;
  }

  /** Anzeigetext einer Ausprägung (mit Ersatztext für leere). @param {MatrixParameter} p @param {string} oid */
  function optionText(p, oid) {
    const idx = p.options.findIndex(o => o.id === oid);
    if (idx < 0) return null;
    return p.options[idx].text.trim() || Texts.fallback.emptyOption(idx + 1);
  }

  /** @param {Record<string, string>} a @param {Record<string, string>} b */
  function sameSelections(a, b) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
  }

  /**
   * Parameter, bei denen sich die Konzepte unterscheiden („nicht gewählt“ zählt als eigene Wahl).
   * Bei weniger als zwei Konzepten unterscheidet sich nichts.
   * @param {Matrix} m @returns {Set<string>} Parameter-IDs
   */
  function differingParameters(m) {
    const ids = new Set();
    if (m.concepts.length < 2) return ids;
    for (const p of m.parameters) {
      const first = m.concepts[0].selections[p.id];
      if (m.concepts.some(c => c.selections[p.id] !== first)) ids.add(p.id);
    }
    return ids;
  }

  /**
   * Suche in Parameternamen, Ausprägungen und deren Notizen (ohne Groß-/Kleinschreibung und Akzente).
   * @param {Matrix} m @param {string} query
   * @returns {{ params: Set<string>, options: Set<string>, hits: Array<{ pid: string, oid: string | null }> }}
   *   `params`: Parameter mit Treffer (in Name/Beschreibung oder einer Ausprägung), `options`: getroffene
   *   Ausprägungen (Text oder Notiz), `hits`: alle Treffer in Anzeige-Reihenfolge (Parameter mit `oid: null`)
   */
  function search(m, query) {
    const q = Util.searchKey(query);
    const result = { params: new Set(), options: new Set(), hits: /** @type {Array<{ pid: string, oid: string | null }>} */ ([]) };
    if (!q) return result;
    /** @param {string[]} texts */
    const matches = texts => texts.some(t => Util.searchKey(t).includes(q));
    for (const p of m.parameters) {
      if (matches([p.name, p.note])) result.hits.push({ pid: p.id, oid: null });
      for (const o of p.options) {
        if (!matches([o.text, o.note])) continue;
        result.options.add(o.id);
        result.hits.push({ pid: p.id, oid: o.id });
      }
    }
    result.hits.forEach(hit => result.params.add(hit.pid));
    return result;
  }

  // Ersatznamen für leere Felder – an einer Stelle, damit Anzeige und Export übereinstimmen
  /** @param {MatrixParameter} p @param {number} index */
  const parameterLabel = (p, index) => p.name || Texts.fallback.parameter(index + 1);
  /** @param {MatrixCategory | null} k */
  const categoryLabel = k => (k ? k.name || Texts.fallback.unnamed : Texts.fallback.noCategory);
  /** @param {{ name: string } | null | undefined} x */
  const nameOrUnnamed = x => (x && x.name) || Texts.fallback.unnamed;

  return {
    COLORS, COLORS_DARK, CATEGORY_COLORS, CURRENCIES, SCALES, PRIORITIES, CONCEPT_STATUSES, NO_CATEGORY, SCHEMA_VERSION, migrate,
    defaultSettings, newOption, newParameter, newConcept, nextConceptColor, nextCategoryColor, uniqueName,
    blankState, normalize, sortedByCategory, resort,
    categoryById, categoryGroups, canMoveParameter, selectedOption, optionText, sameSelections,
    differingParameters, search, optionIndex, findOption,
    parameterLabel, categoryLabel, nameOrUnnamed,
  };
})();
