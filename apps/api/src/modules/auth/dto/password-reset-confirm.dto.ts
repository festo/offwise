import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordResetConfirmRequest,
} from '@offwise/shared';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class PasswordResetConfirmDto implements PasswordResetConfirmRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
