/*
 * Strengere Typprüfung der DOM-freien Logik-Dateien (tsconfig.logic.json: zusätzlich keine
 * impliziten any-Typen). Die Logik importiert `Texts`, daher prüft tsc die Sprachdateien mit;
 * deren Textbausteine sind bewusst ausgenommen – Meldungen dazu werden hier ausgefiltert.
 * Die Verwendung der Texte prüft die normale Typprüfung (jsconfig.json).
 */
import { spawnSync } from 'node:child_process';

const EXEMPT = /^js\/(texts\.js|i18n\/)/;
const run = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false', '-p', 'tsconfig.logic.json'], { encoding: 'utf8', shell: process.platform === 'win32' });
const errors = (run.stdout + run.stderr).split('\n').filter(line => /error TS\d+/.test(line) && !EXEMPT.test(line));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
