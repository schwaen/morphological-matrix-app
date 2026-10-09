/*
 * Vor jeder Testdatei: Die App wählt ihre Sprache beim Laden nach `navigator.language`;
 * Standard in den Tests ist Deutsch. Englisch: in der Testdatei per `vi.hoisted` umstellen
 * (siehe util-en.test.js). Jede Testdatei lädt die App-Module neu.
 */
import { vi } from 'vitest';

vi.stubGlobal('navigator', { language: 'de-DE' });
