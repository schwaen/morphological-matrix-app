import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Util, Languages } = loadApp();

test('parseNumber: deutsche und englische Schreibweise', () => {
  assert.equal(Util.parseNumber('1.234,5'), 1234.5);
  assert.equal(Util.parseNumber('1234.5'), 1234.5);
  assert.equal(Util.parseNumber('1.200'), 1200);      // Tausenderpunkt
  assert.equal(Util.parseNumber('12,5 €'), 12.5);
  assert.equal(Util.parseNumber('CHF 7'), 7);
  assert.equal(Util.parseNumber('-3,25'), -3.25);
  assert.equal(Util.parseNumber(',5'), 0.5);
  assert.equal(Util.parseNumber('  '), null);
  assert.ok(Number.isNaN(Util.parseNumber('abc')));
  assert.ok(Number.isNaN(Util.parseNumber('1,2,3')));
});

test('numberToInput: Dezimalkomma, leer für null', () => {
  assert.equal(Util.numberToInput(1234.5), '1234,5');
  assert.equal(Util.numberToInput(0), '0');
  assert.equal(Util.numberToInput(null), '');
});

test('formatMoney: Währung und Rückfall bei unbekannter Währung', () => {
  assert.equal(Util.formatMoney(54, 'EUR').replace(/\s/g, ' '), '54,00 €');
  assert.match(Util.formatMoney(5, 'XXX!'), /^5 XXX!$/);
});

test('slugify: Dateinamen aus Titeln', () => {
  assert.equal(Util.slugify('Beispiel: Kaffeemaschine'), 'beispiel-kaffeemaschine');
  assert.equal(Util.slugify('Größe & Übermaß'), 'grosse-ubermass');
  assert.equal(Util.slugify(''), 'matrix');
  assert.equal(Util.slugify('!!!'), 'matrix');
});

test('lexLess: lexikografischer Vergleich', () => {
  assert.equal(Util.lexLess([1, 5], [2, 0]), true);
  assert.equal(Util.lexLess([2, 0], [1, 5]), false);
  assert.equal(Util.lexLess([1, 2], [1, 3]), true);
  assert.equal(Util.lexLess([1, 3], [1, 3]), false);
  assert.equal(Util.lexLess([1, Infinity], [1, 3]), false);
});

test('Base64url: Rundreise mit Umlauten und Sonderzeichen', () => {
  const text = 'Kaffee „Ünicode“ – ß/+= 🚲'.repeat(200);
  const enc = Util.toBase64Url(text);
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
  assert.equal(Util.fromBase64Url(enc), text);
});

test('uid: kurze, eindeutige IDs', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => Util.uid()));
  assert.equal(ids.size, 1000);
});

test('scaleBigInt zerlegt große Zahlen exakt in Tausenderstufen', () => {
  assert.deepEqual(plain(Util.scaleBigInt(0n)), { value: 0, power: 0 });
  assert.deepEqual(plain(Util.scaleBigInt(999n)), { value: 999, power: 0 });
  assert.deepEqual(plain(Util.scaleBigInt(1_500_000n)), { value: 1.5, power: 6 });
  // Jenseits von Number.MAX_SAFE_INTEGER (≈ 9 · 10¹⁵)
  assert.deepEqual(plain(Util.scaleBigInt(118_881_339_310_080_000n)), { value: 118.881, power: 15 });
  assert.deepEqual(plain(Util.scaleBigInt(10n ** 40n)), { value: 10, power: 39 });
});

// Englische Formate prüft util-en.test.js (App dort mit englischer Oberfläche geladen)

// Globale Werte nach jedem Test zurücksetzen (auch die Sprache aus setup.js gilt dann wieder)
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('navigator', { language: 'de-DE' }); });

test('Sprachwahl: Browsersprache, ohne Browser Deutsch', () => {
  vi.stubGlobal('navigator', { language: 'en-US' });
  assert.equal(Languages.detect(), 'en');
  vi.stubGlobal('navigator', { language: 'de-AT' });
  assert.equal(Languages.detect(), 'de');
  vi.stubGlobal('navigator', undefined);
  assert.equal(Languages.detect(), 'de');
});

