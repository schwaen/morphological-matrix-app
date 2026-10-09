/*
 * Zip – ZIP-Archive schreiben und lesen, ohne Bibliothek (für Backup und Wiederherstellung).
 * Komprimiert wird mit der eingebauten CompressionStream-API („deflate-raw“); fehlt sie,
 * werden die Dateien unkomprimiert gespeichert. Lesen kann gespeicherte und mit Deflate
 * komprimierte Einträge (z. B. auch von Hand neu gepackte Archive). Ohne DOM; exportiert den
 * Namensraum `Zip`.
 */
import { Texts } from './texts.js';

export const Zip = (() => {
  /** @typedef {{ name: string, data: Uint8Array }} ZipEntry */

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  /** @param {Uint8Array} bytes */
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** Datenstrom durch Kompression bzw. Dekompression schicken. @param {Uint8Array} bytes @param {any} stream */
  async function pipe(bytes, stream) {
    const out = new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }

  const canDeflate = () => typeof CompressionStream === 'function';

  /** Datum/Uhrzeit im DOS-Format der ZIP-Einträge. @param {Date} d */
  function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  /**
   * Archiv aus Textdateien erstellen.
   * @param {Array<{ name: string, text: string }>} files
   * @param {Date} [now]
   * @returns {Promise<Uint8Array>}
   */
  async function create(files, now = new Date()) {
    const enc = new TextEncoder();
    const { time, date } = dosDateTime(now);
    const deflate = canDeflate();
    /** @type {Uint8Array[]} */
    const parts = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
      const name = enc.encode(file.name);
      const raw = enc.encode(file.text);
      const packed = deflate ? await pipe(raw, new CompressionStream(/** @type {any} */ ('deflate-raw'))) : raw;
      const method = deflate ? 8 : 0;
      const crc = crc32(raw);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // Dateinamen in UTF-8
      local.setUint16(8, method, true);
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, packed.length, true);
      local.setUint32(22, raw.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, packed);
      central.push({ name, method, crc, size: packed.length, rawSize: raw.length, offset });
      offset += 30 + name.length + packed.length;
    }
    const cdStart = offset;
    for (const e of central) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 20, true);
      h.setUint16(8, 0x0800, true);
      h.setUint16(10, e.method, true);
      h.setUint16(12, time, true);
      h.setUint16(14, date, true);
      h.setUint32(16, e.crc, true);
      h.setUint32(20, e.size, true);
      h.setUint32(24, e.rawSize, true);
      h.setUint16(28, e.name.length, true);
      h.setUint32(42, e.offset, true);
      parts.push(new Uint8Array(h.buffer), e.name);
      offset += 46 + e.name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, central.length, true);
    end.setUint16(10, central.length, true);
    end.setUint32(12, offset - cdStart, true);
    end.setUint32(16, cdStart, true);
    parts.push(new Uint8Array(end.buffer));
    const out = new Uint8Array(offset + 22);
    let pos = 0;
    for (const part of parts) { out.set(part, pos); pos += part.length; }
    return out;
  }

  /** Erkennt ein ZIP-Archiv an seiner Signatur. @param {Uint8Array} bytes */
  const isZip = bytes => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

  /**
   * Alle Dateien eines Archivs lesen (Ordner werden übersprungen). Wirft bei beschädigten
   * Archiven und nicht unterstützten Kompressionsverfahren.
   * @param {Uint8Array} bytes
   * @returns {Promise<ZipEntry[]>}
   */
  async function read(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Ende des zentralen Verzeichnisses suchen (am Ende, ggf. hinter einem Kommentar)
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error(Texts.errors.zipInvalid);
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    /** @type {ZipEntry[]} */
    const entries = [];
    for (let n = 0; n < count; n++) {
      if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new Error(Texts.errors.zipInvalid);
      const method = view.getUint16(p + 10, true);
      const size = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const local = view.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue;
      if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new Error(Texts.errors.zipInvalid);
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const packed = bytes.subarray(start, start + size);
      let data;
      if (method === 0) data = packed;
      else if (method === 8 && typeof DecompressionStream === 'function') {
        data = await pipe(packed, new DecompressionStream(/** @type {any} */ ('deflate-raw')));
      } else throw new Error(Texts.errors.zipMethod);
      entries.push({ name, data });
    }
    return entries;
  }

  return { create, read, isZip, crc32 };
})();
