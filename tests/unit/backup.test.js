import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';
import { strToU8, zipSync } from 'fflate';

const { IO, Zip, Model, Texts, example: kaffeemaschine } = loadApp();
const dec = new TextDecoder();

test('ZIP: Rundreise mit Umlauten im Namen und Inhalt', async () => {
  const files = [
    { name: 'kaffeemaschine.json', text: '{"title":"Kaffeemaschine"}' },
    { name: 'größe-ä.json', text: 'Ä'.repeat(5000) },
  ];
  const zip = await Zip.create(files, new Date(2026, 9, 6, 12, 30));
  assert.equal(Zip.isZip(zip), true);
  const back = await Zip.read(zip);
  assert.deepEqual(plain(back.map(e => ({ name: e.name, text: dec.decode(e.data) }))), files);
  // Wiederholungen werden komprimiert (Deflate)
  assert.ok(zip.length < 2000);
});

test('ZIP: beschädigtes Archiv wird abgelehnt', async () => {
  await assert.rejects(Zip.read(new Uint8Array([1, 2, 3, 4, 5])), /beschädigt/);
  assert.equal(Zip.isZip(new TextEncoder().encode('{}')), false);
});

/** Position des zentralen Verzeichnisses (aus dem Verzeichnisende, das hier ohne Kommentar am Schluss steht). */
const centralOffset = zip => new DataView(zip.buffer, zip.byteOffset).getUint32(zip.length - 22 + 16, true);
const sample = [{ name: 'a.json', text: '{"a":1}' }, { name: 'b.txt', text: 'Bä'.repeat(50) }];

test('ZIP: unkomprimiert gespeicherte Archive (z. B. von anderen Programmen) sind lesbar', async () => {
  const zip = zipSync(Object.fromEntries(sample.map(f => [f.name, [strToU8(f.text), { level: 0 }]])));
  assert.equal(new DataView(zip.buffer).getUint16(8, true), 0); // Verfahren „gespeichert“
  const back = await Zip.read(zip);
  assert.deepEqual(plain(back.map(e => ({ name: e.name, text: dec.decode(e.data) }))), sample);
});

test('ZIP: Ordnereinträge werden übersprungen', async () => {
  const zip = await Zip.create([{ name: 'ordner/', text: '' }, sample[0]]);
  assert.deepEqual(plain((await Zip.read(zip)).map(e => e.name)), ['a.json']);
});

test('ZIP: beschädigtes Verzeichnis oder fehlender Dateikopf werden abgelehnt', async () => {
  const zip = await Zip.create(sample);
  const broken = zip.slice();
  broken[centralOffset(zip)] = 0; // Signatur des Verzeichniseintrags
  await assert.rejects(Zip.read(broken), new RegExp(Texts.errors.zipInvalid));
  const noLocal = zip.slice();
  noLocal[0] = 0; // Signatur des ersten Dateikopfs
  await assert.rejects(Zip.read(noLocal), new RegExp(Texts.errors.zipInvalid));
  // Abgeschnitten: Verzeichnis zeigt hinter das Dateiende
  const cut = zip.slice();
  new DataView(cut.buffer).setUint32(cut.length - 22 + 16, cut.length, true);
  await assert.rejects(Zip.read(cut), new RegExp(Texts.errors.zipInvalid));
});

test('ZIP: unbekanntes Kompressionsverfahren wird abgelehnt', async () => {
  const zip = await Zip.create(sample);
  const odd = zip.slice();
  new DataView(odd.buffer).setUint16(centralOffset(zip) + 10, 99, true);
  await assert.rejects(Zip.read(odd), new RegExp(Texts.errors.zipMethod));
});

const doc = (id, title, savedAt = 1000) => {
  const data = kaffeemaschine();
  data.title = title;
  return { id, savedAt, data };
};

test('Backup: je Matrix eine JSON-Datei mit eindeutigem Namen und Inhaltsübersicht', () => {
  const files = IO.backupFiles([doc('a', 'Projekt'), doc('b', 'Projekt'), doc('c', 'Backup')], new Date('2026-10-06T10:00:00Z'));
  assert.deepEqual(plain(files.map(f => f.name)), ['backup.json', 'projekt.json', 'projekt-2.json', 'backup-2.json']);
  const manifest = JSON.parse(files[0].text);
  assert.equal(manifest.format, 'morphologische-matrix-backup');
  assert.deepEqual(plain(manifest.matrices.map(m => [m.file, m.id, m.savedAt])),
    [['projekt.json', 'a', 1000], ['projekt-2.json', 'b', 1000], ['backup-2.json', 'c', 1000]]);
  // Jede Datei ist ein normaler JSON-Export
  assert.equal(Model.normalize(JSON.parse(files[1].text)).title, 'Projekt');
  assert.equal(IO.backupFileName(new Date('2026-10-06T10:00:00Z')), 'morphologische-matrizen-backup-2026-10-06.zip');
});

test('Backup lesen: Kennungen aus der Übersicht, fremde und ungültige Dateien', () => {
  const files = IO.backupFiles([doc('a', 'Eins', 111), doc('b', 'Zwei', 222)]);
  const { items, errors } = IO.parseBackup([
    ...files.map(f => ({ ...f, name: `ordner/${f.name}` })),
    { name: '__MACOSX/._eins.json', text: 'x' },
    { name: 'notiz.txt', text: 'x' },
    { name: 'kaputt.json', text: '{' },
    { name: 'export.json', text: IO.toJson(doc('x', 'Ohne Übersicht').data) },
  ]);
  assert.deepEqual(plain(items.map(i => [i.file, i.id, i.savedAt, i.data.title])), [
    ['eins.json', 'a', 111, 'Eins'], ['zwei.json', 'b', 222, 'Zwei'], ['export.json', null, null, 'Ohne Übersicht'],
  ]);
  assert.deepEqual(plain(errors.map(e => e.file)), ['kaputt.json']);
});

test('Wiederherstellen: neu hinzufügen, identische überspringen, nie überschreiben', () => {
  const existing = [doc('a', 'Unverändert'), doc('b', 'Lokal geändert')];
  const items = [
    { file: '1', id: 'a', savedAt: 1, data: existing[0].data },                    // identisch
    { file: '2', id: 'b', savedAt: 2, data: doc('b', 'Stand im Backup').data },    // abweichend → Kopie
    { file: '3', id: 'c', savedAt: 3, data: doc('c', 'Nur im Backup').data },      // neu, Kennung bleibt
    { file: '4', id: null, savedAt: null, data: doc('', 'Ohne Kennung').data },    // neu, neue Kennung
    { file: '5', id: null, savedAt: null, data: existing[0].data },                // identisch ohne Kennung
  ];
  let n = 0;
  const plan = IO.planRestore(items, existing, () => `neu${++n}`);
  assert.equal(plan.unchanged, 2);
  assert.equal(plan.copies, 1);
  assert.deepEqual(plain(plan.add.map(d => [d.id, d.data.title])), [
    ['neu1', 'Stand im Backup (aus Backup)'], ['c', 'Nur im Backup'], ['neu2', 'Ohne Kennung'],
  ]);
  assert.equal(plan.add[1].savedAt, 3);
});
