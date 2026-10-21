export interface PasswordResetEmailInput {
  name: string;
  link: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function passwordResetEmail({ name, link }: PasswordResetEmailInput): RenderedEmail {
  const subject = 'Reset your offwise password';
  const text = [
    `Hi ${name},`,
    '',
    'Someone asked to reset the password for your offwise account. Open this link to choose a new one:',
    '',
    link,
    '',
    'The link expires in 1 hour and works once. If you did not ask for this, ignore this email; your password stays the same.',
  ].join('\n');
  const safeLink = escapeHtml(link);
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>Someone asked to reset the password for your offwise account. Open this link to choose a new one:</p>
<p><a href="${safeLink}">${safeLink}</a></p>
<p>The link expires in 1 hour and works once. If you did not ask for this, ignore this email; your password stays the same.</p>`;
  return { subject, text, html };
}
