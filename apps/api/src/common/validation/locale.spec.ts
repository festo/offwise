import { describe, expect, it } from 'vitest';
import { canonicalLocale } from './locale';

describe('canonicalLocale', () => {
  it.each([
    ['en-gb', 'en-GB'],
    ['EN', 'en'],
    ['hu-HU', 'hu-HU'],
  ])('canonicalises %s to %s', (input, expected) => {
    expect(canonicalLocale(input)).toBe(expected);
  });

  it.each(['en_GB', '', 'x'])('rejects %j', (input) => {
    expect(canonicalLocale(input)).toBeNull();
  });
});
