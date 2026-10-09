/*
 * Testumgebung für die App-Module: Die App wählt ihre Sprache beim Laden nach
 * `navigator.language`. Standard in den Tests ist Deutsch; eine Testdatei für Englisch
 * importiert vorher `./env-en.js`. Jede Testdatei läuft in einem eigenen Prozess.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

setGlobal('navigator', { language: globalThis.TEST_LANGUAGE || 'de-DE' });

// Node lädt per fetch keine file:-URLs; die App lädt so ihre Beispiele nach
const nodeFetch = globalThis.fetch;
setGlobal('fetch', async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== 'file:') return nodeFetch(input, init);
  try {
    return new Response(fs.readFileSync(fileURLToPath(url)));
  } catch {
    return new Response(null, { status: 404 });
  }
});

/**
 * Globalen Wert setzen (auch schreibgeschützte wie `navigator`).
 * @param {string} name @param {unknown} value
 */
export function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: false });
}

/**
 * Globale Werte für die Dauer von `fn` ersetzen (`undefined` = nicht vorhanden).
 * @template T @param {Record<string, unknown>} values @param {() => T} fn @returns {Promise<Awaited<T>>}
 */
export async function withGlobals(values, fn) {
  const saved = Object.keys(values).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete globalThis[name];
    else setGlobal(name, value);
  }
  try {
    return await fn();
  } finally {
    for (const [name, desc] of saved) {
      if (desc) Object.defineProperty(globalThis, name, desc);
      else delete globalThis[name];
    }
  }
}
