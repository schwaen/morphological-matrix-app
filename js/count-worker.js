/*
 * Web Worker: zählt die widerspruchsfreien Kombinationen (Consistency.countConsistent)
 * außerhalb der Oberfläche, damit große Matrizen die Bedienung nicht blockieren.
 * Nachricht hin: { id, matrix } – zurück: { id, value } (BigInt oder null).
 */
import { Consistency } from './consistency.js';

self.onmessage = (/** @type {MessageEvent<{ id: number, matrix: Matrix }>} */ e) => {
  const { id, matrix } = e.data;
  self.postMessage({ id, value: Consistency.countConsistent(matrix) });
};
