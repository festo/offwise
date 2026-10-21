import { describe, expect, it } from 'vitest';
import { companyDefaultsStep } from './company-defaults.step';
import { companySettings } from './company.settings';

describe('companyDefaultsStep', () => {
  it('has the permanent name', () => {
    expect(companyDefaultsStep.name).toBe('company.defaults');
  });
  it('seeds the documented defaults', () => {
    expect(companySettings.name).toBe('company');
    expect(companySettings.defaults).toEqual({ name: 'offwise', locale: 'en-GB' });
  });
});
