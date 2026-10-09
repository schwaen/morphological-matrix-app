/*
 * Zip – ZIP-Archive schreiben und lesen (für Backup und Wiederherstellung) mit der
 * Bibliothek fflate. Gelesen werden gespeicherte und mit Deflate komprimierte Einträge
 * (z. B. auch von Hand neu gepackte Archive); Ordner werden übersprungen. Ohne DOM;
 * exportiert den Namensraum `Zip`.
 */
import { strToU8, unzipSync, zipSync } from 'fflate';
import { Texts } from './texts.js';

export const Zip = (() => {
  /** @typedef {{ name: string, data: Uint8Array }} ZipEntry */

  /**
   * Archiv aus Textdateien erstellen (Deflate; Dateinamen in UTF-8).
   * @param {Array<{ name: string, text: string }>} files
   * @param {Date} [now] Änderungszeit der Einträge
   * @returns {Promise<Uint8Array>}
   */
  async function create(files, now = new Date()) {
    /** @type {import('fflate').Zippable} */
    const entries = {};
    for (const file of files) entries[file.name] = [strToU8(file.text), { mtime: now, level: 6 }];
    return zipSync(entries);
  }

  /** Erkennt ein ZIP-Archiv an seiner Signatur. @param {Uint8Array} bytes */
  const isZip = bytes => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

  /**
   * Aufbau prüfen, bevor fflate entpackt: fflate liest nachsichtig und liefert bei beschädigten
   * Archiven sonst leere oder falsche Einträge statt eines Fehlers. Geprüft werden das Ende des
   * Verzeichnisses, jeder Verzeichniseintrag und der zugehörige Dateikopf.
   * @param {Uint8Array} bytes
   */
  function wellFormed(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const sig = (/** @type {number} */ at, /** @type {number} */ value) => at >= 0 && at + 4 <= bytes.length && view.getUint32(at, true) === value;
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
      if (sig(i, 0x06054b50)) { eocd = i; break; }
    }
    if (eocd < 0) return false;
    let p = view.getUint32(eocd + 16, true);
    for (let n = view.getUint16(eocd + 10, true); n > 0; n--) {
      if (p + 46 > bytes.length || !sig(p, 0x02014b50)) return false;
      const local = view.getUint32(p + 42, true);
      if (local + 30 > bytes.length || !sig(local, 0x04034b50)) return false;
      p += 46 + view.getUint16(p + 28, true) + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    }
    return true;
  }

  /**
   * Alle Dateien eines Archivs lesen (Ordner werden übersprungen). Wirft bei beschädigten
   * Archiven und nicht unterstützten Kompressionsverfahren.
   * @param {Uint8Array} bytes
   * @returns {Promise<ZipEntry[]>}
   */
  async function read(bytes) {
    /** @type {import('fflate').Unzipped} */
    let files;
    if (!wellFormed(bytes)) throw new Error(Texts.errors.zipInvalid);
    try {
      files = unzipSync(bytes, { filter: f => !f.name.endsWith('/') });
    } catch (e) {
      // fflate meldet unbekannte Verfahren als „unknown compression type“
      const unknownMethod = /compression/i.test(String(e && /** @type {Error} */ (e).message));
      throw new Error(unknownMethod ? Texts.errors.zipMethod : Texts.errors.zipInvalid, { cause: e });
    }
    return Object.entries(files).map(([name, data]) => ({ name, data }));
  }

  return { create, read, isZip };
})();
