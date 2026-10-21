import { describe, expect, it } from 'vitest';
import { passwordResetEmail } from './password-reset';

const link = 'http://localhost:5173/reset-password#token=abc_DEF-123';

describe('passwordResetEmail', () => {
  it('has the subject', () => {
    expect(passwordResetEmail({ name: 'Ada', link }).subject).toBe('Reset your offwise password');
  });

  it('puts the link and the expiry in both parts', () => {
    const mail = passwordResetEmail({ name: 'Ada', link });
    for (const part of [mail.text, mail.html]) {
      expect(part).toContain(link);
      expect(part).toContain('1 hour');
    }
  });

  it('escapes the name in the HTML part', () => {
    const mail = passwordResetEmail({ name: '<b>Eve</b>', link });
    expect(mail.html).not.toContain('<b>Eve</b>');
    expect(mail.html).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(mail.text).toContain('<b>Eve</b>');
  });
});
