import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Canonical BCP 47 form (`en-gb` -> `en-GB`), or null when `value` is not a well-formed tag. */
export function canonicalLocale(value: string): string | null {
  // Underscores, whitespace and single-letter "languages" are not valid language tags for us.
  if (!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(value)) return null;
  try {
    return Intl.getCanonicalLocales(value)[0] ?? null;
  } catch {
    return null;
  }
}

/** Valid only when the value is already canonical; pair with `@Transform` using `canonicalLocale`. */
export function IsBcp47Locale(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isBcp47Locale',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: '$property must be a valid BCP 47 locale', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && canonicalLocale(value) === value,
      },
    });
  };
}
