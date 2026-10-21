import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../../config/env.validation';
import { CsrfGuard } from './csrf.guard';

const config = {
  get: (key: string) => (key === 'PUBLIC_URL' ? 'https://leave.example.com' : undefined),
} as unknown as ConfigService<EnvironmentVariables, true>;

const guard = new CsrfGuard(config);

function context(method: string, headers: Record<string, string> = {}): ExecutionContext {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const req = { method, headers: lower, header: (name: string) => lower[name.toLowerCase()] };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const XRW = { 'X-Requested-With': 'offwise' };

describe('CsrfGuard', () => {
  it('lets GET through without any headers', () => {
    expect(guard.canActivate(context('GET'))).toBe(true);
  });

  it('rejects POST without X-Requested-With', () => {
    expect(() => guard.canActivate(context('POST', { 'Sec-Fetch-Site': 'same-origin' }))).toThrow(
      ForbiddenException,
    );
  });

  it('compares the X-Requested-With value case-sensitively', () => {
    expect(() =>
      guard.canActivate(
        context('POST', { 'X-Requested-With': 'Offwise', 'Sec-Fetch-Site': 'same-origin' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts the header with Sec-Fetch-Site: same-origin', () => {
    expect(guard.canActivate(context('POST', { ...XRW, 'Sec-Fetch-Site': 'same-origin' }))).toBe(
      true,
    );
  });

  it.each(['cross-site', 'same-site', 'none'])('rejects Sec-Fetch-Site: %s', (site) => {
    expect(() =>
      guard.canActivate(
        context('POST', { ...XRW, 'Sec-Fetch-Site': site, Origin: 'https://leave.example.com' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts a matching Origin when Sec-Fetch-Site is absent', () => {
    expect(
      guard.canActivate(context('POST', { ...XRW, Origin: 'https://leave.example.com' })),
    ).toBe(true);
  });

  it('rejects a foreign Origin', () => {
    expect(() =>
      guard.canActivate(context('POST', { ...XRW, Origin: 'https://evil.example' })),
    ).toThrow(ForbiddenException);
  });

  it('rejects Origin: null', () => {
    expect(() => guard.canActivate(context('POST', { ...XRW, Origin: 'null' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when neither Sec-Fetch-Site nor Origin is present', () => {
    expect(() => guard.canActivate(context('POST', XRW))).toThrow(ForbiddenException);
  });

  it.each(['PUT', 'PATCH', 'DELETE'])('also checks %s', (method) => {
    expect(() => guard.canActivate(context(method))).toThrow(ForbiddenException);
  });
});
