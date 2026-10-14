import { INestApplication, ValidationPipe } from '@nestjs/common';
import { API_PREFIX } from '@offwise/shared';

/** App-wide wiring shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
