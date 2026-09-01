import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Raghav Reddy' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: 'driver@deliverysync.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Pass@123', description: 'Min 8 chars, 1 uppercase, 1 special char' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'driver', enum: ['fleet-manager', 'business-client', 'driver'] })
  @IsString()
  @IsIn(['fleet-manager', 'business-client', 'driver'])
  role!: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ type: Object, description: 'Role-specific profile details' })
  @IsOptional()
  @IsObject()
  profileDetails?: Record<string, any>;
}
