import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  USER_EMAIL_MAX_LENGTH,
  type UserListQuery,
} from '@offwise/shared';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { trim } from './transforms';

/** Query strings carry `'true'`/`'false'`; anything else stays a string and fails `@IsBoolean`. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListUsersQuery implements UserListQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  // Matches name or email; no search term can be longer than the longer of the two.
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeClosed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
