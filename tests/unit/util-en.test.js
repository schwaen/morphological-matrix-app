import './env-en.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.js';

// App mit englischer Oberfläche (siehe env-en.js)
const { Util, Texts } = loadApp();
const sp = s => s.replace(/\s/g, ' ');

test('Englische Oberfläche wird beim Laden gewählt', () => {
  assert.equal(Texts.meta.decimal, '.');
});

test('parseNumber und numberToInput: Standard ist der Dezimalpunkt', () => {
  assert.equal(Util.parseNumber('2,500'), 2500);
  assert.equal(Util.parseNumber('3,5'), 3.5);
  assert.equal(Util.numberToInput(0.25), '0.25');
});

test('Zahlenformate auf Englisch', () => {
  assert.equal(Util.formatNumber(1234.567), '1,234.57');
  assert.equal(Util.formatInteger(1234567), '1,234,567');
  assert.equal(Util.formatPercent(0.255), '25.5%');
  assert.equal(sp(Util.formatMoney(54, 'EUR')), '€54.00');
  assert.equal(Util.currencySymbol('USD'), '$');
});
