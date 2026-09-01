import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsPositive,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';


export const PACKAGE_TYPES = [
  'Documents',
  'Electronics',
  'Clothing',
  'Food',
  'Medical Supplies',
  'Fragile Items',
  'Furniture',
  'Retail Goods',
  'Industrial Parts',
  'Other',
] as const;


export class PackageDimensionsDto {
  @ApiProperty({ example: 30 })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  length!: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  width!: number;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  height!: number;

  @ApiProperty({ example: 'cm', enum: ['cm'] })
  @IsString()
  @IsIn(['cm'])
  unit!: string;
}


export class CreateDeliveryDto {
  @ApiProperty({ example: 'Acme Logistics' })
  @IsString()
  customer!: string;

  @ApiPropertyOptional({ example: 'Sarah Johnson' })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiProperty({ example: 'OMR, Chennai' })
  @IsString()
  pickup!: string;

  @ApiProperty({ example: 'Tambaram, Chennai' })
  @IsString()
  dropoff!: string;

  @ApiPropertyOptional({ example: 'Electronics - 2 Laptops, 15kg' })
  @IsOptional()
  @IsString()
  package?: string;

  @ApiProperty({
    example: 'Electronics',
    enum: PACKAGE_TYPES,
  })
  @IsString()
  @IsIn(PACKAGE_TYPES)
  packageType!: string;

  @ApiProperty({ type: PackageDimensionsDto })
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  packageDimensions!: PackageDimensionsDto;

  @ApiProperty({ example: 2.5, description: 'Package weight in kilograms' })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weight!: number;

  @ApiPropertyOptional({ example: 'Express', enum: ['Standard', 'Express'] })
  @IsOptional()
  @IsString()
  @IsIn(['Standard', 'Express'])
  type?: string;

  @ApiPropertyOptional({ example: 'High', enum: ['Low', 'Medium', 'High'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  items?: number;

  @ApiPropertyOptional({ example: 'Special handling needed' })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class BlockDeliveryDto {
  @ApiProperty({ example: 'Suspicious address flagged for review' })
  @IsString()
  reason!: string;
}

export class UnblockDeliveryDto {
  @ApiProperty({ example: 'Address verified, approved for delivery' })
  @IsString()
  reason!: string;
}

export class CancelDeliveryDto {
  @ApiPropertyOptional({ example: 'No longer needed' })
  @IsOptional()
  @IsString()
  reason?: string;
}
