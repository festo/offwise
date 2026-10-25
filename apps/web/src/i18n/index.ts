import { createI18n } from 'vue-i18n';
import en from './locales/en.json';

const messages = { en };

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
});

const availableLocales: string[] = Object.keys(messages);

/**
 * Switches the UI language to the language subtag of a BCP 47 tag (`hu-HU` -> `hu`) when that
 * translation exists, otherwise to `en`. `<html lang>` keeps the full tag.
 */
export function setLocaleFromTag(tag: string): void {
  const language = tag.split('-')[0]?.toLowerCase() ?? '';
  i18n.global.locale.value = (availableLocales.includes(language) ? language : 'en') as 'en';
  document.documentElement.lang = tag;
}
