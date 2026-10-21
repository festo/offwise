import type { INestApplication } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditEvent } from '../src/audit/audit-event.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { Setting } from '../src/settings/setting.entity';
import type { SettingsNamespace } from '../src/settings/settings-namespace';
import { SettingsService } from '../src/settings/settings.service';
import { createTestApp } from './utils/create-test-app';
import { resetDatabase } from './utils/reset-database';

class SampleDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;
  @IsString() @IsOptional() apiKey?: string;
}

const sample: SettingsNamespace<SampleDto> = {
  name: 'test.sample',
  dto: SampleDto,
  defaults: { title: 'Default' },
  secretFields: ['apiKey'],
};

describe('SettingsService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let settings: SettingsService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    settings = app.get(SettingsService);
  });
  beforeEach(async () => {
    await resetDatabase(dataSource);
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns defaults when no row exists', async () => {
    await expect(settings.get(sample)).resolves.toEqual({ title: 'Default' });
  });

  it('stores, encrypts secrets at rest, and reads back decrypted', async () => {
    await settings.set(sample, { title: 'Hi', apiKey: 'sekret' }, { userId: null });

    await expect(settings.get(sample)).resolves.toEqual({ title: 'Hi', apiKey: 'sekret' });
    const row = await dataSource
      .getRepository(Setting)
      .findOneByOrFail({ namespace: 'test.sample' });
    expect(row.value.title).toBe('Hi');
    expect(String(row.value.apiKey).startsWith('v1.')).toBe(true);
  });

  it('rejects invalid values and writes nothing', async () => {
    await expect(
      settings.set(sample, { title: 5 } as unknown as SampleDto, { userId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await dataSource.getRepository(Setting).count()).toBe(0);
    expect(await dataSource.getRepository(AuditEvent).count()).toBe(0);
  });

  it('audits the update with secrets redacted', async () => {
    await settings.set(sample, { title: 'Hi', apiKey: 'sekret' }, { userId: null });

    const events = await dataSource.getRepository(AuditEvent).find();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'settings.updated',
      entityType: 'settings',
      entityId: 'test.sample',
      after: { title: 'Hi', apiKey: '[redacted]' },
    });
    expect(JSON.stringify(events[0])).not.toContain('sekret');
  });

  it('audits before and actor on a change', async () => {
    const user = await dataSource.getRepository(User).save({ email: 'a@x.io', name: 'A' });
    await settings.set(sample, { title: 'One' }, { userId: user.id });
    await settings.set(sample, { title: 'Two' }, { userId: user.id });

    const events = await dataSource
      .getRepository(AuditEvent)
      .find({ order: { occurredAt: 'ASC' } });
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      actorUserId: user.id,
      before: { title: 'One' },
      after: { title: 'Two' },
    });
  });

  it('does not audit when nothing changed', async () => {
    await settings.set(sample, { title: 'Same' }, { userId: null });
    await settings.set(sample, { title: 'Same' }, { userId: null });
    expect(await dataSource.getRepository(AuditEvent).count()).toBe(1);
  });

  it('get after set returns the new value (cache invalidated)', async () => {
    await settings.set(sample, { title: 'A' }, { userId: null });
    await expect(settings.get(sample)).resolves.toEqual({ title: 'A' });
    await settings.set(sample, { title: 'B' }, { userId: null });
    await expect(settings.get(sample)).resolves.toEqual({ title: 'B' });
  });

  it('stores the transformed value', async () => {
    await settings.set(sample, { title: '  Padded  ' }, { userId: null });
    await expect(settings.get(sample)).resolves.toEqual({ title: 'Padded' });
  });

  it('flattens nested validation errors', async () => {
    class Inner {
      @IsString() name!: string;
    }
    class Outer {
      @ValidateNested() @Type(() => Inner) inner!: Inner;
    }
    const nested: SettingsNamespace<Outer> = {
      name: 'test.nested',
      dto: Outer,
      defaults: { inner: { name: 'x' } },
      secretFields: [],
    };
    const err = await settings
      .set(nested, { inner: { name: 5 } } as unknown as Outer, { userId: null })
      .catch((e: BadRequestException) => e);
    expect(JSON.stringify((err as BadRequestException).getResponse())).toContain(
      'name must be a string',
    );
  });

  it('a second app instance reads the stored value', async () => {
    await settings.set(sample, { title: 'Shared' }, { userId: null });
    const other = await createTestApp();
    try {
      await expect(other.get(SettingsService).get(sample)).resolves.toEqual({ title: 'Shared' });
    } finally {
      await other.close();
    }
  });
});
