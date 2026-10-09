# Mitgelieferte Beispiele

Jedes Beispiel steht als JSON-Datei in diesem Ordner. Die App zeigt alle eingetragenen Beispiele unter **Datei → Beispiele …** bzw. **+ → Beispiel öffnen …**. Das erste Beispiel erscheint außerdem beim allerersten Start; es ist fest in die App eingebunden, alle übrigen lädt der Browser erst, wenn die Auswahl geöffnet wird.

## Aufbau einer Beispiel-Datei

```json
{
  "id": "kaffeemaschine",
  "name": "Kaffeemaschine",
  "description": "Kurze Beschreibung …",
  "data": { "version": 5, "title": "…", … }
}
```

- `id`: eindeutig, gleich dem Dateinamen ohne `.json`
- `name`: Name in der Auswahl
- `description`: optional, erscheint in der Auswahl
- `data`: Matrix genau im Format einer mit **Datei → Als JSON speichern** exportierten Datei ([`docs/DATENFORMAT.md`](../docs/DATENFORMAT.md))

## Neues Beispiel hinzufügen

1. Matrix in der App erstellen und über **Datei → Als JSON speichern** exportieren.
2. Neue Datei `examples/<id>.json` anlegen (Kleinbuchstaben und Bindestriche, z. B. `e-bike-antrieb.json`) und den Inhalt der exportierten Datei als `data` einsetzen.
3. In `js/examples.js` die id in die Liste `IDS` eintragen – die Reihenfolge dort ist die Reihenfolge in der Auswahl.
4. `npm run test:unit` ausführen: Der Test prüft, dass jede Datei eingetragen ist und dass jedes Beispiel vollständig ist (id = Dateiname, aktuelles Datenformat, keine ungültigen Verweise oder doppelten IDs).

Ein Beispiel entfernen: Datei löschen und den Eintrag in `js/examples.js` entfernen.
