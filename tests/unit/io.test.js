import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model, IO, example: kaffeemaschine } = loadApp();

test('Dateinamen aus dem Titel', () => {
  const m = kaffeemaschine();
  assert.equal(IO.fileName(m, 'json'), 'beispiel-kaffeemaschine.json');
  assert.equal(IO.fileName(m, 'csv'), 'beispiel-kaffeemaschine.csv');
});

test('JSON-Export lässt sich unverändert wieder einlesen', () => {
  const m = kaffeemaschine();
  assert.deepEqual(plain(Model.normalize(JSON.parse(IO.toJson(m)))), plain(m));
});

test('CSV: BOM, Semikolon, Kategorien, Konzepte', () => {
  const csv = IO.toCsv(kaffeemaschine());
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], '"Titel";"Beispiel: Kaffeemaschine"');
  assert.equal(lines[3], '"Kategorie";"Parameter";"Ausprägung 1";"Ausprägung 2";"Ausprägung 3";"Ausprägung 4"');
  assert.ok(lines.includes('"Brühsystem";"Wassererwärmung";"Durchlauferhitzer";"Boiler";"Thermoblock";"Induktion"'));
  assert.ok(lines.some(l => l.startsWith('"Kompakt-Espresso";"Thermoblock"')));
  assert.ok(!csv.includes('Gesamtkosten'), 'ohne Bewertung keine Kennzahlen');
});

/** Beispiel ohne Notizen und Verträglichkeiten (für die Spaltenprüfung der Bewertung). */
function withoutNotes() {
  const m = kaffeemaschine();
  m.parameters.forEach(p => { p.note = ''; p.options.forEach(o => { o.note = ''; }); });
  m.concepts.forEach(c => { c.note = ''; });
  m.constraints = [];
  return m;
}

test('CSV mit Bewertung: Kennzahlen mit Dezimalkomma', () => {
  const m = withoutNotes();
  m.settings.costs = true;
  m.settings.utility = true;
  const csv = IO.toCsv(m);
  assert.match(csv, /"Kategorie";"Parameter";"Gewicht";"Ausprägung";"Kosten \(EUR\)";"Nutzwert \(0–10\)"/);
  assert.match(csv, /"Kompakt-Espresso";.*;54;7,25;7,45/);
});

test('CSV mit Priorität (MoSCoW)', () => {
  const m = withoutNotes();
  m.settings.moscow = true;
  const csv = IO.toCsv(m);
  assert.match(csv, /"Kategorie";"Parameter";"Ausprägung";"Priorität \(MoSCoW\)"/);
  assert.match(csv, /"Wassererwärmung";"Boiler";"Won't have"/);
});

test('CSV mit Notizen: Beschreibung, Notiz je Ausprägung und Begründung je Konzept', () => {
  const csv = IO.toCsv(kaffeemaschine());
  assert.match(csv, /"Kategorie";"Parameter";"Beschreibung des Parameters";"Ausprägung";"Gewicht \[kg\]";"Lautstärke \[dB\]";"Notiz"\r\n/);
  assert.match(csv, /"Brühsystem";"Druckerzeugung";"Bestimmt Crema-Qualität und Geräuschpegel.";"Vibrationspumpe";0,3;72;"Bis 15 bar/);
  assert.match(csv, /"Brühsystem";"Wassererwärmung";"";"Boiler";1,1;"";""\r\n/);
  assert.match(csv, /"Begründung";"Status";"Grund zum Status"\r\n/);
  assert.match(csv, /"Kompakt-Espresso";.*;"Günstigster Einstieg[^"]*\nOffen: Lautstärke/);
  assert.match(csv, /"Smart Home";.*;"";"Entwurf";""(\r\n|$)/);
  assert.doesNotMatch(IO.toCsv(withoutNotes()), /Notiz|Begründung/);
});

