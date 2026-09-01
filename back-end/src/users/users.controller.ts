import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateStatusDto } from './dto/user.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Users')
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'List users',
    description:
      'Returns users. Superuser/fleet manager can view all. Other roles use this for profile loading in frontend.',
  })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email, or role' })
  @ApiResponse({ status: 200, description: 'List of users returned successfully' })
  findAll(@Query('role') role?: string, @Query('search') search?: string, @Req() req?: Request) {
    const users = this.usersService.findAll(role, search);
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;

    if (requester?.role === Role.SUPERUSER || requester?.role === Role.FLEET_MANAGER) {
      return users;
    }

    if (requester?.userId) {
      return users.filter((u: any) => u.id === requester.userId);
    }

    return [];
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (e.g. SU-001)' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };

    if (requester.role === Role.SUPERUSER || requester.role === Role.FLEET_MANAGER) {
      return this.usersService.findOne(id);
    }

    if (requester.userId !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }

    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPERUSER)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Only superuser can create users.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'Update a user',
    description:
      'Superuser/fleet manager can update users. Other roles can update their own profile.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };

    if (requester.role === Role.SUPERUSER || requester.role === Role.FLEET_MANAGER) {
      return this.usersService.update(id, dto);
    }

    if (requester.userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const { role, status, ...safeDto } = dto;
    return this.usersService.update(id, safeDto);
  }

  @Patch(':id/status')
  @Roles(Role.SUPERUSER)
  @ApiOperation({
    summary: 'Update user status',
    description: 'Approve, reject, or suspend a user.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.usersService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };

    if (requester.userId === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    return this.usersService.remove(id);
  }
}
