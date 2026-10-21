import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { DataSource } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuditService } from '../audit/audit.service';
import { diffFields } from '../audit/diff';
import type { EnvironmentVariables } from '../config/env.validation';
import { createSecretBox, type SecretBox } from './secret-box';
import { Setting } from './setting.entity';
import type { SettingsNamespace } from './settings-namespace';

function flattenErrors(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => [
    ...Object.values(e.constraints ?? {}).map((m) => (prefix ? `${prefix}${m}` : m)),
    ...flattenErrors(e.children ?? [], `${prefix}${e.property}.`),
  ]);
}

@Injectable()
export class SettingsService {
  private readonly box: SecretBox;
  private readonly cache = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.box = createSecretBox(config.get('ENCRYPTION_KEY', { infer: true }));
  }

  /** Stored value over defaults, secret fields decrypted. Cached per namespace per process. */
  async get<T extends object>(ns: SettingsNamespace<T>): Promise<T> {
    const cached = this.cache.get(ns.name);
    if (cached) return { ...cached } as T;
    const row = await this.dataSource.getRepository(Setting).findOneBy({ namespace: ns.name });
    const merged = { ...ns.defaults, ...this.decryptSecrets(ns, row?.value ?? {}) } as Record<
      string,
      unknown
    >;
    this.cache.set(ns.name, merged);
    return { ...merged } as T;
  }

  async set<T extends object>(
    ns: SettingsNamespace<T>,
    value: T,
    actor: { userId: string | null },
  ): Promise<void> {
    const instance = plainToInstance(ns.dto, value);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw new BadRequestException(flattenErrors(errors));
    }

    const plain = instanceToPlain(instance) as Record<string, unknown>;
    const stored = this.encryptSecrets(ns, plain);

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(Setting, { namespace: ns.name });
      const before = existing?.value ?? {};
      // Compare stored forms: ciphertext differs on every encryption, so compare plaintext instead.
      const beforePlain = this.decryptSecrets(ns, { ...before });
      const diff = diffFields(beforePlain, plain, ns.secretFields);
      if (!diff) return;
      await manager.upsert(
        Setting,
        {
          namespace: ns.name,
          value: stored as QueryDeepPartialEntity<Record<string, unknown>>,
          updatedByUserId: actor.userId,
        },
        ['namespace'],
      );
      await this.audit.record(manager, {
        actorUserId: actor.userId,
        action: 'settings.updated',
        entityId: ns.name,
        before: diff.before,
        after: diff.after,
      });
    });
    this.cache.delete(ns.name);
  }

  private encryptSecrets<T extends object>(
    ns: SettingsNamespace<T>,
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const out = { ...value };
    for (const field of ns.secretFields) {
      if (typeof out[field] === 'string') out[field] = this.box.encrypt(out[field]);
    }
    return out;
  }

  private decryptSecrets<T extends object>(
    ns: SettingsNamespace<T>,
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const out = { ...value };
    for (const field of ns.secretFields) {
      if (typeof out[field] === 'string') out[field] = this.box.decrypt(out[field]);
    }
    return out;
  }
}
