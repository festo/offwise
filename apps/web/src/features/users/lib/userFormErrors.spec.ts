import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import { ApiError } from '@/lib/api';
import { userFormErrors } from './userFormErrors';

const t = i18n.global.t;

describe('userFormErrors', () => {
  it('maps a duplicate email to a translated email field error', () => {
    const error = new ApiError(409, 'Email taken', {
      statusCode: 409,
      message: 'x',
      field: 'email',
    });
    expect(userFormErrors(error, t)).toEqual({
      field: 'email',
      message: 'Another user already has this email.',
    });
  });

  it('keeps the last-admin rule', () => {
    const error = new ApiError(409, 'x', { statusCode: 409, message: 'x', rule: 'last-admin' });
    expect(userFormErrors(error, t)).toEqual({ rule: 'last-admin' });
  });

  it('maps a validation failure to a form-level message', () => {
    const error = new ApiError(400, 'locale must be valid', null);
    expect(userFormErrors(error, t)).toEqual({
      message: 'Some values were not accepted. Check the email, locale and time zone.',
    });
  });

  it('maps anything else to the generic message', () => {
    expect(userFormErrors(new ApiError(500, 'boom', null), t)).toEqual({
      message: 'Something went wrong. Try again.',
    });
    expect(userFormErrors(new Error('offline'), t)).toEqual({
      message: 'Something went wrong. Try again.',
    });
  });
});
