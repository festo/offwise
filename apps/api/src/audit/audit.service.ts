import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AUDIT_ACTIONS, type AuditAction } from './audit-actions';
import { AuditEvent } from './audit-event.entity';

export interface AuditEventInput {
  actorUserId: string | null;
  action: AuditAction;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  /** Writes through the caller's manager so the event commits or rolls back with the change. */
  async record(manager: EntityManager, event: AuditEventInput): Promise<void> {
    await manager.insert(AuditEvent, {
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: AUDIT_ACTIONS[event.action],
      entityId: event.entityId ?? null,
      before: (event.before ?? null) as QueryDeepPartialEntity<Record<string, unknown>> | null,
      after: (event.after ?? null) as QueryDeepPartialEntity<Record<string, unknown>> | null,
    });
  }
}
