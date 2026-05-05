import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: 'TN09AB1234' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: 'Tempo' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({
    example: 'Available',
    enum: ['Available', 'Active', 'Busy', 'Offline', 'Inactive'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Available', 'Active', 'Busy', 'Offline', 'Inactive'])
  status?: string;
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

  @ApiPropertyOptional({ example: 'TN09AB1234' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: 'Tempo' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({
    example: 'Available',
    enum: ['Available', 'Active', 'Busy', 'Offline', 'Inactive'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Available', 'Active', 'Busy', 'Offline', 'Inactive'])
  status?: string;
}