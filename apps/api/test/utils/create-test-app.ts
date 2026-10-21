import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

/** The full app as main.ts builds it. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  // Listening on an ephemeral port up front: supertest otherwise calls listen() on the unbound
  // server for every request and leaks 'listening'/'error' listeners (MaxListenersExceededWarning).
  await app.listen(0);
  return app;
}
