import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX } from '@offwise/shared';
import cookieParser from 'cookie-parser';
import type { EnvironmentVariables } from './config/env.validation';
import { ThrottledExceptionFilter } from './modules/auth/throttled-exception.filter';

/** App-wide wiring shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  // req.ip (per-IP login throttling) is the client address behind the TRUST_PROXY proxies.
  (app.getHttpAdapter().getInstance() as { set(setting: string, value: unknown): void }).set(
    'trust proxy',
    config.get('TRUST_PROXY', { infer: true }),
  );
  app.setGlobalPrefix(API_PREFIX);
  // Signed cookies (the session cookie) are verified with SESSION_SECRET.
  app.use(cookieParser(config.get('SESSION_SECRET', { infer: true })));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ThrottledExceptionFilter());
}
