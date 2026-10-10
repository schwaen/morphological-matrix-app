/*
 * Counting – Zahl der widerspruchsfreien Kombinationen (ohne unverträgliches Paar). Ohne
 * Abhängigkeiten zu Texten oder Modell, damit der Web Worker (js/count-worker.js) klein bleibt;
 * die übrigen Module nutzen die Funktionen über `Consistency`.
 */
import { lexLess } from './lex.js';

/** Unverträgliche Partner je Ausprägung. @param {Matrix} m */
function exclusions(m) {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const c of m.constraints) {
    if (c.type !== 'excluded') continue;
    for (const [x, y] of [[c.a, c.b], [c.b, c.a]]) {
      if (!map.has(x)) map.set(x, new Set());
      /** @type {Set<string>} */ (map.get(x)).add(y);
    }
  }
  return map;
}

/** Zuletzt berechnete Anzahl samt Struktur-Signatur (Texte ändern die Anzahl nicht). */
let countCache = { sig: '', value: /** @type {bigint | null} */ (null) };

/**
 * Anzahl der Kombinationen (je Parameter genau eine Ausprägung) ohne unverträgliches Paar;
 * `null`, wenn die Zählung zu aufwendig wird (mehr als `limit` Zwischenstände).
 *
 * Vorgehen: Parameter ohne Unverträglichkeiten gehen nur als Faktor ein; die übrigen zerfallen
 * in unabhängige Gruppen (verbunden über Paare), die einzeln gezählt und multipliziert werden.
 * Je Gruppe zählt eine dynamische Programmierung über die Parameter; Zwischenstand sind die
 * gewählten Ausprägungen, die noch Paare mit späteren Parametern haben. Die Reihenfolge wird
 * so gewählt, dass möglichst wenige Parameter gleichzeitig „offen“ sind; Ausprägungen ohne
 * Paare werden zu einem Faktor zusammengefasst.
 * @param {Matrix} m @param {number} [limit]
 * @returns {bigint | null}
 */
function countConsistent(m, limit = 20000) {
  const ex = exclusions(m);
  const sig = signature(m, ex, limit);
  if (countCache.sig === sig) return countCache.value;
  const value = countUncached(m.parameters, ex, limit);
  countCache = { sig, value };
  return value;
}

/**
 * Alles, wovon die Zählung abhängt (Ausprägungen und unverträgliche Paare) – gleiche
 * Signatur, gleiches Ergebnis. @param {Matrix} m @param {Map<string, Set<string>>} ex @param {number} limit
 */
const signature = (m, ex, limit) => `${limit}#${m.parameters.map(p => `${p.id}:${p.options.map(o => o.id).join(',')}`).join('|')}#${[...ex.keys()].sort().map(k => `${k}>${[.../** @type {Set<string>} */ (ex.get(k))].sort().join(',')}`).join(';')}`;

/** Signatur der Zählung (für Zwischenspeicher außerhalb, z. B. im Web Worker). @param {Matrix} m @param {number} [limit] */
const countSignature = (m, limit = 20000) => signature(m, exclusions(m), limit);

/**
 * @param {MatrixParameter[]} P @param {Map<string, Set<string>>} ex @param {number} limit
 * @returns {bigint | null}
 */