test('Sprachwahl: gespeicherte Sprache hat Vorrang vor der Browsersprache', () => {
  const store = new Map();
  vi.stubGlobal('localStorage', { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  Languages.choose('en');
  assert.equal(store.get(Languages.STORAGE_KEY), 'en');
  assert.equal(Languages.detect(), 'en');
  store.set(Languages.STORAGE_KEY, 'xx'); // unbekannte Sprache wird ignoriert
  assert.equal(Languages.detect(), 'de');
});

test('str: Texte unverändert, null/undefined als Ersatz, sonst als Text', () => {
  assert.equal(Util.str('abc'), 'abc');
  assert.equal(Util.str(null), '');
  assert.equal(Util.str(undefined, '–'), '–');
  assert.equal(Util.str(42), '42');
  assert.equal(Util.str(false), 'false');
});

test('num: nur endliche Zahlen', () => {
  assert.equal(Util.num(3.5), 3.5);
  assert.equal(Util.num(0), 0);
  assert.equal(Util.num(NaN), null);
  assert.equal(Util.num(Infinity), null);
  assert.equal(Util.num('3'), null);
  assert.equal(Util.num(null), null);
});

test('isColor: nur sechsstellige Hex-Farben', () => {
  assert.equal(Util.isColor('#4f46e5'), true);
  assert.equal(Util.isColor('#ABCDEF'), true);
  assert.equal(Util.isColor('#abc'), false);
  assert.equal(Util.isColor('4f46e5'), false);
  assert.equal(Util.isColor('#4f46e5ff'), false);
  assert.equal(Util.isColor(null), false);
});

test('parseNumber: englische Schreibweise mit Dezimalpunkt', () => {
  assert.equal(Util.parseNumber('1,234.5', '.'), 1234.5);
  assert.equal(Util.parseNumber('1,200', '.'), 1200);    // Tausenderkomma
  assert.equal(Util.parseNumber('3,5', '.'), 3.5);       // Komma ohne Tausendergruppe
  assert.equal(Util.parseNumber('$ 12.75', '.'), 12.75);
  assert.equal(Util.parseNumber('-0.5', '.'), -0.5);
  assert.ok(Number.isNaN(Util.parseNumber('1.2.3', '.')));
  assert.equal(Util.parseNumber(7), 7);                  // keine Zeichenkette
});

test('numberToInput: Dezimalpunkt im Englischen', () => {
  assert.equal(Util.numberToInput(1234.5, '.'), '1234.5');
});

test('Zahlenformate je Sprache', () => {
  const sp = s => s.replace(/\s/g, ' ');
  assert.equal(Util.formatNumber(1234.567), '1.234,57');
  assert.equal(Util.formatInteger(1234567), '1.234.567');
  assert.equal(Util.formatInteger(12345678901234567890n), '12.345.678.901.234.567.890');
  assert.equal(sp(Util.formatPercent(0.255)), '25,5 %');
});

test('currencySymbol: Symbol der Währung, sonst der Code', () => {
  assert.equal(Util.currencySymbol('EUR'), '€');
  assert.equal(Util.currencySymbol('CHF'), 'CHF');      // kein eigenes Symbol
  assert.equal(Util.currencySymbol('XXX!'), 'XXX!');    // ungültiger Code
});

test('scaleBigInt: negative Zahlen', () => {
  assert.deepEqual(plain(Util.scaleBigInt(-1_500_000n)), { value: -1.5, power: 6 });
});

test('searchKey: ohne Akzente und Großschreibung, ß als ss', () => {
  assert.equal(Util.searchKey('  Größe Café  '), 'grosse cafe');
  assert.equal(Util.searchKey('STRASSE'), Util.searchKey('Straße'));
  assert.equal(Util.searchKey('Übermaß'), 'ubermass');
});

test('errorMessage: Text beliebiger Ausnahmen', () => {
  // Fehler aus dem App-Kontext (Fehlerobjekte des Tests stammen aus einem anderen Realm)
  let thrown;
  try { Util.lexLess(null, []); } catch (e) { thrown = e; }
  assert.match(Util.errorMessage(thrown), /^Cannot read properties of null/);
  assert.equal(Util.errorMessage('nur Text'), 'nur Text');
  assert.equal(Util.errorMessage(42), '42');
});
