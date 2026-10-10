/*
 * Web Worker: zählt die widerspruchsfreien Kombinationen (js/counting.js)
 * außerhalb der Oberfläche, damit große Matrizen die Bedienung nicht blockieren.
 * Nachricht hin: { id, kind, matrix, fixed } – zurück: { id, kind, value }.
 * `kind`: 'count' (Gesamtzahl: BigInt oder null) bzw. 'remaining' (Restzahlen zur Auswahl `fixed`).
 */
import { Counting } from './counting.js';

self.onmessage = (/** @type {MessageEvent<{ id: number, kind: 'count' | 'remaining', matrix: Matrix, fixed: Record<string, string> }>} */ e) => {
  const { id, kind, matrix, fixed } = e.data;
  const value = kind === 'remaining' ? Counting.remaining(matrix, fixed) : Counting.countConsistent(matrix);
  self.postMessage({ id, kind, value });
};
