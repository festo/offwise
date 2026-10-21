import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Page, UserDto } from '@offwise/shared';
import { AdminOnly, type AuthenticatedRequest } from '../auth/decorators';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UpdateUserDto } from './dto/update-user.dto';
import { type Actor, UsersService } from './users.service';

const actorOf = (req: AuthenticatedRequest): Actor => ({ userId: req.user.id });

@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery): Promise<Page<UserDto>> {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.users.get(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest): Promise<UserDto> {
    return this.users.create(dto, actorOf(req));
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserDto> {
    return this.users.update(id, dto, actorOf(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  close(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    return this.users.close(id, actorOf(req));
  }
}
