/*
 * Consistency – Verträglichkeiten zwischen Ausprägungen (Konsistenzprüfung nach Zwicky/Ritchey).
 * Ein Paar aus zwei Ausprägungen verschiedener Parameter ist „unverträglich“ (excluded) oder
 * „bedingt verträglich“ (conditional); alle übrigen Paare gelten als verträglich.
 * Reine Funktionen ohne DOM. Exportiert den Namensraum `Consistency`.
 *
 * Gespeichert wird `m.constraints` – je Paar ein Eintrag mit `a < b` (Zeichenkettenvergleich).
 */
import { Counting } from './counting.js';
import { lexLess } from './lex.js';

export const Consistency = (() => {
  /** @type {MatrixConstraintType[]} */
  const TYPES = ['excluded', 'conditional'];

  /** Schlüssel eines Paars (unabhängig von der Reihenfolge). @param {string} a @param {string} b */
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  /**
   * Verzeichnis Paar → Eintrag je Liste. Einträge werden nur angehängt (`push`) oder die Liste
   * wird ersetzt (Löschen, Rückgängig, Laden) – die Länge genügt daher als Merkmal für „veraltet“;
   * Änderungen an einem Eintrag (Art, Begründung) sieht das Verzeichnis direkt.
   * @type {WeakMap<MatrixConstraint[], { length: number, map: Map<string, MatrixConstraint> }>}
   */
  const indexes = new WeakMap();

  /** @param {Matrix} m */
  function indexOf(m) {
    let idx = indexes.get(m.constraints);
    if (!idx || idx.length !== m.constraints.length) {
      idx = { length: m.constraints.length, map: new Map(m.constraints.map(c => [key(c.a, c.b), c])) };
      indexes.set(m.constraints, idx);
    }
    return idx.map;
  }

  /** Verträglichkeit eines Paars oder `null` (verträglich). @param {Matrix} m @param {string} a @param {string} b */
  function get(m, a, b) {
    return indexOf(m).get(key(a, b)) || null;
  }

  /** Paare je Ausprägung. @param {Matrix} m @returns {Map<string, Array<{ c: MatrixConstraint, other: string }>>} */
  function partners(m) {
    const map = new Map();
    const add = (/** @type {string} */ id, /** @type {MatrixConstraint} */ c, /** @type {string} */ other) => {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push({ c, other });
    };
    for (const c of m.constraints) { add(c.a, c, c.b); add(c.b, c, c.a); }
    return map;
  }

  /** Anzahl unverträglicher bzw. bedingter Paare einer Ausprägung. @param {Matrix} m @param {string} oid */
  function countFor(m, oid) {
    const n = { excluded: 0, conditional: 0 };
    for (const c of m.constraints) if (c.a === oid || c.b === oid) n[c.type]++;
    return n;
  }

  /**
   * Konflikte eines Konzepts: Paare, deren beide Ausprägungen gewählt sind.
   * @param {Matrix} m @param {MatrixConcept} concept
   * @returns {{ excluded: MatrixConstraint[], conditional: MatrixConstraint[] }}
   */
  function conflicts(m, concept) {
    const chosen = new Set(Object.values(concept.selections));
    const result = { excluded: /** @type {MatrixConstraint[]} */ ([]), conditional: /** @type {MatrixConstraint[]} */ ([]) };
    for (const c of m.constraints) if (chosen.has(c.a) && chosen.has(c.b)) result[c.type].push(c);
    return result;
  }

  /**
   * Wie passt jede Ausprägung zur Auswahl eines Konzepts? Für Ausprägungen, die mit einer
   * gewählten (eines anderen Parameters) ein Paar bilden – unverträglich geht vor bedingt.
   * @param {Matrix} m @param {MatrixConcept | null} concept
   * @returns {Map<string, { type: MatrixConstraintType, with: string, note: string }>}
   */
  function statusFor(m, concept) {
    const map = new Map();
    if (!concept) return map;
    const chosen = new Set(Object.values(concept.selections));
    for (const c of m.constraints) {
      for (const [mine, other] of [[c.a, c.b], [c.b, c.a]]) {
        if (!chosen.has(mine)) continue;
        const prev = map.get(other);
        if (!prev || (prev.type === 'conditional' && c.type === 'excluded')) map.set(other, { type: c.type, with: mine, note: c.note });
      }
    }
    return map;
  }

  const { exclusions, countConsistent, countSignature } = Counting;

  /**
   * Beste Kombination nach einem Schlüssel je Ausprägung (Summe, lexikografisch kleiner = besser),
   * ohne unverträgliche Paare. Je Parameter kommen nur die `candidates` in Frage; lässt sich ein
   * Parameter nicht verträglich belegen, bleibt er leer (mit hoher Strafe im Schlüssel).
   * Verzweigen und Begrenzen; bei sehr vielen Schritten gilt die beste bisher gefundene Lösung.
   * @param {Matrix} m
   * @param {(p: MatrixParameter) => MatrixOption[]} candidates
   * @param {(p: MatrixParameter, o: MatrixOption) => number[]} keyOf
   * @param {number} [budget] höchste Zahl untersuchter Teillösungen
   * @returns {{ selections: Record<string, string>, empty: number }}
   */
  function optimize(m, candidates, keyOf, budget = 200000) {
    const P = m.parameters;
    const excludedWith = exclusions(m);
    // Fehlende Werte (Infinity) und leere Parameter als große, aber vergleichbare Zahlen
    const BIG = 1e12;
    const finite = (/** @type {number[]} */ k) => k.map(v => (Number.isFinite(v) ? v : BIG / 1000));
    const lists = P.map(p => candidates(p).map(o => ({ o, k: finite(keyOf(p, o)) }))
      .sort((x, y) => (lexLess(x.k, y.k) ? -1 : lexLess(y.k, x.k) ? 1 : 0)));
    const width = Math.max(1, ...lists.flatMap(l => l.map(x => x.k.length)));
    const zero = () => new Array(width).fill(0);
    const add = (/** @type {number[]} */ a, /** @type {number[]} */ b) => a.map((v, i) => v + (b[i] || 0));
    const emptyKey = new Array(width).fill(BIG);
    // Untere Schranke für die restlichen Parameter (ohne Verträglichkeiten)
    const rest = new Array(P.length + 1).fill(null).map(zero);
    for (let i = P.length - 1; i >= 0; i--) rest[i] = add(rest[i + 1], lists[i].length ? lists[i][0].k : zero());

    /** @type {(MatrixOption | null)[]} */
    const chosen = [];
    /** @type {(MatrixOption | null)[] | null} */
    let best = null;
    let bestKey = /** @type {number[] | null} */ (null);
    let steps = 0;
    const compatible = (/** @type {MatrixOption} */ o) => {
      const ex = excludedWith.get(o.id);
      return !ex || !chosen.some(c => c && ex.has(c.id));
    };
    const search = (/** @type {number} */ i, /** @type {number[]} */ acc) => {
      if (steps++ > budget && best) return;
      if (bestKey && !lexLess(add(acc, rest[i]), bestKey)) return;
      if (i === P.length) { best = [...chosen]; bestKey = acc; return; }
      let any = false;
      for (const { o, k } of lists[i]) {
        if (!compatible(o)) continue;
        any = true;
        chosen.push(o);
        search(i + 1, add(acc, k));
        chosen.pop();
      }
      // Ohne passende Kandidaten (oder alle unverträglich) bleibt der Parameter leer
      if (!lists[i].length || !any) {
        chosen.push(null);
        search(i + 1, add(acc, lists[i].length ? emptyKey : zero()));
        chosen.pop();
      }
    };
    search(0, zero());
    /** @type {Record<string, string>} */
    const selections = {};
    let empty = 0;
    (/** @type {(MatrixOption | null)[]} */ (best || [])).forEach((o, i) => {
      if (o) selections[P[i].id] = o.id;
      else empty++;
    });
    return { selections, empty };
  }

  /**
   * Zufällige verträgliche Kombination (je Parameter mit Ausprägungen eine). Geht bei einer
   * Sackgasse zurück; gelingt es nicht, bleiben Parameter ohne verträgliche Ausprägung leer.
   * @param {Matrix} m @param {() => number} random
   * @returns {Record<string, string>}
   */
  function randomCombination(m, random) {
    const order = (/** @type {MatrixOption[]} */ list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const P = m.parameters.filter(p => p.options.length);
    const lists = P.map(p => order(p.options));
    const excluded = new Set(m.constraints.filter(c => c.type === 'excluded').map(c => key(c.a, c.b)));
    /** @type {MatrixOption[]} */
    const chosen = [];
    let steps = 0;
    const search = (/** @type {number} */ i) => {
      if (i === P.length) return true;
      if (steps++ > 20000) return false;
      for (const o of lists[i]) {
        if (chosen.some(c => excluded.has(key(c.id, o.id)))) continue;
        chosen.push(o);
        if (search(i + 1)) return true;
        chosen.pop();
      }
      return false;
    };
    /** @type {Record<string, string>} */
    const selections = {};
    if (search(0)) {
      P.forEach((p, i) => { selections[p.id] = chosen[i].id; });
      return selections;
    }
    // Rückfall: der Reihe nach wählen, was zum bisher Gewählten passt
    const picked = /** @type {MatrixOption[]} */ ([]);
    P.forEach((p, i) => {
      const o = lists[i].find(x => !picked.some(c => excluded.has(key(c.id, x.id))));
      if (o) { picked.push(o); selections[p.id] = o.id; }
    });
    return selections;
  }

  return { TYPES, key, get, partners, countFor, conflicts, statusFor, countConsistent, countSignature, optimize, randomCombination };
})();
