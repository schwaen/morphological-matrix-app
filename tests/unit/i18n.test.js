import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadApp } from './load.js';

const { Texts, Languages, Util } = loadApp();
const { de, en } = Languages.packs;

/** Alle Pfade eines Sprachpakets mit Art des Werts (Funktionen samt Anzahl der Parameter). */
function shape(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'function') return [`${key}()/${v.length}`];
    if (v && typeof v === 'object') return shape(v, key);
    return [`${key}:${typeof v}`];
  }).sort();
}

test('Englisch hat genau dieselben Texte wie Deutsch (keine fehlenden oder überzähligen)', () => {
  const dePaths = shape(de);
  const enPaths = shape(en);
  assert.deepEqual(enPaths.filter(p => !dePaths.includes(p)), [], 'nur in en.js');
  assert.deepEqual(dePaths.filter(p => !enPaths.includes(p)), [], 'fehlt in en.js');
});

test('Jeder Schlüssel aus index.html existiert in beiden Sprachen', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const keys = [
    ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m => m[1].split(';').map(p => p.split(':')[1].trim())),
  ];
  assert.ok(keys.length > 50, `nur ${keys.length} Schlüssel gefunden`);
  const get = (pack, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), pack);
  for (const key of keys) {
    assert.equal(typeof get(de, key), 'string', `de: ${key}`);
    assert.equal(typeof get(en, key), 'string', `en: ${key}`);
  }
});

test('Ohne Browser gilt Deutsch; Formate und Trenner je Sprache', () => {
  assert.equal(Languages.detect(), 'de');
  assert.equal(Texts.meta.lang, 'de');
  assert.deepEqual([de.meta.locale, de.meta.decimal, de.meta.csvSeparator], ['de-DE', ',', ';']);
  assert.deepEqual([en.meta.locale, en.meta.decimal, en.meta.csvSeparator], ['en-US', '.', ',']);
});

test('Zahlen-Eingabe in englischer Schreibweise', () => {
  const p = t => Util.parseNumber(t, '.');
  assert.equal(p('1,234.5'), 1234.5);
  assert.equal(p('1,200'), 1200);      // Tausendergruppe
  assert.equal(p('1.5'), 1.5);
  assert.equal(p('3,5'), 3.5);         // nachsichtig: Komma ohne Tausendergruppe als Dezimaltrenner
  assert.equal(p('$ 12.50'), 12.5);
  assert.ok(Number.isNaN(p('abc')));
  assert.equal(Util.numberToInput(1.5, '.'), '1.5');
  assert.equal(Util.numberToInput(1.5, ','), '1,5');
});
