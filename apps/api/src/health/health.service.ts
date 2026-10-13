import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@offwise/shared';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'error', db: 'down' };
    }
  }
}
