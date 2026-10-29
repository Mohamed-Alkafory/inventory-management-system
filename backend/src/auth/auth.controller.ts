import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type AuthUserResponse } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

import { CurrentUser } from './decorators/current-user.decorator.js';
import { AnyAuthenticated } from './decorators/any-authenticated.decorator.js';
import { RequirePermission } from './decorators/require-permission.decorator.js';
import { Public } from './decorators/public.decorator.js';

/** JWT payload resolved by the global `JwtAuthGuard`. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Authenticated: the full public profile of the current user (#54). */
  @Get('me')
  @AnyAuthenticated()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponse> {
    return this.authService.me(user.sub);
  }

  /**
   * Authenticated: update own `name` and/or `password` (#54). `role`,
   * `email` and `isActive` are not editable here (ADMIN manages them).
   */
  @Patch('me')
  @AnyAuthenticated()
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserResponse> {
    return this.authService.updateMe(user.sub, dto);
  }

  /**
   * Authenticated: change the password by proving the current one (#54).
   * All active refresh tokens are revoked; answers 204.
   */
  @Post('change-password')
  @AnyAuthenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(user.sub, dto);
  }

  /**
   * Authenticated: self-deactivation (#54). Deactivates the account, revokes
   * every active refresh token (this device included) and answers 204.
   * Reactivation stays ADMIN-only.
   */
  @Delete('me')
  @AnyAuthenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.deactivate(user.sub);
  }

  @Get('admin-only')
  @RequirePermission('auth.admin_only')
  adminOnly() {
    return { message: 'Welcome, Admin!' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** Public sign-up (always creates a CUSTOMER account). Stricter rate limit. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @AnyAuthenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(refreshTokenDto);
  }
}