test('CSV mit eigenen Merkmalen: Werte je Ausprägung, Zusammenfassung je Konzept', () => {
  const m = kaffeemaschine();
  m.settings.attributes.push({ id: 'j', name: 'Spülmaschinenfest', description: '', source: '', type: 'bool', unit: '', decimals: 0, levels: [], aggregate: 'count', limit: null });
  m.parameters[5].options[2].values.j = true;
  const csv = IO.toCsv(m);
  assert.match(csv, /"Vibrationspumpe";0,3;72;"";"Bis 15 bar/);
  assert.match(csv, /"Reinigung";"";"Spülmaschinenfest";"";"";"Ja";""\r\n/);
  assert.match(csv, /;"Gewicht \(Summe\) \[kg\]";"Lautstärke \(Maximum\) \[dB\]";"Spülmaschinenfest \(Anzahl Ja\)";/);
  assert.match(csv, /"Kompakt-Espresso";(?:"[^"]*";){6}1,2;72;"0 von 1 Ja";/);
});

test('CSV mit Verträglichkeiten: Liste der Paare und Unverträglichkeiten je Konzept', () => {
  const csv = IO.toCsv(kaffeemaschine());
  assert.match(csv, /"Parameter";"Ausprägung";"Parameter";"Ausprägung";"Verträglichkeit";"Begründung der Verträglichkeit"\r\n/);
  assert.match(csv, /"Wassererwärmung";"Induktion";"Energieversorgung";"Muskelkraft";"Unverträglich";"Induktion braucht elektrische Leistung"/);
  assert.match(csv, /"Kaffeezufuhr";"Bohnen mit Mahlwerk";"Energieversorgung";"Muskelkraft";"Bedingt verträglich";"Nur mit Handmühle"/);
  assert.match(csv, /;"Unverträglichkeiten";"Begründung";"Status";"Grund zum Status"\r\n/);
  assert.match(csv, /"Outdoor";.*;"Induktion ✕ Muskelkraft";"Für Camping/);
  assert.match(csv, /"Smart Home";.*;"";"";"Entwurf";""(\r\n|$)/);
});

test('CSV mit Status: Spalten nur, wenn ein Konzept mehr als „Entwurf“ ist', () => {
  const csv = IO.toCsv(kaffeemaschine());
  assert.match(csv, /"Kompakt-Espresso";[\s\S]*?;"Favorit";""\r\n/);
  assert.match(csv, /"Outdoor";.*;"Verworfen";"Muskelkraft verträgt sich nicht/);
  const m = kaffeemaschine();
  m.concepts.forEach(c => { c.status = 'draft'; c.statusNote = ''; });
  assert.doesNotMatch(IO.toCsv(m), /Grund zum Status/);
});

test('CSV maskiert Anführungszeichen', () => {
  const m = Model.blankState();
  m.title = 'Er sagte "Hallo"';
  assert.match(IO.toCsv(m), /"Er sagte ""Hallo"""/);
});

test('Teilen-Link: Rundreise und ungültige Daten', () => {
  const m = kaffeemaschine();
  m.title = 'Geteilt – mit Ümlauten';
  const back = IO.decodeShareHash(`#m=${IO.encodeShare(m)}`);
  assert.deepEqual(plain(back), plain(m));
  assert.equal(IO.decodeShareHash('#etwas-anderes'), null);
  assert.equal(IO.decodeShareHash(''), null);
  assert.throws(() => IO.decodeShareHash('#m=AAAA'));
});

test('CSV mit mehreren Kriterien: Spalte je Kriterium bei Ausprägungen und Konzepten', () => {
  const m = kaffeemaschine();
  m.settings.utility = true;
  m.settings.criteria = [{ id: 'g', name: 'Geschmack', weight: 3 }, { id: 'k', name: '', weight: 1 }];
  m.parameters[0].options[0].scores = { g: 8, k: 4 };
  const csv = IO.toCsv(m);
  assert.match(csv, /"Ausprägung";"Geschmack \(0–10\)";"Nutzwert \(0–10\)";"Nutzwert \(0–10\)"/);
  assert.match(csv, /"Durchlauferhitzer";8;4;7;/); // 0,75 × 8 + 0,25 × 4
  assert.match(csv, /;"Nutzwert";"Geschmack \(0–10\)";"Nutzwert \(0–10\)"/);
});
