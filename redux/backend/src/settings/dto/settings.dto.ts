import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsArray, IsNumber, Min, Max } from 'class-validator';

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
  @IsInt()
  @Min(8)
  @Max(128)
  passwordLength?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  failedAttempts?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  sessionTimeout?: number;
}

export class UpdatePermissionsDto {
  @ApiProperty({
    description: 'Array of permission entries: [label, description, enabled]',
    example: [['Dashboard Access', 'View platform overview', true]],
  })
  @IsArray()
  permissions: [string, string, boolean][];
}

export class UpdateEconomicsSettingsDto {
  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  @Max(80)
  commissionRate!: number;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  @Max(80)
  minimumFleetMarginPercent!: number;
}
