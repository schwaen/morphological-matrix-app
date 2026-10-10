/*
 * Web Worker: durchsucht den Lösungsraum (js/solutions.js), ohne die Oberfläche zu blockieren.
 * Nachricht hin: { id, matrix, query } – zurück: { id, result }.
 */
import { Solutions } from './solutions.js';

self.onmessage = (/** @type {MessageEvent<{ id: number, matrix: Matrix, query: import('./solutions.js').SolutionQuery }>} */ e) => {
  const { id, matrix, query } = e.data;
  self.postMessage({ id, result: Solutions.search(matrix, query) });
};
