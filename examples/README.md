# Mitgelieferte Beispiele

Jedes Beispiel steht in einer eigenen Datei in diesem Ordner. Die App zeigt alle eingebundenen Beispiele unter **Datei → Beispiele …** bzw. **+ → Beispiel öffnen …**. Das erste eingebundene Beispiel erscheint außerdem beim allerersten Start.

## Aufbau einer Beispiel-Datei

```js
Examples.register({
  "id": "kaffeemaschine",                  // eindeutig, gleich dem Dateinamen ohne .js
  "name": "Kaffeemaschine",                // Name in der Auswahl
  "description": "Kurze Beschreibung …",   // optional, erscheint in der Auswahl
  "data": { "version": 3, "title": "…", … } // Matrix im Format des JSON-Exports
});
```

`data` hat genau das Format einer mit **Datei → Als JSON speichern** exportierten Datei ([`docs/DATENFORMAT.md`](../docs/DATENFORMAT.md)).

> **Warum `.js` und nicht `.json`?** Die App läuft ohne Server direkt per `file://`. Dort dürfen Browser keine JSON-Dateien nachladen, Skripte aber schon. Die Datei enthält daher nur die Daten, umschlossen von `Examples.register(…)`.

## Neues Beispiel hinzufügen

1. Matrix in der App erstellen und über **Datei → Als JSON speichern** exportieren.
2. Neue Datei `examples/<id>.js` anlegen (Kleinbuchstaben und Bindestriche, z. B. `e-bike-antrieb.js`), mit `Examples.register({ "id": "<id>", "name": "…", "description": "…", "data": <Inhalt der JSON-Datei> });` füllen.
3. In `index.html` bei den übrigen Beispielen einbinden – die Reihenfolge dort ist die Reihenfolge in der Auswahl:
   ```html
   <script src="examples/<id>.js" defer></script>
   ```
4. `npm run test:unit` ausführen: Der Test prüft jede eingebundene Datei (id = Dateiname, aktuelles Datenformat, keine ungültigen Verweise oder doppelten IDs).

Ein Beispiel entfernen: Datei löschen und die Zeile in `index.html` entfernen.
