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
  Headers,
  ForbiddenException,
} from '@nestjs/common';
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
  findAll(
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Headers('x-user-role') userRole?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const users = this.usersService.findAll(role, search);

    // Admin roles can view all users
    if (userRole === Role.SUPERUSER || userRole === Role.FLEET_MANAGER) {
      return users;
    }

    // If frontend sends x-user-id, return only that user's profile
    if (userId) {
      return users.filter((u: any) => u.id === userId);
    }

    // Demo fallback: return users matching current role
    if (userRole) {
      return users.filter((u: any) => u.role === userRole);
    }

    return users;
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (e.g. SU-001)' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(
    @Param('id') id: string,
    @Headers('x-user-role') userRole?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    // Admin roles can view any profile
    if (userRole === Role.SUPERUSER || userRole === Role.FLEET_MANAGER) {
      return this.usersService.findOne(id);
    }

    // If x-user-id is provided, enforce own-profile rule
    if (userId && userId !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }

    // Demo fallback: allow if x-user-id is missing
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
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Headers('x-user-role') userRole?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    // Admin roles can update any profile
    if (userRole === Role.SUPERUSER || userRole === Role.FLEET_MANAGER) {
      return this.usersService.update(id, dto);
    }

    // If x-user-id exists, enforce own-profile update rule
    if (userId && userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Demo fallback: allow update when x-user-id is missing
    return this.usersService.update(id, dto);
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
  remove(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    if (userId === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    return this.usersService.remove(id);
  }
}