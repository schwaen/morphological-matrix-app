/*
 * Model – Datenmodell der Matrix: Standardwerte, Beispiel, Normalisierung importierter
 * Daten und reine Abfragen. Ohne DOM; stellt den globalen Namensraum `Model` bereit.
 */
'use strict';

const Model = (() => {
  const { uid, str, num, isColor } = Util;

  const COLORS = ['#e8590c', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#e03131', '#0c8599', '#f08c00', '#5f3dc4'];
  const CATEGORY_COLORS = ['#4f46e5', '#0891b2', '#d97706', '#059669', '#db2777', '#7c3aed', '#475569', '#65a30d'];
  /** @type {MatrixSettings['currency'][]} */
  const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'];
  /** @type {MatrixSettings['utilityMax'][]} */
  const SCALES = [5, 10, 100];
  /** Schlüssel der Gruppe „Ohne Kategorie“ (z. B. für den Einklappzustand). */
  const NO_CATEGORY = '__none';

  /**
   * Aktuelle Version des Datenformats (gespeicherte Matrizen, JSON-Export, Teilen-Links).
   * Beschreibung: docs/DATENFORMAT.md. Bei inkompatiblen Änderungen erhöhen und in
   * MIGRATIONS eine Umwandlung von der Vorgängerversion ergänzen.
   */
  const SCHEMA_VERSION = 2;

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
      parameters: data.parameters.map(p => (p && Array.isArray(p.options)
        ? { ...p, options: p.options.map(o => (typeof o === 'string' ? { text: o } : o)) }
        : p)),
    }),
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
    return { costs: false, utility: false, currency: 'EUR', utilityMax: 10 };
  }

  /** @returns {MatrixOption} */
  function newOption() {
    return { id: uid(), text: '', cost: null, score: null };
  }

  /** @param {string | null} [categoryId] @returns {MatrixParameter} */
  function newParameter(categoryId = null, name = '') {
    return { id: uid(), name, weight: null, categoryId, options: [newOption(), newOption()] };
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
    const concept = { id: uid(), name: Texts.fallback.concept(1), color: COLORS[0], selections: {} };
    return {
      version: SCHEMA_VERSION,
      title: Texts.fallback.newMatrixTitle,
      description: '',
      settings: defaultSettings(),
      categories: [],
      parameters,
      concepts: [concept],
      activeConceptId: concept.id,
    };
  }

  /** @returns {Matrix} */
  function exampleState() {
    // [Parameter, Gewicht, [[Ausprägung, Kosten, Nutzwert 0–10], …]]
    /** @type {Array<[string, number, Array<[string, number, number]>]>} */
    const rows = [
      ['Wassererwärmung', 3, [['Durchlauferhitzer', 18, 6], ['Boiler', 25, 5], ['Thermoblock', 22, 8], ['Induktion', 40, 9]]],
      ['Druckerzeugung', 3, [['Schwerkraft', 2, 3], ['Vibrationspumpe', 12, 7], ['Rotationspumpe', 45, 9], ['Handhebel', 8, 6]]],
      ['Kaffeezufuhr', 2, [['Pulver (lose)', 3, 6], ['Kapsel', 10, 8], ['Pad', 6, 5], ['Bohnen mit Mahlwerk', 35, 9]]],
      ['Bedienung', 1, [['Drehknopf', 2, 5], ['Tasten', 4, 6], ['Touch-Display', 20, 8], ['Smartphone-App', 15, 7]]],
      ['Energieversorgung', 2, [['Netzstrom', 3, 8], ['Akku', 30, 6], ['Gaskartusche', 15, 5], ['Muskelkraft', 1, 3]]],
      ['Reinigung', 1, [['Manuell', 0, 3], ['Automatische Spülung', 10, 8], ['Spülmaschinenfest', 5, 7]]],
    ];
    const categories = [
      { id: uid(), name: 'Brühsystem', color: CATEGORY_COLORS[0] },
      { id: uid(), name: 'Nutzung & Betrieb', color: CATEGORY_COLORS[1] },
    ];
    const parameters = rows.map(([name, weight, opts], i) => ({
      id: uid(),
      name,
      weight,
      categoryId: categories[i < 3 ? 0 : 1].id,
      options: opts.map(([text, cost, score]) => ({ id: uid(), text, cost, score })),
    }));
    const pick = idx => Object.fromEntries(parameters.map((p, i) => [p.id, p.options[idx[i]].id]));
    const concepts = [
      { id: uid(), name: 'Kompakt-Espresso', color: COLORS[0], selections: pick([2, 1, 0, 1, 0, 1]) },
      { id: uid(), name: 'Outdoor', color: COLORS[1], selections: pick([3, 3, 2, 0, 3, 0]) },
      { id: uid(), name: 'Smart Home', color: COLORS[2], selections: pick([1, 2, 3, 3, 0, 1]) },
    ];
    return {
      version: SCHEMA_VERSION,
      title: 'Beispiel: Kaffeemaschine',
      description: 'Gesamtfunktion: Aus Wasser und Kaffee ein heißes Getränk zubereiten.',
      // Kosten und Nutzwerte sind hinterlegt, aber zunächst ausgeblendet.
      settings: defaultSettings(),
      categories,
      parameters,
      concepts,
      activeConceptId: concepts[0].id,
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
    const seen = new Set();
    const id = v => {
      let s = str(v);
      if (!s || seen.has(s)) s = uid();
      seen.add(s);
      return s;
    };
    const parameters = data.parameters.map(p => {
      const weight = num(p && p.weight);
      return {
        id: id(p && p.id),
        name: str(p && p.name),
        weight: weight != null && weight >= 0 ? weight : null,
        categoryId: str(p && p.categoryId) || null,
        options: (Array.isArray(p && p.options) ? p.options : []).map(o =>
          ({ id: id(o && o.id), text: str(o && o.text), cost: num(o && o.cost), score: num(o && o.score) })),
      };
    });
    const categories = (Array.isArray(data.categories) ? data.categories : []).map((k, i) => ({
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
    };
    const concepts = (Array.isArray(data.concepts) ? data.concepts : []).map((c, i) => {
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
        selections,
      };
    });
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
    const r = p => (rank.has(p.categoryId) ? rank.get(p.categoryId) : categories.length);
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
    const groups = m.categories.map(cat => ({ cat, items: [] }));
    const none = { cat: null, items: [] };
    m.parameters.forEach((p, pi) => {
      const g = groups.find(x => x.cat.id === p.categoryId) || none;
      g.items.push({ p, pi });
    });
    if (none.items.length || !groups.length) groups.push(none);
    return groups;
  }

  /** Nur innerhalb der eigenen Kategorie verschiebbar. @param {Matrix} m */
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

  // Ersatznamen für leere Felder – an einer Stelle, damit Anzeige und Export übereinstimmen
  /** @param {MatrixParameter} p @param {number} index */
  const parameterLabel = (p, index) => p.name || Texts.fallback.parameter(index + 1);
  /** @param {MatrixCategory | null} k */
  const categoryLabel = k => (k ? k.name || Texts.fallback.unnamed : Texts.fallback.noCategory);
  /** @param {{ name: string } | null | undefined} x */
  const nameOrUnnamed = x => (x && x.name) || Texts.fallback.unnamed;

  return {
    COLORS, CATEGORY_COLORS, CURRENCIES, SCALES, NO_CATEGORY, SCHEMA_VERSION, migrate,
    defaultSettings, newOption, newParameter, newConcept, nextConceptColor, nextCategoryColor, uniqueName,
    blankState, exampleState, normalize, sortedByCategory, resort,
    categoryById, categoryGroups, canMoveParameter, selectedOption, optionText, sameSelections,
    parameterLabel, categoryLabel, nameOrUnnamed,
  };
})();
