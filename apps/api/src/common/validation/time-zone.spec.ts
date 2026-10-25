import { describe, expect, it } from 'vitest';
import { canonicalTimeZone } from './time-zone';

describe('canonicalTimeZone', () => {
  it('accepts an IANA zone', () => {
    expect(canonicalTimeZone('Europe/Budapest')).toBe('Europe/Budapest');
  });
  it('canonicalises case', () => {
    expect(canonicalTimeZone('utc')).toBe('UTC');
  });
  it('rejects unknown zones', () => {
    expect(canonicalTimeZone('Mars/Base')).toBeNull();
  });
  it('rejects offset strings', () => {
    expect(canonicalTimeZone('+01:00')).toBeNull();
    expect(canonicalTimeZone('-0500')).toBeNull();
  });
});
