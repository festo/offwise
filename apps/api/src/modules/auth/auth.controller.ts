import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@offwise/shared';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { type AuthenticatedRequest, AuthUser, Public } from './decorators';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';
import { clearSessionCookieOptions, SESSION_COOKIE, sessionCookieOptions } from './session-cookie';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  private readonly nodeEnv: EnvironmentVariables['NODE_ENV'];

  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly sessions: SessionService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.nodeEnv = config.get('NODE_ENV', { infer: true });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUser> {
    const { user, sessionId } = await this.auth.login(dto.email, dto.password, req.ip ?? null);
    const previous: unknown = req.signedCookies?.[SESSION_COOKIE];
    if (typeof previous === 'string' && previous !== '') await this.auth.discardSession(previous);
    res.cookie(
      SESSION_COOKIE,
      sessionId,
      sessionCookieOptions(this.nodeEnv, this.sessions.lifetime.absoluteMs),
    );
    return this.auth.toCurrentUser(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req.sessionId, req.user);
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions(this.nodeEnv));
  }

  @Get('me')
  me(@AuthUser() user: User): Promise<CurrentUser> {
    return this.auth.toCurrentUser(user);
  }

  @Public()
  @Post('password-reset')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(@Body() dto: PasswordResetDto): Promise<void> {
    await this.passwordReset.request(dto.email);
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    await this.passwordReset.confirm(dto.token, dto.password);
  }
}
