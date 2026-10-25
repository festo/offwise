import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@offwise/shared';
import type { Response } from 'express';
import { Public } from '../modules/auth/decorators';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async get(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    if (result.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
