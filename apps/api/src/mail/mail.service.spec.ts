import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../config/env.validation';
import { MailService } from './mail.service';

vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => ({ sendMail: vi.fn() })) }));

const env: Partial<EnvironmentVariables> = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: 25,
  SMTP_SECURE: false,
  MAIL_FROM: 'offwise <noreply@example.test>',
};
const config = {
  get: (key: keyof EnvironmentVariables) => env[key],
} as unknown as ConfigService<EnvironmentVariables, true>;

describe('MailService', () => {
  it('bounds SMTP connection, greeting and socket waits to 10 seconds', () => {
    new MailService(config);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.test',
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      }),
    );
  });
});
