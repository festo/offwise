import { describe, expect, it } from 'vitest';
import { diffFields } from './diff';

describe('diffFields', () => {
  it('returns null when nothing changed', () => {
    expect(diffFields({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toBeNull();
  });
  it('returns only changed keys', () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({
      before: { b: 2 },
      after: { b: 3 },
    });
  });
  it('handles added and removed keys', () => {
    expect(diffFields({ a: 1 }, { b: 2 })).toEqual({ before: { a: 1 }, after: { b: 2 } });
  });
  it('compares nested objects by value', () => {
    expect(diffFields({ o: { x: 1 } }, { o: { x: 2 } })).toEqual({
      before: { o: { x: 1 } },
      after: { o: { x: 2 } },
    });
  });
  it('ignores key order in nested objects', () => {
    expect(
      diffFields({ o: { x: 1, y: { p: 1, q: 2 } } }, { o: { y: { q: 2, p: 1 }, x: 1 } }),
    ).toBeNull();
  });
  it('treats array order as a change', () => {
    expect(diffFields({ l: [1, 2] }, { l: [2, 1] })).toEqual({
      before: { l: [1, 2] },
      after: { l: [2, 1] },
    });
  });
  it('compares dates by value', () => {
    expect(diffFields({ d: new Date('2026-01-01') }, { d: new Date('2026-01-01') })).toBeNull();
  });
  it('redacts listed keys', () => {
    expect(diffFields({ k: 'old', n: 1 }, { k: 'new', n: 2 }, ['k'])).toEqual({
      before: { k: '[redacted]', n: 1 },
      after: { k: '[redacted]', n: 2 },
    });
  });
});
