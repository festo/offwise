import type { INestApplication } from '@nestjs/common';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@offwise/shared';
import request from 'supertest';
import { SESSION_COOKIE } from '../../src/modules/auth/session-cookie';
import { TEST_PUBLIC_URL } from '../test-env';

/**
 * A supertest agent that sends the CSRF headers the web app sends (`X-Requested-With` and a
 * same-origin `Origin`). They are default headers, so GETs carry them too, which is harmless.
 */
export function api(app: INestApplication): request.Agent {
  return request
    .agent(app.getHttpServer())
    .set(CSRF_HEADER, CSRF_HEADER_VALUE)
    .set('Origin', TEST_PUBLIC_URL);
}

/** `name=value` of the session cookie in a response, or undefined. */
export function sessionCookieFrom(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const all = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return all
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.split(';')[0]
    ?.trim();
}

/**
 * Signs in and returns an `api()` agent carrying the session cookie. The cookie is set explicitly
 * because it is `Secure` outside development and the agent's jar does not send it over http.
 */
export async function signIn(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ agent: request.Agent; cookie: string }> {
  const res = await api(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`signIn(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error(`signIn(${email}): no ${SESSION_COOKIE} cookie in the response`);
  return { agent: api(app).set('Cookie', cookie), cookie };
}
