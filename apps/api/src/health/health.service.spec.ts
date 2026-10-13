import type { DataSource } from 'typeorm';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { HealthService } from './health.service';

function serviceWith(query: Mock): HealthService {
  return new HealthService({ query } as unknown as DataSource);
}

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    await expect(serviceWith(query).check()).resolves.toEqual({ status: 'ok', db: 'up' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports error when the database query fails', async () => {
    const query = vi.fn().mockRejectedValue(new Error('connection refused'));
    await expect(serviceWith(query).check()).resolves.toEqual({ status: 'error', db: 'down' });
  });
});
