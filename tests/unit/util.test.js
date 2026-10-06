import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Util } = loadApp();

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
