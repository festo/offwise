import { isDeepStrictEqual } from 'node:util';

const REDACTED = '[redacted]';

/** Keys whose values differ (deep value equality; object key order is ignored). Redacted keys are masked. Null when unchanged. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  redact: readonly string[] = [],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  let changed = false;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (isDeepStrictEqual(before[key], after[key])) continue;
    changed = true;
    const masked = redact.includes(key);
    if (key in before) beforeOut[key] = masked ? REDACTED : before[key];
    if (key in after) afterOut[key] = masked ? REDACTED : after[key];
  }
  return changed ? { before: beforeOut, after: afterOut } : null;
}
