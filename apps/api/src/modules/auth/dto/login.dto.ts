import { PASSWORD_MAX_LENGTH, USER_EMAIL_MAX_LENGTH, type LoginRequest } from '@offwise/shared';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email!: string;

  // Only an upper bound: a shorter password simply fails verification. The bound caps Argon2 work.
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
