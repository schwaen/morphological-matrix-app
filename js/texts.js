/*
 * Texts – Texte der aktiven Sprache. Die Texte selbst stehen je Sprache in js/i18n/
 * (de.js ist maßgeblich, en.js hat dieselbe Struktur). Gewählt wird die zuletzt im Menü
 * eingestellte Sprache, sonst die Browsersprache (Deutsch für „de…“, sonst Englisch).
 * Stellt die Namensräume `Texts` (aktive Sprache) und `Languages` bereit.
 */
'use strict';

const Languages = (() => {
  const STORAGE_KEY = 'morphologische-matrix:lang';
  /** @type {Record<string, typeof TextsDe>} */
  const packs = { de: TextsDe, en: TextsEn };

  /** Gespeicherte Wahl, sonst Browsersprache; ohne Browser (Unit-Tests) Deutsch. */
  function detect() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* kein Speicher */ }
    if (stored && packs[stored]) return stored;
    const nav = typeof navigator !== 'undefined' && navigator.language;
    if (!nav) return 'de';
    return nav.toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  /** Sprache merken (wirkt nach dem Neuladen). @param {string} lang */
  function choose(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* kein Speicher */ }
  }

  return { packs, detect, choose, STORAGE_KEY };
})();

/** Texte der aktiven Sprache. */
const Texts = Languages.packs[Languages.detect()];
