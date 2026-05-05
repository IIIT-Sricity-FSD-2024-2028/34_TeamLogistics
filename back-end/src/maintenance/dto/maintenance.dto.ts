import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateMaintenanceDto {
  @ApiProperty({ example: 'TN-09-AB-2345' })
  @IsString()
  vehicle: string;

  @ApiProperty({ example: 'Engine Oil Change' })
  @IsString()
  issue: string;

  @ApiProperty({ example: 'High', enum: ['Low', 'Medium', 'High', 'Critical'] })
  @IsString()
  @IsIn(['Low', 'Medium', 'High', 'Critical'])
  priority: string;

  @ApiProperty({ example: '2026-03-10' })
  @IsString()
  date: string;

  @ApiProperty({ example: 'Ravi Auto Service' })
  @IsString()
  mechanic: string;

  @ApiPropertyOptional({ example: '₹1200' })
  @IsOptional()
  @IsString()
  cost?: string;

  @ApiPropertyOptional({ example: 'Check brake fluid' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mechanic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
