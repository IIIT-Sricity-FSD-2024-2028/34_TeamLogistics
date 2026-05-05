import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  MinLength,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: 'john@deliverysync.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Pass@123', description: 'Min 8 chars, 1 uppercase, 1 special char' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'fleet-manager', enum: ['fleet-manager', 'business-client', 'driver', 'superuser'] })
  @IsString()
  @IsIn(['fleet-manager', 'business-client', 'driver', 'superuser'])
  role!: string;

  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'Pending', 'Suspended'] })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Pending', 'Suspended', 'Pending Approval', 'Rejected'])
  status?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Logistics Inc.' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Acme Logistics Inc.' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: '123 Business Avenue' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ type: Object, description: 'Role-specific profile details' })
  @IsOptional()
  @IsObject()
  profileDetails?: Record<string, any>;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'john@deliverysync.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Pass@123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'fleet-manager' })
  @IsOptional()
  @IsString()
  @IsIn(['fleet-manager', 'business-client', 'driver', 'superuser'])
  role?: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Logistics Inc.' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Acme Logistics Inc.' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: '123 Business Avenue' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  profileDetails?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  notifications?: string[];
}

export class UpdateStatusDto {
  @ApiProperty({ example: 'Active', enum: ['Active', 'Suspended', 'Rejected', 'Pending Approval'] })
  @IsString()
  @IsIn(['Active', 'Suspended', 'Rejected', 'Pending Approval', 'Pending'])
  status!: string;
}