function countUncached(P, ex, limit) {
  if (!P.length || P.some(p => !p.options.length)) return 0n;
  /** Ausprägungs-ID → Parameter-ID */
  const owner = new Map(P.flatMap(p => p.options.map(o => [o.id, p.id])));
  // Parameter-Graph: Kante, wenn es ein unverträgliches Paar zwischen zwei Parametern gibt
  /** @type {Map<string, Set<string>>} */
  const adj = new Map(P.map(p => [p.id, new Set()]));
  for (const [x, ys] of ex) {
    for (const y of ys) {
      /** @type {Set<string>} */ (adj.get(/** @type {string} */ (owner.get(x)))).add(/** @type {string} */ (owner.get(y)));
    }
  }
  const byId = new Map(P.map(p => [p.id, p]));
  const seen = new Set();
  let total = 1n;
  for (const p of P) {
    if (seen.has(p.id)) continue;
    // Zusammenhängende Gruppe einsammeln
    const comp = [];
    const stack = [p.id];
    seen.add(p.id);
    while (stack.length) {
      const id = /** @type {string} */ (stack.pop());
      comp.push(id);
      for (const n of /** @type {Set<string>} */ (adj.get(id))) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    if (comp.length === 1) {
      total *= BigInt(p.options.length);
      continue;
    }
    const order = orderParams(comp, adj).map(id => /** @type {MatrixParameter} */ (byId.get(id)));
    const part = countGroup(order, ex, owner, limit);
    if (part == null) return null;
    total *= part;
  }
  return total;
}

/**
 * Reihenfolge einer Gruppe: jeweils der Parameter, nach dem am wenigsten bearbeitete Parameter
 * noch Kanten zu unbearbeiteten haben (bei Gleichstand: meiste Kanten zu bearbeiteten).
 * @param {string[]} comp @param {Map<string, Set<string>>} adj
 */
function orderParams(comp, adj) {
  const nb = (/** @type {string} */ id) => /** @type {Set<string>} */ (adj.get(id));
  const done = new Set();
  const order = [];
  let first = comp[0];
  for (const id of comp) if (nb(id).size > nb(first).size) first = id;
  order.push(first);
  done.add(first);
  while (order.length < comp.length) {
    let best = null;
    let bestScore = [Infinity, Infinity];
    for (const id of comp) {
      if (done.has(id)) continue;
      done.add(id);
      let open = 0;
      for (const d of done) if ([...nb(d)].some(n => !done.has(n))) open++;
      done.delete(id);
      const score = [open, -[...nb(id)].filter(n => done.has(n)).length];
      if (lexLess(score, bestScore)) { best = id; bestScore = score; }
    }
    order.push(/** @type {string} */ (best));
    done.add(/** @type {string} */ (best));
  }
  return order;
}

/**
 * Zählt eine Gruppe in der gegebenen Reihenfolge; `null` bei mehr als `limit` Zwischenständen.
 * @param {MatrixParameter[]} order @param {Map<string, Set<string>>} ex
 * @param {Map<string, string>} owner @param {number} limit
 * @returns {bigint | null}
 */
function countGroup(order, ex, owner, limit) {
  const pos = new Map(order.map((p, i) => [p.id, i]));
  /** Spätester Parameter (Position), mit dem eine Ausprägung ein Paar hat. */
  const last = (/** @type {string} */ oid) => {
    let max = -1;
    for (const y of ex.get(oid) || []) max = Math.max(max, pos.get(/** @type {string} */ (owner.get(y))) ?? -1);
    return max;
  };
  /** @type {Map<string, bigint>} Zwischenstand (sortierte IDs, mit „,“ verbunden) → Anzahl */
  let states = new Map([['', 1n]]);
  for (const [i, p] of order.entries()) {
    // Ausprägungen ohne Paare verhalten sich gleich: ein gemeinsamer Faktor
    const free = BigInt(p.options.filter(o => !ex.has(o.id)).length);
    const bound = p.options.filter(o => ex.has(o.id)).map(o => ({ id: o.id, last: last(o.id), ex: /** @type {Set<string>} */ (ex.get(o.id)) }));
    /** @type {Map<string, bigint>} */
    const next = new Map();
    const add = (/** @type {string} */ k, /** @type {bigint} */ v) => next.set(k, (next.get(k) || 0n) + v);
    for (const [state, count] of states) {
      const held = state ? state.split(',') : [];
      const keep = held.filter(h => last(h) > i);
      if (free) add(keep.join(','), count * free);
      for (const o of bound) {
        if (held.some(h => o.ex.has(h))) continue;
        add((o.last > i ? [...keep, o.id].sort() : keep).join(','), count);
      }
    }
    if (next.size > limit) return null;
    states = next;
  }
  let total = 0n;
  for (const v of states.values()) total += v;
  return total;
}

/**
 * Restzahlen beim Kombinieren: Zahl der widerspruchsfreien Kombinationen, die die feste Auswahl
 * `fixed` (Parameter-ID → Ausprägungs-ID) enthalten (`total`), und je Ausprägung die Zahl, wenn
 * man bei ihrem Parameter sie statt der dortigen Auswahl nimmt (`options`); die Auswahl der
 * übrigen Parameter bleibt dabei fest. `null`, wenn eine Zählung zu aufwendig wird.
 * @param {Matrix} m @param {Record<string, string>} fixed @param {number} [limit]
 * @returns {{ total: bigint, options: Map<string, bigint> } | null}
 */
function remaining(m, fixed, limit = 20000) {
  const ex = exclusions(m);
  /** Zählung mit festgelegten Parametern (Paare zu weggefallenen Ausprägungen entfallen). @param {Record<string, string>} fx */
  const countWith = fx => {
    const P = m.parameters.map(p => (fx[p.id] ? { ...p, options: p.options.filter(o => o.id === fx[p.id]) } : p));
    const ids = new Set(P.flatMap(p => p.options.map(o => o.id)));
    /** @type {Map<string, Set<string>>} */
    const ex2 = new Map();
    for (const [x, ys] of ex) {
      if (!ids.has(x)) continue;
      const keep = [...ys].filter(y => ids.has(y));
      if (keep.length) ex2.set(x, new Set(keep));
    }
    return countUncached(P, ex2, limit);
  };
  // Nur Auswahlen, die es noch gibt
  /** @type {Record<string, string>} */
  const base = {};
  for (const p of m.parameters) if (p.options.some(o => o.id === fixed[p.id])) base[p.id] = fixed[p.id];
  const total = countWith(base);
  if (total == null) return null;
  /** @type {Map<string, bigint>} */
  const options = new Map();
  for (const p of m.parameters) {
    for (const o of p.options) {
      const n = base[p.id] === o.id ? total : countWith({ ...base, [p.id]: o.id });
      if (n == null) return null;
      options.set(o.id, n);
    }
  }
  return { total, options };
}

/** Namensraum der Zählung (über `Consistency` auch für die übrigen Module). */
export const Counting = { exclusions, countConsistent, countSignature, remaining };
