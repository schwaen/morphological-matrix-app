/*
 * Zählungen für die Anzeige – im Web Worker (js/count-worker.js): die Zahl der
 * widerspruchsfreien Kombinationen und die Restzahlen beim Kombinieren. Bis ein Ergebnis da
 * ist, gilt der zuletzt bekannte Wert. Ergebnisse sind Signale: Komponenten, die sie anzeigen,
 * zeichnen neu, sobald sie ankommen.
 */
import { signal } from '@preact/signals';
import { Consistency } from '../consistency.js';

/** @typedef {'count' | 'remaining'} CountKind */
/** @typedef {{ total: bigint, options: Map<string, bigint> } | null} Remaining */

/**
 * Je Art: zuletzt bekanntes Ergebnis (Signatur und Wert) und laufende Anfrage.
 * @type {Record<CountKind, { known: import('@preact/signals').Signal<{ sig: string, value: any }>, asked: { sig: string, id: number } }>}
 */
const slots = {
  count: { known: signal({ sig: '', value: undefined }), asked: { sig: '', id: 0 } },
  remaining: { known: signal({ sig: '', value: undefined }), asked: { sig: '', id: 0 } },
};
/** @type {Worker | null} */
let worker = null;

function startWorker() {
  if (worker || typeof Worker !== 'function') return worker;
  try {
    worker = new Worker(new URL('../count-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (/** @type {MessageEvent<{ id: number, kind: CountKind, value: any }>} */ e) => {
      const slot = slots[e.data.kind];
      if (e.data.id !== slot.asked.id) return; // veraltete Antwort
      slot.known.value = { sig: slot.asked.sig, value: e.data.value };
    };
  } catch (e) {
    worker = null;
  }
  return worker;
}

/**
 * Ergebnis einer Zählung zur Signatur `sig`: bekannt, sonst beim Worker angefragt (bzw. ohne
 * Worker direkt berechnet). @param {CountKind} kind @param {string} sig @param {Matrix} m
 * @param {Record<string, string>} fixed @param {() => any} direct Berechnung ohne Worker
 */
function request(kind, sig, m, fixed, direct) {
  const slot = slots[kind];
  const last = slot.known.value;
  if (sig === last.sig) return { value: last.value, pending: false };
  const w = startWorker();
  if (!w) {
    const value = direct();
    slot.known.value = { sig, value };
    return { value, pending: false };
  }
  if (sig !== slot.asked.sig) {
    slot.asked = { sig, id: slot.asked.id + 1 };
    // Nur, was die Zählung braucht
    const matrix = { parameters: m.parameters.map(p => ({ id: p.id, options: p.options.map(o => ({ id: o.id })) })), constraints: m.constraints };
    w.postMessage({ id: slot.asked.id, kind, matrix, fixed });
  }
  return { value: last.value, pending: true };
}

/**
 * Zahl der widerspruchsfreien Kombinationen (`null` = zu aufwendig zu zählen,
 * `undefined` = noch unbekannt). `pending`: das Ergebnis für den aktuellen Stand steht noch aus.
 * @param {Matrix} m @returns {{ value: bigint | null | undefined, pending: boolean }}
 */
export function consistentCount(m) {
  return request('count', Consistency.countSignature(m), m, {}, () => Consistency.countConsistent(m));
}

/**
 * Restzahlen zur Auswahl eines Konzepts (ohne Konzept: zu keiner Auswahl) – nur, wenn es
 * unverträgliche Paare gibt; sonst wären alle Zahlen eines Parameters gleich und ohne Aussage.
 * `null`: nicht anzeigen (keine Paare, zu aufwendig oder noch unbekannt).
 * @param {Matrix} m @param {MatrixConcept | null} concept @returns {Remaining}
 */
export function restCounts(m, concept) {
  if (!m.constraints.some(c => c.type === 'excluded')) return null;
  return remainingCounts(m, concept ? concept.selections : {}).value ?? null;
}

/**
 * Restzahlen zur Auswahl `fixed` (siehe `Counting.remaining`; `null` = zu aufwendig,
 * `undefined` = noch unbekannt). Solange das Ergebnis aussteht, gilt das letzte – auch wenn es
 * zu einer anderen Auswahl gehört; `pending` zeigt das an.
 * @param {Matrix} m @param {Record<string, string>} fixed
 * @returns {{ value: Remaining | undefined, pending: boolean }}
 */
export function remainingCounts(m, fixed) {
  const sel = Object.keys(fixed).sort().map(k => `${k}=${fixed[k]}`).join(',');
  return request('remaining', `${Consistency.countSignature(m)}@${sel}`, m, fixed, () => Consistency.remaining(m, fixed));
}
