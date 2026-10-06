/*
 * Examples – mitgelieferte Beispiele.
 * Jedes Beispiel steht in einer eigenen Datei unter examples/ und meldet sich dort mit
 * `Examples.register({...})` an; eingebunden wird es per <script> in index.html.
 * (Reines JSON ließe sich über file:// nicht nachladen.) Stellt den Namensraum `Examples` bereit.
 */
'use strict';

const Examples = (() => {
  /** @type {ExampleDef[]} */
  const list = [];

  /**
   * Beispiel anmelden. Die Matrix wird erst beim Öffnen geprüft (`Model.normalize`).
   * @param {ExampleDef} def
   */
  function register(def) {
    if (!def || typeof def.id !== 'string' || !def.data || typeof def.data !== 'object') {
      console.warn('Beispiel ohne id oder data wird ignoriert.', def);
      return;
    }
    if (list.some(e => e.id === def.id)) {
      console.warn(`Beispiel „${def.id}“ ist doppelt angemeldet.`);
      return;
    }
    list.push(def);
  }

  /** Alle Beispiele in der Reihenfolge der Einbindung. @returns {ExampleDef[]} */
  const all = () => list.slice();

  /** @param {string} id */
  const get = id => list.find(e => e.id === id) || null;

  /**
   * Frische, geprüfte Kopie der Beispiel-Matrix (jedes Öffnen ergibt eine eigene Matrix).
   * @param {string} id @returns {Matrix | null}
   */
  function load(id) {
    const def = get(id);
    return def ? Model.normalize(JSON.parse(JSON.stringify(def.data))) : null;
  }

  return { register, all, get, load };
})();
