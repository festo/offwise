import { USER_EMAIL_MAX_LENGTH, type PasswordResetRequest } from '@offwise/shared';
import { IsEmail, MaxLength } from 'class-validator';

export class PasswordResetDto implements PasswordResetRequest {
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email!: string;
}
