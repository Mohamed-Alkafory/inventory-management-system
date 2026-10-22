import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

import { CurrentUser } from './decorators/current-user.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { Public } from './decorators/public.decorator.js';

@Controller('auth')
export class AuthController{

  constructor(private readonly authService: AuthService) { }

@Get('me')
getMe(@CurrentUser() user: { sub: string; role: string }) {
  return {
    id: user.sub,
    role: user.role,
  };
}

@Get('admin-only')
@Roles('ADMIN')
adminOnly() {
  return { message: 'Welcome, Admin!' };
}
  @Public()
@Post('login')
@HttpCode(HttpStatus.OK)
login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}

  @Public()
@Post('refresh')
@HttpCode(HttpStatus.OK)
refresh(@Body() refreshTokenDto: RefreshTokenDto) {
  return this.authService.refresh(refreshTokenDto);
}

@Post('logout')
@HttpCode(HttpStatus.NO_CONTENT)
logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<void> {
  return this.authService.logout(refreshTokenDto);
}


}
