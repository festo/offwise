import type { TransformFnParams } from 'class-transformer';
import { canonicalLocale } from '../../../common/validation/locale';
import { canonicalTimeZone } from '../../../common/validation/time-zone';

/** Trims strings; leaves anything else for the validators to reject. */
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Canonical locale when valid; otherwise the raw value, so `@IsBcp47Locale` rejects it. */
export const toCanonicalLocale = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? (canonicalLocale(value) ?? value) : value;

/** Canonical time zone when valid; otherwise the raw value, so `@IsIanaTimeZone` rejects it. */
export const toCanonicalTimeZone = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? (canonicalTimeZone(value) ?? value) : value;
