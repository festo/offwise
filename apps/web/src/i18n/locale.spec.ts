import { afterEach, describe, expect, it } from 'vitest';
import { i18n, setLocaleFromTag } from './index';

afterEach(() => {
  setLocaleFromTag('en');
});

describe('setLocaleFromTag', () => {
  it('falls back to en when the language is not available and keeps the full tag on <html>', () => {
    setLocaleFromTag('hu-HU');
    expect(i18n.global.locale.value).toBe('en');
    expect(document.documentElement.lang).toBe('hu-HU');
  });

  it('maps en-GB to en', () => {
    setLocaleFromTag('en-GB');
    expect(i18n.global.locale.value).toBe('en');
    expect(document.documentElement.lang).toBe('en-GB');
  });
});
