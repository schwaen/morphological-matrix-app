/*
 * DOM-freie App-Module für die Unit-Tests (Vitest). Sprache siehe setup.js.
 */
import { Texts, Languages } from '../../js/texts.js';
import { Util } from '../../js/util.js';
import { Model } from '../../js/model.js';
import { Consistency } from '../../js/consistency.js';
import { Evaluation } from '../../js/evaluation.js';
import { Ops } from '../../js/ops.js';
import { IO } from '../../js/io.js';
import { Zip } from '../../js/zip.js';
import { Examples } from '../../js/examples.js';

const app = {
  Texts, Languages, Util, Model, Consistency, Evaluation, Ops, IO, Zip, Examples,
  /** Beispiel „Kaffeemaschine“ als frische Matrix (Grundlage vieler Tests). */
  example: () => Examples.loadFirst(),
};

export const loadApp = () => app;

/** Tiefe Kopie als reine Daten (z. B. Map-freie Vergleiche mit deepStrictEqual). */
export const plain = v => JSON.parse(JSON.stringify(v));
