/*
 * Lädt die DOM-freien App-Skripte (klassische Browser-Skripte, kein Modul) in einen
 * isolierten V8-Kontext – genau wie der Browser sie nacheinander ausführt – und gibt
 * ihre Namensräume zurück.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const FILES = ['js/util.js', 'js/model.js', 'js/evaluation.js', 'js/io.js'];

export function loadApp() {
  const context = vm.createContext({ TextEncoder, TextDecoder, btoa, atob });
  for (const file of FILES) {
    vm.runInContext(fs.readFileSync(path.resolve(file), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('({ Util, Model, Evaluation, IO })', context);
}

/** Objekte aus dem fremden Kontext für deepStrictEqual vergleichbar machen. */
export const plain = v => JSON.parse(JSON.stringify(v));
