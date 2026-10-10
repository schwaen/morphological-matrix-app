/*
 * Solutions – Lösungsraum: widerspruchsfreie Kombinationen suchen, filtern und sortieren.
 * Ohne Texte und DOM, damit die Suche im Web Worker laufen kann (js/solutions-worker.js);
 * die Anzeige (Texte der Merkmale usw.) entsteht in der Oberfläche.
 *
 * Kleine Lösungsräume werden vollständig durchsucht (exakte Trefferzahl). Große werden per
 * Branch & Bound nach den besten `limit` Kombinationen der gewählten Sortierung durchsucht:
 * Ein Zweig entfällt, wenn er Filter sicher verletzt oder selbst im günstigsten Fall nicht
 * besser als der schlechteste bisherige Treffer werden kann. Reicht das Rechenbudget nicht,
 * ist das Ergebnis als unvollständig markiert.
 */

/**
 * @typedef {{
 *   fixed: Record<string, string>,
 *   limits: boolean,
 *   strict: boolean,
 *   maxCost: number | null,
 *   minUtility: number | null,
 *   sort: string,
 *   limit: number,
 * }} SolutionQuery
 * `fixed`: Parameter-ID → festgelegte Ausprägung; `limits`: Grenzen der eigenen Merkmale
 * einhalten; `strict`: auch bedingt verträgliche Paare ausschließen; `sort` wie im
 * Konzeptvergleich (`order`, `utility`, `cost`, `priceValue`, `attr:<id>:asc|desc`).
 */
/**
 * @typedef {{
 *   selections: Record<string, string>,
 *   cost: number, costMissing: number,
 *   utility: number | null, utilityMissing: number,
 *   priceValue: number | null,
 * }} SolutionRow
 */
/**
 * @typedef {{ rows: SolutionRow[], matched: number | null, exhaustive: boolean, complete: boolean }} SolutionResult
 * `matched`: Zahl aller passenden Kombinationen (nur bei vollständiger Durchsuchung);
 * `exhaustive`: alle Kombinationen geprüft; `complete`: Ergebnis sicher (Budget reichte).
 */

