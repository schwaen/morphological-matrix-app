/*
 * Lädt die DOM-freien App-Skripte (klassische Browser-Skripte, kein Modul) in einen
 * isolierten V8-Kontext – genau wie der Browser sie nacheinander ausführt – und gibt
 * ihre Namensräume zurück.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const FILES = ['js/i18n/de.js', 'js/i18n/en.js', 'js/texts.js', 'js/util.js', 'js/model.js', 'js/consistency.js', 'js/evaluation.js', 'js/ops.js', 'js/io.js', 'js/zip.js', 'js/examples.js'];
/** Mitgelieferte Beispiele: alle in index.html eingebundenen Dateien unter examples/. */
export const EXAMPLE_FILES = [...fs.readFileSync(path.resolve('index.html'), 'utf8')
  .matchAll(/<script src="(examples\/[^"]+\.js)"/g)].map(m => m[1]);

export function loadApp() {
  const context = vm.createContext({
    TextEncoder, TextDecoder, btoa, atob, console,
    Blob, Response, CompressionStream, DecompressionStream, Uint8Array, ArrayBuffer, DataView,
  });
  for (const file of [...FILES, ...EXAMPLE_FILES]) {
    vm.runInContext(fs.readFileSync(path.resolve(file), 'utf8'), context, { filename: file });
  }
  const app = vm.runInContext('({ Texts, Languages, Util, Model, Consistency, Evaluation, Ops, IO, Zip, Examples })', context);
  /** Beispiel „Kaffeemaschine“ als frische Matrix (Grundlage vieler Tests). */
  app.example = () => app.Examples.load('kaffeemaschine');
  return app;
}

/** Objekte aus dem fremden Kontext für deepStrictEqual vergleichbar machen. */
export const plain = v => JSON.parse(JSON.stringify(v));
