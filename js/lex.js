/*
 * Lexikografischer Vergleich – eigenes Modul ohne Abhängigkeiten (für js/counting.js im Web Worker).
 */

/** Lexikografischer Vergleich zweier gleich langer Schlüssel. @param {number[]} a @param {number[]} b */
export function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}
