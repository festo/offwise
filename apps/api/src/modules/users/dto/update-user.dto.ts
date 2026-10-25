import {
  ROLES,
  type Role,
  type UpdateUserRequest,
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '@offwise/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsBcp47Locale } from '../../../common/validation/locale';
import { IsIanaTimeZone } from '../../../common/validation/time-zone';
import { toCanonicalLocale, toCanonicalTimeZone, trim } from './transforms';

/** Omitted fields stay unchanged. `name`, `email` and `role` cannot be null; `locale` and `timeZone` null means the company default. */
export class UpdateUserDto implements UpdateUserRequest {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @Transform(toCanonicalLocale)
  @IsBcp47Locale()
  locale?: string | null;

  @IsOptional()
  @Transform(toCanonicalTimeZone)
  @IsIanaTimeZone()
  timeZone?: string | null;
}
