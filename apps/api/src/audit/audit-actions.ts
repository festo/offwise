/** Entity types an audit event can refer to. Stored as varchar; the allowed values live here. */
export const AUDIT_ENTITY_TYPES = ['user', 'settings'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * Every audit action and the entity type it refers to. A module adds its actions here;
 * `AuditService.record` only accepts these and sets `entity_type` from this map.
 */
export const AUDIT_ACTIONS = {
  'user.created': 'user',
  'user.updated': 'user',
  'user.role_changed': 'user',
  'user.closed': 'user',
  'settings.updated': 'settings',
  'auth.login_succeeded': 'user',
  'auth.login_failed': 'user',
  'auth.logout': 'user',
  'auth.password_reset_requested': 'user',
  'auth.password_reset_completed': 'user',
} as const satisfies Record<string, AuditEntityType>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
