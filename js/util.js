/*
 * Util – kleine, DOM-freie Hilfsfunktionen (Zahlen, Texte, Kodierung).
 * Klassisches Skript ohne Build: stellt genau den globalen Namensraum `Util` bereit.
 */
'use strict';

const Util = (() => {
  const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  /** Kurze, praktisch eindeutige ID. */
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  /** @param {any} v @param {string} [fallback] @returns {string} */
  function str(v, fallback = '') {
    return typeof v === 'string' ? v : (v == null ? fallback : String(v));
  }

  /** Endliche Zahl oder `null`. @param {any} v @returns {number | null} */
  function num(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  /** @param {any} v @returns {boolean} */
  function isColor(v) {
    return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  }

  /**
   * Liest Zahlen in deutscher oder englischer Schreibweise („1.200,50“, „1200.5“).
   * @param {any} text
   * @returns {number | null} `null` bei leerer Eingabe, `NaN` bei ungültiger
   */
  function parseNumber(text) {
    let s = String(text).trim().replace(/[\s€$£]|CHF/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
  }

  /** Zahl für ein Eingabefeld (Dezimalkomma, ohne Tausenderpunkte). @param {number | null} n */
  function numberToInput(n) {
    return n == null ? '' : String(n).replace('.', ',');
  }

  /** @param {number} n */
  function formatNumber(n) {
    return numberFormat.format(n);
  }

  /**
   * Große Ganzzahl in Tausenderstufen zerlegen: 118_881_339_310_080_000n → { value: 118.88…, power: 15 }.
   * Exakt auch jenseits von Number.MAX_SAFE_INTEGER (nur `value` wird gerundet).
   * @param {bigint} n @returns {{ value: number, power: number }}
   */
  function scaleBigInt(n) {
    const digits = (n < 0n ? -n : n).toString().length;
    const power = Math.max(0, Math.floor((digits - 1) / 3) * 3);
    const factor = 10n ** BigInt(power);
    // Ganzzahliger Anteil exakt, Nachkommastellen über die nächsten drei Ziffern
    return { value: Number(n / factor) + Number((n % factor) * 1000n / factor) / 1000, power };
  }

  /** @param {number} n @param {string} currency */
  function formatMoney(n, currency) {
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(n);
    } catch (e) {
      return `${numberFormat.format(n)} ${currency}`;
    }
  }

  /** @param {string} currency */
  function currencySymbol(currency) {
    try {
      const part = new Intl.NumberFormat('de-DE', { style: 'currency', currency })
        .formatToParts(0).find(x => x.type === 'currency');
      return part ? part.value : currency;
    } catch (e) {
      return currency;
    }
  }

  /** Dateiname aus einem Titel („Beispiel: Größe“ → „beispiel-groesse“ bzw. ASCII-Näherung). */
  function slugify(text) {
    return (text || 'matrix')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .toLowerCase().slice(0, 60) || 'matrix';
  }

  /** Lexikografischer Vergleich zweier gleich langer Schlüssel. @param {number[]} a @param {number[]} b */
  function lexLess(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return true;
      if (a[i] > b[i]) return false;
    }
    return false;
  }

  /** UTF-8-Text → Base64url (für Links). @param {string} text */
  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** @param {string} b64 */
  function fromBase64Url(b64) {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  }

  return {
    uid, str, num, isColor, parseNumber, numberToInput, formatNumber, scaleBigInt, formatMoney, currencySymbol,
    slugify, lexLess, toBase64Url, fromBase64Url,
  };
})();
