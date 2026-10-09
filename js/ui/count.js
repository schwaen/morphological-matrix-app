/*
 * Zahl der widerspruchsfreien Kombinationen für die Anzeige – gezählt im Web Worker
 * (js/count-worker.js). Bis das Ergebnis da ist, gilt der zuletzt bekannte Wert. Das Ergebnis
 * ist ein Signal: Komponenten, die es anzeigen, zeichnen neu, sobald es ankommt.
 */
import { signal } from '@preact/signals';
import { Consistency } from '../consistency.js';

/** Zuletzt gezähltes Ergebnis. */
const known = signal(/** @type {{ sig: string, value: bigint | null | undefined }} */ ({ sig: '', value: undefined }));
/** Signatur und Nummer der laufenden Anfrage */
let asked = { sig: '', id: 0 };
/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {Worker | null} */
let worker = null;

function startWorker() {
  if (worker || typeof Worker !== 'function') return worker;
  try {
    worker = new Worker(new URL('../count-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (/** @type {MessageEvent<{ id: number, value: bigint | null }>} */ e) => {
      if (e.data.id !== asked.id) return; // veraltete Antwort
      known.value = { sig: asked.sig, value: e.data.value };
      listeners.forEach(fn => fn());
    };
  } catch (e) {
    worker = null;
  }
  return worker;
}

/**
 * Zahl der widerspruchsfreien Kombinationen (`null` = zu aufwendig zu zählen,
 * `undefined` = noch unbekannt). `pending`: das Ergebnis für den aktuellen Stand steht noch aus.
 * @param {Matrix} m @returns {{ value: bigint | null | undefined, pending: boolean }}
 */
export function consistentCount(m) {
  const sig = Consistency.countSignature(m);
  const last = known.value;
  if (sig === last.sig) return { value: last.value, pending: false };
  const w = startWorker();
  if (!w) {
    // Ohne Worker wie früher direkt zählen
    const value = Consistency.countConsistent(m);
    known.value = { sig, value };
    return { value, pending: false };
  }
  if (sig !== asked.sig) {
    asked = { sig, id: asked.id + 1 };
    // Nur, was die Zählung braucht
    const matrix = { parameters: m.parameters.map(p => ({ id: p.id, options: p.options.map(o => ({ id: o.id })) })), constraints: m.constraints };
    w.postMessage({ id: asked.id, matrix });
  }
  return { value: last.value, pending: true };
}

/** Anzeige anmelden, die nach jedem neuen Ergebnis aktualisiert wird. @param {() => void} fn */
export function onCountReady(fn) {
  listeners.add(fn);
}
