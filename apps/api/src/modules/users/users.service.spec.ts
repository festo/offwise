import { describe, expect, it } from 'vitest';
import { violatesLastAdmin } from './last-admin';
import { escapeLike, userAuditChanges } from './users.service';

describe('violatesLastAdmin', () => {
  const activeAdmin = { role: 'admin' as const, deletedAt: null };

  it('blocks demoting the last active admin', () => {
    expect(violatesLastAdmin(activeAdmin, { role: 'employee' }, 0)).toBe(true);
  });
  it('blocks closing the last active admin', () => {
    expect(violatesLastAdmin(activeAdmin, 'close', 0)).toBe(true);
  });
  it('allows it when another active admin remains', () => {
    expect(violatesLastAdmin(activeAdmin, { role: 'employee' }, 1)).toBe(false);
    expect(violatesLastAdmin(activeAdmin, 'close', 1)).toBe(false);
  });
  it('allows changes that keep the admin role', () => {
    expect(violatesLastAdmin(activeAdmin, { role: 'admin' }, 0)).toBe(false);
    expect(violatesLastAdmin(activeAdmin, {}, 0)).toBe(false);
  });
  it('ignores non-admins and closed admins', () => {
    expect(violatesLastAdmin({ role: 'manager', deletedAt: null }, 'close', 0)).toBe(false);
    expect(
      violatesLastAdmin({ role: 'admin', deletedAt: new Date() }, { role: 'employee' }, 0),
    ).toBe(false);
  });
});

describe('escapeLike', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
  it('leaves other text alone', () => {
    expect(escapeLike('Grace Hopper')).toBe('Grace Hopper');
  });
});

describe('userAuditChanges', () => {
  const base = {
    name: 'A',
    email: 'a@example.test',
    role: 'employee' as const,
    locale: null,
    timeZone: null,
  };

  it('returns nothing when nothing changed', () => {
    expect(userAuditChanges(base, { ...base })).toEqual({ updated: null, roleChanged: null });
  });
  it('separates the role change from other changed fields', () => {
    expect(userAuditChanges(base, { ...base, name: 'B', role: 'admin' })).toEqual({
      updated: { before: { name: 'A' }, after: { name: 'B' } },
      roleChanged: { before: { role: 'employee' }, after: { role: 'admin' } },
    });
  });
  it('reports a role-only change only as a role change', () => {
    expect(userAuditChanges(base, { ...base, role: 'manager' })).toEqual({
      updated: null,
      roleChanged: { before: { role: 'employee' }, after: { role: 'manager' } },
    });
  });
});
