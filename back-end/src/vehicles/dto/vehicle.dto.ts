import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: 'TN09AB1234' })
  @IsString()
  plate!: string;

  @ApiProperty({ example: 'Mini Truck', enum: ['Mini Truck', 'Van', 'Truck', 'Bike', 'SUV', 'Cargo Van'] })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ example: '2 Tons' })
  @IsOptional()
  @IsString()
  capacity?: string;

  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'On Trip', 'Maintenance', 'Blocked'] })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'On Trip', 'Maintenance', 'Blocked'])
  status?: string;

  @ApiPropertyOptional({ example: 'Raghav Reddy' })
  @IsOptional()
  @IsString()
  assignedDriver?: string;

  @ApiPropertyOptional({ example: '2026-05-03', description: 'Last maintenance date in YYYY-MM-DD format' })
  @IsOptional()
  @IsString()
  maintenance?: string;

  @ApiPropertyOptional({ example: '2026-05-03', description: 'Alias for maintenance date' })
  @IsOptional()
  @IsString()
  lastMaintenance?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'TN09AB1234' })
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional({ example: 'Van', enum: ['Mini Truck', 'Van', 'Truck', 'Bike', 'SUV', 'Cargo Van'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: '1 Ton' })
  @IsOptional()
  @IsString()
  capacity?: string;

  @ApiPropertyOptional({ example: 'Maintenance', enum: ['Active', 'On Trip', 'Maintenance', 'Blocked'] })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'On Trip', 'Maintenance', 'Blocked'])
  status?: string;

  @ApiPropertyOptional({ example: 'Kiran Teja' })
  @IsOptional()
  @IsString()
  assignedDriver?: string;

  @ApiPropertyOptional({ example: '2026-05-03', description: 'Last maintenance date in YYYY-MM-DD format' })
  @IsOptional()
  @IsString()
  maintenance?: string;

  @ApiPropertyOptional({ example: '2026-05-03', description: 'Alias for maintenance date' })
  @IsOptional()
  @IsString()
  lastMaintenance?: string;
}