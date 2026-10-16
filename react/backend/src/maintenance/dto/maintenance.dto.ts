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

  @ApiPropertyOptional({ example: 'MC-003', description: 'Stable mechanic identifier; preferred for new clients' })
  @IsOptional()
  @IsString()
  mechanicId?: string;

  @ApiPropertyOptional({ example: 'Ravi Auto Service', description: 'Legacy mechanic name accepted for compatibility' })
  @IsOptional()
  @IsString()
  mechanic?: string;

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

  @ApiPropertyOptional({ enum: ['Scheduled', 'In Progress', 'Under Maintenance', 'Completed', 'Overdue', 'Cancelled'] })
  @IsOptional()
  @IsString()
  @IsIn(['Scheduled', 'In Progress', 'Under Maintenance', 'Completed', 'Overdue', 'Cancelled'])
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
  mechanicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