export const Solutions = (() => {
  /** Bis zu so vielen Kombinationen (Produkt der Kandidaten) wird vollständig durchsucht. */
  const FULL_LIMIT = 300000;
  /** Rechenbudget (besuchte Knoten) für große Lösungsräume. */
  const NODE_BUDGET = 4000000;
  /** Höchstzahl der Treffer in großen Lösungsräumen. */
  const BIG_LIMIT = 200;

  /** @param {any} v */
  const isNum = v => typeof v === 'number' && Number.isFinite(v);

  /**
   * Kennzahl über die gewählten Ausprägungen: je Parameter ein Beitrag je Ausprägung
   * (`null` = kein Wert), zusammengefasst als Summe, Maximum, Minimum oder Mittelwert.
   * @typedef {{ agg: 'sum' | 'max' | 'min' | 'avg', vals: Array<Array<number | null>> }} Measure
   */

  /**
   * @param {Matrix} m @param {SolutionQuery} q
   */
  function compile(m, q) {
    const P = m.parameters;
    const { settings } = m;
    const max = settings.utilityMax;
    const weights = P.map(p => (p.weight == null ? 1 : p.weight));
    const W = weights.reduce((s, w) => s + w, 0);
    /** @type {Measure} */
    const cost = { agg: 'sum', vals: P.map(p => p.options.map(o => (isNum(o.cost) ? /** @type {number} */ (o.cost) : null))) };
    /** @type {Measure} */
    const utility = {
      agg: 'sum',
      // Gewicht × Erfüllungsgrad; geteilt durch die Summe der Gewichte wird erst am Ende (wie im Vergleich)
      vals: P.map((p, i) => p.options.map(o => (isNum(o.score) && W > 0
        ? weights[i] * Math.min(max, Math.max(0, /** @type {number} */ (o.score))) : null))),
    };
    // Merkmale: Zahlen (Wert), Auswahl (Stufe als Index), Ja/Nein (1 für Ja, 0 für Nein)
    const attrs = settings.attributes.map(a => {
      const relevant = P.map(p => p.options.some(o => o.values[a.id] !== undefined));
      /** @param {AttributeValue | undefined} v @returns {number | null} */
      const num = v => {
        if (v === undefined) return null;
        if (a.type === 'choice') { const k = a.levels.findIndex(l => l.id === v); return k < 0 ? null : k; }
        if (a.type === 'bool') return v === true ? 1 : 0;
        return typeof v === 'number' ? v : null;
      };
      const vals = P.map(p => p.options.map(o => num(o.values[a.id])));
      /** @type {Measure['agg'] | null} */
      let agg = null;
      if (a.type === 'int' || a.type === 'decimal') agg = a.aggregate === 'none' ? null : /** @type {Measure['agg']} */ (a.aggregate);
      else if (a.type === 'choice') agg = a.aggregate === 'min' ? 'min' : 'max';
      else if (a.type === 'bool') agg = 'sum';
      return { a, relevant, measure: agg ? /** @type {Measure} */ ({ agg, vals }) : null, vals };
    });
    // Unverträgliche (bzw. bei `strict` auch bedingt verträgliche) Partner je Ausprägung
    /** @type {Map<string, Set<string>>} */
    const banned = new Map();
    for (const c of m.constraints) {
      if (c.type !== 'excluded' && !q.strict) continue;
      for (const [x, y] of [[c.a, c.b], [c.b, c.a]]) {
        if (!banned.has(x)) banned.set(x, new Set());
        /** @type {Set<string>} */ (banned.get(x)).add(y);
      }
    }
    // Kandidaten je Parameter (festgelegte Ausprägung bzw. alle)
    const cand = P.map(p => {
      const f = q.fixed[p.id];
      const idx = p.options.map((_, k) => k);
      return f && p.options.some(o => o.id === f) ? idx.filter(k => p.options[k].id === f) : idx;
    });
    return { P, W, weights, cost, utility, attrs, banned, cand };
  }

  /** Sortierschlüssel: Kennzahl und Richtung (`null` = Matrix-Reihenfolge). @param {ReturnType<typeof compile>} c @param {Matrix} m @param {string} key */
  function sortSpec(c, m, key) {
    if (key === 'utility' && m.settings.utility) return { kind: 'utility', desc: true };
    if (key === 'cost' && m.settings.costs) return { kind: 'cost', desc: false };
    if (key === 'priceValue' && m.settings.costs && m.settings.utility) return { kind: 'priceValue', desc: false };
    const match = /^attr:(.+):(asc|desc)$/.exec(key);
    const at = match ? c.attrs.findIndex(x => x.a.id === match[1] && x.measure) : -1;
    if (match && at >= 0) return { kind: 'attr', at, desc: match[2] === 'desc' };
    return null;
  }

  /**
   * Durchsucht den Lösungsraum.
   * @param {Matrix} m @param {SolutionQuery} q
   * @param {{ fullLimit?: number, budget?: number }} [opts] Grenzen (für Tests)
   * @returns {SolutionResult}
   */
  function search(m, q, opts = {}) {
    const c = compile(m, q);
    const { P, cand } = c;
    const n = P.length;
    if (!n || cand.some(x => !x.length)) return { rows: [], matched: 0, exhaustive: true, complete: true };
    const spec = sortSpec(c, m, q.sort);
    const space = cand.reduce((s, x) => s * x.length, 1);
    const exhaustive = space <= (opts.fullLimit ?? FULL_LIMIT);
    const limit = exhaustive ? Math.max(1, q.limit) : Math.min(Math.max(1, q.limit), BIG_LIMIT);
    let budget = opts.budget ?? NODE_BUDGET;

    // Kennzahlen, die laufend mitgeführt werden: Kosten, Nutzwert, Merkmale mit Zusammenfassung
    /** @type {Measure[]} */
    const measures = [c.cost, c.utility, ...c.attrs.map(x => x.measure || { agg: /** @type {const} */ ('sum'), vals: P.map(p => p.options.map(() => null)) })];
    const M = measures.length;
    // Günstigste Restbeiträge ab Parameter i (für Schranken): Minimum und Maximum je Kennzahl
    const restMin = measures.map(ms => restBound(ms, cand, Math.min));
    const restMax = measures.map(ms => restBound(ms, cand, Math.max));

    const sum = new Float64Array(M);
    const cnt = new Int32Array(M);
    const lo = new Float64Array(M).fill(Infinity);
    const hi = new Float64Array(M).fill(-Infinity);
    const pick = new Int32Array(n);
    const costMissing = new Int32Array(n + 1);
    const utilMissing = new Int32Array(n + 1);

    /** @typedef {{ row: SolutionRow, key: number | null, pos: Int32Array }} Hit */
    /** @type {Hit[]} */
    const best = [];
    let matched = 0;
    let aborted = false;

    /** Matrix-Reihenfolge: lexikografisch nach den Positionen der Ausprägungen. @param {Int32Array} a @param {Int32Array} b */
    const earlier = (a, b) => {
      for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i];
      return false;
    };
    /** Ist Treffer x besser als y? (Gleichstand: Matrix-Reihenfolge) @param {Hit} x @param {Hit} y */
    const better = (x, y) => {
      if (!spec) return earlier(x.pos, y.pos);
      if (x.key == null || y.key == null) return x.key != null || (y.key == null && earlier(x.pos, y.pos));
      if (x.key !== y.key) return spec.desc ? x.key > y.key : x.key < y.key;
      return earlier(x.pos, y.pos);
    };

    /**
     * Endwert einer Kennzahl für die gewählte Kombination – frisch gerechnet, damit Rundungsfehler
     * der laufenden Summen weder Filter noch Gleichstände verfälschen. @param {number} k
     */
    const final = k => {
      const ms = measures[k];
      let s = 0;
      let count = 0;
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = ms.vals[i][pick[i]];
        if (v == null) continue;
        s += v; count++;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      if (!count) return null;
      if (ms.agg === 'sum') return s;
      if (ms.agg === 'max') return mx;
      if (ms.agg === 'min') return mn;
      return s / count;
    };
    /** Toleranz für Schranken aus laufenden Summen. */
    const EPS = 1e-9;

    /** Günstigster erreichbarer Endwert einer Kennzahl ab Parameter i (für Schranken). @param {number} k @param {number} i @param {boolean} wantHigh */
    const optimistic = (k, i, wantHigh) => {
      const ms = measures[k];
      if (ms.agg === 'sum') return sum[k] + (wantHigh ? restMax[k][i] : restMin[k][i]);
      // Maximum wächst nur, Minimum fällt nur; ohne bisherigen Wert ist alles offen (auch „kein Wert“)
      if (ms.agg === 'max') return wantHigh ? Math.max(hi[k], restMax[k][i]) : (cnt[k] ? hi[k] : -Infinity);
      if (ms.agg === 'min') return wantHigh ? (cnt[k] ? lo[k] : Infinity) : Math.min(lo[k], restMin[k][i]);
      return wantHigh ? Infinity : -Infinity; // Mittelwert: keine Schranke
    };

    /** Verletzt der Teilstand ab Parameter i sicher einen Filter? @param {number} i */
    function violates(i) {
      if (q.maxCost != null && sum[0] + restMin[0][i] > q.maxCost + EPS) return true;
      if (q.minUtility != null && m.settings.utility && (sum[1] + restMax[1][i]) / c.W < q.minUtility - EPS) return true;
      if (!q.limits) return false;
      for (let t = 0; t < c.attrs.length; t++) {
        const { a, measure } = c.attrs[t];
        const l = a.limit;
        if (!l || !measure) continue;
        const k = t + 2;
        if (l.op === 'above' && measure.agg !== 'avg' && optimistic(k, i, false) > l.value + EPS) return true;
        if (l.op === 'below' && measure.agg !== 'avg' && optimistic(k, i, true) < l.value - EPS) return true;
      }
      return false;
    }

    /** Ist die gewählte Ausprägung allein schon ein Ausschlussgrund (Grenzen je Wert)? @param {number} i @param {number} k */
    function optionBreaksLimit(i, k) {
      for (const { a, vals, relevant } of c.attrs) {
        const l = a.limit;
        if (!l || !relevant[i]) continue;
        const v = vals[i][k];
        if (l.op === 'allYes' && v !== 1) return true;
        if (v == null) continue;
        if (l.op === 'level') {
          const at = a.levels.findIndex(x => x.id === l.value);
          if (at >= 0 && v >= at) return true;
        }
        // Ohne Zusammenfassung zählt jeder einzelne Wert
        if ((a.type === 'int' || a.type === 'decimal') && a.aggregate === 'none'
          && ((l.op === 'above' && v > l.value) || (l.op === 'below' && v < l.value))) return true;
      }
      return false;
    }

    /** Schließt eine Schranke den Zweig aus (Liste voll, kann nicht besser werden)? @param {number} i */
    function hopeless(i) {
      if (exhaustive || best.length < limit) return false;
      const worst = best[best.length - 1];
      // Matrix-Reihenfolge: nach den ersten `limit` Treffern kann nichts Früheres mehr kommen
      if (!spec) return true;
      if (worst.key == null) return false;
      let bound;
      if (spec.kind === 'utility') bound = optimistic(1, i, true) / c.W;
      else if (spec.kind === 'cost') bound = optimistic(0, i, false);
      else if (spec.kind === 'attr') bound = optimistic(/** @type {number} */ (spec.at) + 2, i, spec.desc);
      else {
        // Preis-Leistung: geringste Kosten durch höchsten Nutzwert (nur bei nicht negativen Kosten sicher)
        const costLow = optimistic(0, i, false);
        const utilHigh = optimistic(1, i, true) / c.W;
        if (costLow < 0 || !(utilHigh > 0)) return false;
        bound = costLow / utilHigh;
      }
      if (!Number.isFinite(bound)) return false;
      return spec.desc ? bound < worst.key - EPS : bound > worst.key + EPS;
    }

    function leaf() {
      // Ganze Kombination: Merkmal-Grenzen mit Mittelwert erst hier prüfbar
      if (q.limits) {
        for (let t = 0; t < c.attrs.length; t++) {
          const { a, measure } = c.attrs[t];
          const l = a.limit;
          if (!l || !measure || (l.op !== 'above' && l.op !== 'below')) continue;
          const v = final(t + 2);
          if (v != null && (l.op === 'above' ? v > l.value : v < l.value)) return;
        }
      }
      const costTotal = final(0) ?? 0;
      const utilSum = c.W > 0 ? (final(1) ?? 0) / c.W : 0;
      if (q.minUtility != null && m.settings.utility && utilSum < q.minUtility) return;
      if (q.maxCost != null && costTotal > q.maxCost) return;
      matched++;
      /** @type {Record<string, string>} */
      const selections = {};
      for (let i = 0; i < n; i++) selections[P[i].id] = P[i].options[pick[i]].id;
      const utilityValue = c.W > 0 ? utilSum : null;
      const cm = costMissing[n];
      const um = utilMissing[n];
      const pv = !cm && !um && utilityValue ? costTotal / utilityValue : null;
      /** @type {SolutionRow} */
      const row = { selections, cost: costTotal, costMissing: cm, utility: utilityValue, utilityMissing: um, priceValue: pv };
      let key = null;
      if (spec) {
        if (spec.kind === 'utility') key = utilityValue;
        else if (spec.kind === 'cost') key = cm ? null : costTotal;
        else if (spec.kind === 'priceValue') key = pv;
        else key = final(/** @type {number} */ (spec.at) + 2);
      }
      const hit = { row, key, pos: Int32Array.from(pick) };
      if (best.length >= limit && !better(hit, best[best.length - 1])) return;
      // Einsortieren (binäre Suche), Liste auf `limit` begrenzen
      let a = 0;
      let b = best.length;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (better(hit, best[mid])) b = mid; else a = mid + 1;
      }
      best.splice(a, 0, hit);
      if (best.length > limit) best.pop();
    }

    /** @param {number} i */
    function walk(i) {
      if (aborted) return;
      if (--budget < 0) { aborted = true; return; }
      if (i === n) { leaf(); return; }
      if (violates(i) || hopeless(i)) return;
      const p = P[i];
      for (const k of cand[i]) {
        const oid = p.options[k].id;
        // Verträglichkeit mit den bereits gewählten Ausprägungen
        const ban = c.banned.get(oid);
        if (ban) {
          let clash = false;
          for (let j = 0; j < i && !clash; j++) clash = ban.has(P[j].options[pick[j]].id);
          if (clash) continue;
        }
        if (q.limits && optionBreaksLimit(i, k)) continue;
        pick[i] = k;
        // Kennzahlen fortschreiben (und danach zurücksetzen)
        const saved = [];
        for (let t = 0; t < M; t++) {
          const v = measures[t].vals[i][k];
          saved.push(lo[t], hi[t]);
          if (v != null) { sum[t] += v; cnt[t]++; if (v < lo[t]) lo[t] = v; if (v > hi[t]) hi[t] = v; }
        }
        costMissing[i + 1] = costMissing[i] + (c.cost.vals[i][k] == null ? 1 : 0);
        utilMissing[i + 1] = utilMissing[i] + (c.utility.vals[i][k] == null && c.weights[i] > 0 ? 1 : 0);
        walk(i + 1);
        for (let t = 0; t < M; t++) {
          const v = measures[t].vals[i][k];
          if (v != null) { sum[t] -= v; cnt[t]--; }
          lo[t] = saved[2 * t];
          hi[t] = saved[2 * t + 1];
        }
        if (aborted) return;
      }
    }

    // Große Räume: je Parameter die nach der Sortierung vielversprechendsten Ausprägungen zuerst,
    // damit früh gute Treffer die Schranken verschärfen (Gleichstände entscheidet `pos`)
    if (!exhaustive && spec) {
      const k = spec.kind === 'cost' ? 0 : spec.kind === 'attr' ? /** @type {number} */ (spec.at) + 2 : 1;
      const desc = spec.kind === 'cost' ? false : spec.kind === 'attr' ? spec.desc : true;
      cand.forEach((list, i) => list.sort((x, y) => {
        const vx = measures[k].vals[i][x] ?? 0;
        const vy = measures[k].vals[i][y] ?? 0;
        return (desc ? vy - vx : vx - vy) || x - y;
      }));
    }
    walk(0);
    return {
      rows: best.map(x => x.row),
      matched: exhaustive && !aborted ? matched : null,
      exhaustive: exhaustive && !aborted,
      complete: !aborted,
    };
  }

  /**
   * Summe der günstigsten Beiträge (bzw. bei Max/Min der Extremwert) der Parameter ab i.
   * Fehlende Werte zählen wie 0 (Summe) bzw. gar nicht (Max/Min).
   * @param {Measure} ms @param {number[][]} cand @param {(...v: number[]) => number} pickFn Math.min oder Math.max
   */
  function restBound(ms, cand, pickFn) {
    const n = cand.length;
    const out = new Float64Array(n + 1);
    const isSum = ms.agg === 'sum' || ms.agg === 'avg';
    out[n] = isSum ? 0 : (pickFn === Math.max ? -Infinity : Infinity);
    for (let i = n - 1; i >= 0; i--) {
      const vals = cand[i].map(k => ms.vals[i][k]);
      if (isSum) out[i] = out[i + 1] + pickFn(...vals.map(v => v ?? 0));
      else {
        const present = /** @type {number[]} */ (vals.filter(v => v != null));
        out[i] = present.length ? pickFn(out[i + 1], ...present) : out[i + 1];
      }
    }
    return out;
  }

  return { search, FULL_LIMIT, BIG_LIMIT };
})();
