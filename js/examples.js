/*
 * Examples – mitgelieferte Beispiele.
 * Jedes Beispiel steht als JSON-Datei unter examples/ und wird hier (IDS) in der Reihenfolge
 * der Auswahl eingetragen. Das erste Beispiel (Start ohne gespeicherte Matrizen) ist fest
 * eingebunden; alle übrigen lädt der Browser erst, wenn die Auswahl geöffnet wird.
 */
import { Model } from './model.js';
import first from '../examples/kaffeemaschine.json' with { type: 'json' };

/** Beispiele in der Reihenfolge der Auswahl (id = Dateiname unter examples/ ohne .json). */
const IDS = ['kaffeemaschine', 'skill-matrix-frontend', 'firmen-event', 'lastenrad', 'food-truck', 'krimi'];

/**
 * Beispiel-Datei laden. Vite liefert die Dateien als eigene Assets aus (`new URL` mit
 * `import.meta.url`); das erste Beispiel ist fest eingebunden.
 * @param {string} id @returns {Promise<ExampleDef>}
 */
async function fetchExample(id) {
  if (id === first.id) return /** @type {ExampleDef} */ (first);
  const res = await fetch(new URL(`../examples/${id}.json`, import.meta.url));
  if (!res.ok) throw new Error(`${id}.json: HTTP ${res.status}`);
  return res.json();
}

export const Examples = (() => {
  /** IDs aller Beispiele in der Reihenfolge der Auswahl. */
  const ids = () => IDS.slice();

  /** Beispiel laden (`null` für unbekannte IDs). @param {string} id @returns {Promise<ExampleDef | null>} */
  async function get(id) {
    return IDS.includes(id) ? fetchExample(id) : null;
  }

  /** Alle Beispiele laden, in der Reihenfolge der Auswahl. @returns {Promise<ExampleDef[]>} */
  const all = async () => Promise.all(IDS.map(fetchExample));

  /**
   * Frische, geprüfte Kopie der Beispiel-Matrix (jedes Öffnen ergibt eine eigene Matrix).
   * @param {ExampleDef} def @returns {Matrix}
   */
  const toMatrix = def => Model.normalize(JSON.parse(JSON.stringify(def.data)));

  /** @param {string} id @returns {Promise<Matrix | null>} */
  async function load(id) {
    const def = await get(id);
    return def ? toMatrix(def) : null;
  }

  /** Matrix des ersten Beispiels – ohne Nachladen, für den allerersten Start. */
  const loadFirst = () => toMatrix(/** @type {ExampleDef} */ (first));

  return { ids, get, all, load, loadFirst, toMatrix };
})();
