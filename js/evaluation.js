/*
 * Evaluation – Kosten, Nutzwert, Preis-Leistung und die Strategien für automatisch
 * erstellte Konzepte. Reine Funktionen auf einer Matrix (ohne DOM, ohne globalen Zustand);
 * stellt den globalen Namensraum `Evaluation` bereit.
 */
'use strict';

const Evaluation = (() => {
  const { selectedOption } = Model;

  /** @param {MatrixParameter} p */
  const weightOf = p => (p.weight == null ? 1 : p.weight);
  /** @param {Matrix} m */
  const totalWeight = m => m.parameters.reduce((s, p) => s + weightOf(p), 0);
  /** Nutzwert auf die Skala der Matrix begrenzen. @param {Matrix} m @param {number} s */
  const clampScore = (m, s) => Math.min(m.settings.utilityMax, Math.max(0, s));
  /** @param {Matrix} m */
  const isEnabled = m => m.settings.costs || m.settings.utility;

  /**
   * Summe der Kosten aller gewählten Ausprägungen; `missing` zählt fehlende Angaben.
   * @param {Matrix} m @param {MatrixConcept} c
   * @returns {{ total: number, missing: number }}
   */
  function conceptCost(m, c) {
    let total = 0;
    let missing = 0;
    for (const p of m.parameters) {
      const o = selectedOption(p, c);
      if (!o || o.cost == null) missing++;
      else total += o.cost;
    }
    return { total, missing };
  }

  /**
   * Gesamtnutzwert wie in der Nutzwertanalyse: Σ (Gewicht × Erfüllungsgrad) / Σ Gewichte.
   * Nicht gewählte oder unbewertete Parameter gehen mit 0 ein.
   * @param {Matrix} m @param {MatrixConcept} c
   * @returns {{ value: number | null, missing: number }}
   */
  function conceptUtility(m, c) {
    const sumW = totalWeight(m);
    let sum = 0;
    let missing = 0;
    for (const p of m.parameters) {
      const o = selectedOption(p, c);
      if (!o || o.score == null) {
        if (weightOf(p) > 0) missing++;
        continue;
      }
      sum += weightOf(p) * clampScore(m, o.score);
    }
    return { value: sumW > 0 ? sum / sumW : null, missing };
  }

  /**
   * Preis-Leistungs-Verhältnis als Kosten je Nutzwertpunkt (niedriger ist besser).
   * Nur sinnvoll, wenn Kosten und Nutzwerte des Konzepts vollständig gepflegt sind.
   * @param {Matrix} m @param {MatrixConcept} c
   * @returns {{ value: number | null, reason: string | null }}
   */
  function priceValue(m, c) {
    const cost = conceptCost(m, c);
    const util = conceptUtility(m, c);
    if (cost.missing || util.missing) {
      return { value: null, reason: Texts.evaluation.incomplete };
    }
    if (!util.value) return { value: null, reason: Texts.evaluation.zeroUtility };
    return { value: cost.total / util.value, reason: null };
  }

  /**
   * Anteil des Gewichts eines Parameters (0–1) oder `null`, wenn alle Gewichte 0 sind.
   * @param {Matrix} m @param {MatrixParameter} p @returns {number | null}
   */
  function weightShare(m, p) {
    const sumW = totalWeight(m);
    return sumW > 0 ? weightOf(p) / sumW : null;
  }

  /**
   * Anzahl der gewählten Ausprägungen eines Konzepts je Priorität (MoSCoW).
   * `none`: gewählt, aber ohne Priorität. Nicht gewählte Parameter zählen nicht.
   * @param {Matrix} m @param {MatrixConcept} c
   * @returns {Record<MatrixPriority | 'none', number>}
   */
  function priorityProfile(m, c) {
    const counts = { must: 0, should: 0, could: 0, wont: 0, none: 0 };
    for (const p of m.parameters) {
      const o = p.options.find(x => x.id === c.selections[p.id]);
      if (o) counts[o.priority || 'none']++;
    }
    return counts;
  }

  // ---------- Automatische Konzepte ----------

  /** Wählt die Ausprägung mit dem lexikografisch kleinsten Schlüssel; Kandidaten per Filter. */
  function pickBy(p, filter, key) {
    let best = null;
    let bestKey = null;
    for (const o of p.options) {
      if (!filter(o)) continue;
      const k = key(o);
      if (!best || Util.lexLess(k, bestKey)) { best = o; bestKey = k; }
    }
    return best;
  }

  /** @param {MatrixOption} o */
  const hasScore = o => o.score != null;
  /** @param {MatrixOption} o */
  const hasCost = o => o.cost != null;
  // Nebenkriterien bei Gleichstand (nur wenn die jeweilige Bewertung aktiv ist)
  const tieCost = (m, o) => (m.settings.costs && hasCost(o) ? o.cost : Infinity);
  const tieScore = (m, o) => (m.settings.utility && hasScore(o) ? -clampScore(m, o.score) : Infinity);

  /**
   * @typedef {{ selections?: Record<string, string>, skipped?: number, error?: string }} BuildResult
   */

  /**
   * Je Parameter unabhängig wählen – exakt für Summenkriterien (Kosten, gewichteter Nutzwert).
   * @param {(o: MatrixOption) => boolean} filter
   * @param {(m: Matrix, o: MatrixOption) => number[]} key
   * @returns {(m: Matrix) => BuildResult}
   */
  function separable(filter, key) {
    return m => {
      /** @type {Record<string, string>} */
      const selections = {};
      let skipped = 0;
      for (const p of m.parameters) {
        const o = pickBy(p, filter, o2 => key(m, o2));
        if (o) selections[p.id] = o.id;
        else skipped++;
      }
      return { selections, skipped };
    };
  }

  /**
   * Bestes Preis-Leistungs-Verhältnis (minimale Kosten je Nutzwertpunkt).
   * Der Quotient ist nicht je Parameter zerlegbar; das Dinkelbach-Verfahren löst ihn
   * exakt über eine Folge zerlegbarer Probleme min Σ (Kosten − λ · Nutzwertanteil).
   * @param {Matrix} m
   * @returns {BuildResult}
   */
  function buildBestValue(m) {
    const W = totalWeight(m);
    const cands = m.parameters.map(p => p.options.filter(o => hasCost(o) && hasScore(o)));
    if (!m.parameters.length || cands.some(list => !list.length)) {
      return { error: Texts.evaluation.needsAllValues };
    }
    if (W <= 0) return { error: Texts.evaluation.zeroWeights };
    const util = (p, o) => (weightOf(p) * clampScore(m, o.score)) / W;
    const solve = objective => m.parameters.map((p, i) => cands[i].reduce((best, o) => {
      const d = objective(p, o) - objective(p, best);
      return d < -1e-12 || (Math.abs(d) <= 1e-12 && util(p, o) > util(p, best)) ? o : best;
    }));
    const totals = xs => xs.reduce((t, o, i) => ({ C: t.C + o.cost, U: t.U + util(m.parameters[i], o) }), { C: 0, U: 0 });

    // Start: höchster Nutzwert
    let x = solve((p, o) => -util(p, o));
    const { C, U } = totals(x);
    if (U <= 0) return { error: Texts.evaluation.allScoresZero };
    let lambda = C / U;
    for (let iter = 0; iter < 100; iter++) {
      const next = solve((p, o) => o.cost - lambda * util(p, o));
      const t = totals(next);
      if (t.U <= 0 || t.C - lambda * t.U >= -1e-9) break;
      x = next;
      lambda = t.C / t.U;
    }
    return { selections: Object.fromEntries(m.parameters.map((p, i) => [p.id, x[i].id])), skipped: 0 };
  }

  /**
   * Strategien zum automatischen Erstellen eines Konzepts; Reihenfolge = Reihenfolge der Knöpfe.
   * @type {Record<string, { label: string, missing: string, available: (m: Matrix) => boolean, build: (m: Matrix) => BuildResult }>}
   */
  const GENERATORS = {
    'max-utility': {
      ...Texts.evaluation.generators['max-utility'],
      available: m => m.settings.utility,
      build: separable(hasScore, (m, o) => [-clampScore(m, o.score), tieCost(m, o)]),
    },
    'min-utility': {
      ...Texts.evaluation.generators['min-utility'],
      available: m => m.settings.utility,
      build: separable(hasScore, (m, o) => [clampScore(m, o.score), tieCost(m, o)]),
    },
    'min-cost': {
      ...Texts.evaluation.generators['min-cost'],
      available: m => m.settings.costs,
      build: separable(hasCost, (m, o) => [o.cost, tieScore(m, o)]),
    },
    'max-cost': {
      ...Texts.evaluation.generators['max-cost'],
      available: m => m.settings.costs,
      build: separable(hasCost, (m, o) => [-o.cost, tieScore(m, o)]),
    },
    'best-value': {
      ...Texts.evaluation.generators['best-value'],
      available: m => m.settings.costs && m.settings.utility,
      build: buildBestValue,
    },
    // MoSCoW-Pfade: je Parameter nur Ausprägungen genau dieser Priorität (ohne Rückfall auf
    // eine andere Stufe; Parameter ohne passende Priorität bleiben leer).
    // MVP: bei mehreren die günstigste; Standard/Premium: die mit dem höchsten Nutzwert.
    'moscow-must': {
      ...Texts.evaluation.generators['moscow-must'],
      available: m => m.settings.moscow,
      build: separable(o => o.priority === 'must', (m, o) => [tieCost(m, o), tieScore(m, o)]),
    },
    'moscow-should': {
      ...Texts.evaluation.generators['moscow-should'],
      available: m => m.settings.moscow,
      build: separable(o => o.priority === 'should', (m, o) => [tieScore(m, o), tieCost(m, o)]),
    },
    'moscow-could': {
      ...Texts.evaluation.generators['moscow-could'],
      available: m => m.settings.moscow,
      build: separable(o => o.priority === 'could', (m, o) => [tieScore(m, o), tieCost(m, o)]),
    },
  };

  return {
    weightOf, totalWeight, clampScore, isEnabled, weightShare,
    conceptCost, conceptUtility, priceValue, priorityProfile,
    GENERATORS,
  };
})();
