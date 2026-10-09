/*
 * Web Worker: zählt die widerspruchsfreien Kombinationen (js/counting.js)
 * außerhalb der Oberfläche, damit große Matrizen die Bedienung nicht blockieren.
 * Nachricht hin: { id, matrix } – zurück: { id, value } (BigInt oder null).
 */
import { Counting } from './counting.js';

self.onmessage = (/** @type {MessageEvent<{ id: number, matrix: Matrix }>} */ e) => {
  const { id, matrix } = e.data;
  self.postMessage({ id, value: Counting.countConsistent(matrix) });
};
