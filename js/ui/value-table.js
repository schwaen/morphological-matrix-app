/*
 * Gemeinsamer Tabellendialog für die Werte aller Ausprägungen mit den Reitern „Nutzwert“
 * (js/ui/criteria.jsx) und „Eigene Merkmale“ (js/ui/attributes.jsx). Hier nur der Zustand,
 * damit beide Module ihn ohne gegenseitigen Import öffnen können.
 */
import { signal } from '@preact/signals';
import { $, openDialog } from './dom.jsx';
import { selectField } from './fields.jsx';

/** Tabelle geöffnet (nur dann wird sie gezeichnet). */
export const tableOpen = signal(false);
/** @typedef {'utility' | 'attributes'} TableTab */
/** Gewählter Reiter. */
export const tableTab = signal(/** @type {TableTab} */ ('utility'));

/** Dialog mit dem Reiter öffnen und das erste Feld fokussieren. @param {TableTab} tab */
export function openValueTable(tab) {
  tableTab.value = tab;
  tableOpen.value = true;
  openDialog($('#scoreDialog'));
  selectField(/** @type {HTMLElement | null} */ ($('#scoreDialog').querySelector('[data-r="0"][data-c="0"]')));
}
