import * as Flex from '@twilio/flex-ui';
import { dynCifStrings, RTL_LOCALES } from './strings';

const DEFAULT_LOCALE = 'en-US';

/**
 * Pick the best locale key we have strings for, gated by what Flex actually offers.
 * - exact match: we have strings AND Flex offers the active tag
 * - language-prefix match: active 'ja-JP' → our 'ja' (Flex must still offer the active tag)
 * - otherwise fall back to en-US
 */
export function resolveLocale(active: string, availableTags: string[]): string {
  const available = new Set(availableTags);
  if (dynCifStrings[active] && available.has(active)) return active;
  const prefix = active.split('-')[0];
  if (available.has(active) && dynCifStrings[prefix]) return prefix;
  return DEFAULT_LOCALE;
}

/** Merge our localized UI labels into `manager.strings` for the active locale. */
export function mergeDynCifStrings(manager: Flex.Manager): void {
  const localization = manager.localization;
  const active = localization?.localeTag ?? DEFAULT_LOCALE;
  const availableTags = (localization?.availableLocales ?? []).map((l) => l.tag);
  const resolved = resolveLocale(active, availableTags);

  manager.strings = { ...manager.strings, ...dynCifStrings[resolved] } as Flex.Strings;

  if (typeof document !== 'undefined') {
    document.documentElement.dir = RTL_LOCALES.includes(resolved) ? 'rtl' : 'ltr';
  }
}
