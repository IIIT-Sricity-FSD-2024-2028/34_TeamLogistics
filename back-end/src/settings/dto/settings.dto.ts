import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ example: 'DeliverSync' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  logo?: string;
}

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  passwordLength?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  failedAttempts?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  sessionTimeout?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  twoFactor?: boolean;
}

export class UpdatePermissionsDto {
  @ApiProperty({
    description: 'Array of permission entries: [label, description, enabled]',
    example: [['Dashboard Access', 'View platform overview', true]],
  })
  @IsArray()
  permissions: [string, string, boolean][];
}
