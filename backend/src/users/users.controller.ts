import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { AnyAuthenticated } from '../auth/decorators/any-authenticated.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UsersService, type UserResponse } from './users.service.js';
import {
  MAX_AVATAR_SIZE_BYTES,
  type UploadedImageFile,
} from '../storage/image-storage.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users.query.dto.js';

/** Users management requires `users.manage`; avatars are own-account routes. */
@ApiTags('users')
@ApiBearerAuth()
@RequirePermission('users.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Upload or replace the CURRENT user's avatar. There is deliberately no id
   * parameter, so an admin can never change someone else's avatar here.
   */
  @Post('me/avatar')
  @AnyAuthenticated()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    // Memory storage lets the service inspect magic bytes before writing.
    FileInterceptor('image', {
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Avatar image file (max 1 MB; JPEG, PNG or WebP)',
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload or replace the current user avatar',
    description:
      'Multipart field `image`; the stored `avatarUrl` is a relative `/uploads/avatars/...` path. The previous local file is deleted.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user with the new avatarUrl',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing file or unsupported image type',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'Image is larger than 1 MB',
  })
  uploadAvatar(
    @UploadedFile() image: UploadedImageFile | undefined,
    @CurrentUser() user: { sub: string },
  ): Promise<UserResponse> {
    return this.usersService.updateAvatar(user.sub, image);
  }

  @Delete('me/avatar')
  @AnyAuthenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the current user avatar',
    description:
      'Clears `avatarUrl` and removes the local file. External avatar URLs are never deleted from disk.',
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Avatar removed' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  removeAvatar(@CurrentUser() user: { sub: string }): Promise<void> {
    return this.usersService.removeAvatar(user.sub);
  }

  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.update(id, updateUserDto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ): Promise<void> {
    return this.usersService.deactivate(id, user.sub);
  }
}
