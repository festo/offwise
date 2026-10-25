import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS } from './audit-actions';
import { AuditService } from './audit.service';

function fakeManager() {
  const insert = vi.fn().mockResolvedValue(undefined);
  return { manager: { insert } as unknown as EntityManager, insert };
}

describe('AuditService.record', () => {
  it("derives the entity type from the action's registry entry", async () => {
    const { manager, insert } = fakeManager();
    await new AuditService().record(manager, {
      actorUserId: null,
      action: 'auth.login_failed',
      entityId: 'u1',
    });
    await new AuditService().record(manager, {
      actorUserId: 'u1',
      action: 'settings.updated',
      entityId: 'company',
    });
    expect(insert.mock.calls[0]![1]).toMatchObject({
      action: 'auth.login_failed',
      entityType: 'user',
    });
    expect(insert.mock.calls[1]![1]).toMatchObject({
      action: 'settings.updated',
      entityType: 'settings',
    });
  });

  it('rejects an unknown action at compile time', async () => {
    const { manager } = fakeManager();
    // @ts-expect-error 'user.creatd' is not a registered audit action
    await new AuditService().record(manager, { actorUserId: null, action: 'user.creatd' });
  });

  it('names actions <area>.<event> in snake_case', () => {
    for (const action of Object.keys(AUDIT_ACTIONS)) {
      expect(action).toMatch(/^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/);
    }
  });
});
