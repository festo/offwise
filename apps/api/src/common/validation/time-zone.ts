import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Canonical IANA zone name (`utc` -> `UTC`), or null when unknown. */
export function canonicalTimeZone(value: string): string | null {
  // Node accepts UTC-offset strings such as '+01:00'; they are not IANA zones.
  if (value === '' || value.startsWith('+') || value.startsWith('-')) return null;
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Valid only when the value is already canonical; pair with `@Transform` using `canonicalTimeZone`. */
export function IsIanaTimeZone(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: '$property must be a valid IANA time zone', ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && canonicalTimeZone(value) === value,
      },
    });
  };
}
