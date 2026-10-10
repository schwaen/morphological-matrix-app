/*
 * Eingabefeld für Zahlen (Kosten, Gewichte, Nutzwerte) – geteilt von Matrix und Kriterien.
 */
import { useState } from 'preact/hooks';
import { fieldProps } from './core.js';
import { Util } from '../util.js';

/**
 * Eingabefeld für Zahlen; speichert beim Tippen, formatiert beim Verlassen. Während der Eingabe
 * bleibt der getippte Text stehen (z. B. „1,“), auch wenn er noch keine gültige Zahl ist.
 * Enter verlässt das Feld – außer `onKeyDown` behandelt die Taste selbst (z. B. Tabelle).
 * @param {{ value: number | null, label: string, placeholder?: string,
 *           apply: (n: number | null) => void, validate?: (n: number) => boolean,
 *           onKeyDown?: (e: KeyboardEvent) => void, [attr: string]: any }} props
 *   weitere Attribute (z. B. `data-*`) gehen an das Eingabefeld
 */
export function NumberField({ value, label, placeholder, apply, validate, onKeyDown, ...attrs }) {
  const [draft, setDraft] = useState(/** @type {string | null} */ (null));
  const text = draft ?? Util.numberToInput(value);
  const n = Util.parseNumber(text);
  const bad = Number.isNaN(n) || (n != null && !!validate && !validate(n));
  const field = fieldProps(v => {
    const parsed = Util.parseNumber(v);
    apply(Number.isNaN(parsed) ? null : parsed);
  });
  return (
    <input
      type="text" inputMode="decimal" class="num-input" value={text}
      placeholder={placeholder} aria-label={label} title={label} aria-invalid={bad || undefined}
      {...attrs}
      {...field}
      onInput={e => { setDraft(/** @type {HTMLInputElement} */ (e.currentTarget).value); field.onInput(e); }}
      onBlur={() => setDraft(null)}
      onKeyDown={e => {
        if (onKeyDown) onKeyDown(e);
        if (!e.defaultPrevented && e.key === 'Enter') /** @type {HTMLElement} */ (e.currentTarget).blur();
      }}
    />
  );
}
