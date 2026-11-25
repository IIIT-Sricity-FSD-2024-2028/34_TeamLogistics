import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsArray, ArrayMinSize, ArrayMaxSize, IsNumber, Min, Max } from 'class-validator';

class CargoDto {
  @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3)
  @IsNumber({}, {each: true}) @Min(1, {each: true}) @Max(3000, {each: true})
  cargoCm?: number[];

  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(['Food', 'Medical Supplies', 'Fragile Items', 'Hazardous Goods', 'Refrigerated'], {each: true})
  handling?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({each: true})
  routeIds?: string[];
}

export class CreateVehicleDto extends CargoDto {
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

  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'On Trip', 'Maintenance'] })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'On Trip', 'Maintenance'])
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

export class UpdateVehicleDto extends CargoDto {
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

  @ApiPropertyOptional({ example: 'Maintenance', enum: ['Active', 'On Trip', 'Maintenance'] })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'On Trip', 'Maintenance'])
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
