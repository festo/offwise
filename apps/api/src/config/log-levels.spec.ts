import { describe, expect, it } from 'vitest';
import { toNestLogLevels } from './log-levels';

describe('toNestLogLevels', () => {
  it('maps error to fatal and error only', () => {
    expect(toNestLogLevels('error')).toEqual(['fatal', 'error']);
  });

  it('maps warn to fatal, error and warn', () => {
    expect(toNestLogLevels('warn')).toEqual(['fatal', 'error', 'warn']);
  });

  it('maps info to Nest "log" and everything more severe', () => {
    expect(toNestLogLevels('info')).toEqual(['fatal', 'error', 'warn', 'log']);
  });

  it('includes debug but not verbose for debug', () => {
    expect(toNestLogLevels('debug')).toEqual(['fatal', 'error', 'warn', 'log', 'debug']);
  });
});
