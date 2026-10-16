import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class NotifyDriverComplianceDto {
  @ApiProperty({ example: 'Your Driver License has expired. Please renew it to restore compliance.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  message!: string;
}

export class CreateDriverDto {
  @ApiProperty({ example: 'Raghav Reddy' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: 'driver@deliverysync.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+91 9440011223' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'TN03201800034521' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2028-12-31', description: 'Driver License expiry date in YYYY-MM-DD format' })
  @IsOptional()
  @IsString()
  licenseExpiry?: string;

  @ApiPropertyOptional({ example: 'TN09AB1234' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: 'Tempo' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'Chennai North' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ example: 'TN03201800034521' })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiPropertyOptional({
    example: 'Available',
    enum: ['Available', 'Active', 'On Duty', 'Busy', 'Offline', 'Inactive', 'Suspended', 'Rejected', 'Document Review'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Available', 'Active', 'On Duty', 'Busy', 'Offline', 'Inactive', 'Suspended', 'Rejected', 'Document Review'])
  status?: string;

  @ApiPropertyOptional({ example: 'Pass@123', description: 'Creates a login account for the driver when provided' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ type: Object, description: 'License and bank details collected during driver registration' })
  @IsOptional()
  @IsObject()
  profileDetails?: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

  @ApiPropertyOptional({ example: '2026-10-12' })
  @IsOptional()
  @IsString()
  termsVersion?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional({ example: 'Raghav Reddy' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({ example: 'driver@deliverysync.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+91 9440011223' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'TN03201800034521' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2028-12-31', description: 'Driver License expiry date in YYYY-MM-DD format' })
  @IsOptional()
  @IsString()
  licenseExpiry?: string;

  @ApiPropertyOptional({ example: 'TN09AB1234' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: 'Tempo' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'Chennai North' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ example: 'TN03201800034521' })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiPropertyOptional({
    example: 'Available',
    enum: ['Available', 'Active', 'On Duty', 'Busy', 'Offline', 'Inactive', 'Suspended', 'Rejected', 'Document Review'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Available', 'Active', 'On Duty', 'Busy', 'Offline', 'Inactive', 'Suspended', 'Rejected', 'Document Review'])
  status?: string;
}
