import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsBoolean,
  IsUUID,
  Matches,
  IsOptional,
  IsNumber,
  IsIn,
  IsPositive,
  Max,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';


export const PACKAGE_TYPES = [
  'Documents',
  'Electronics',
  'Clothing',
  'Food',
  'Medical Supplies',
  'Fragile Items',
  'Hazardous Goods',
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
  @IsOptional() @IsString() clientUserId?: string;
  @IsOptional() @IsNumber({maxDecimalPlaces:2}) quotedTotal?: number;
  @IsOptional() @IsBoolean() refrigerated?: boolean;
  @Matches(/^\+[1-9]\d{7,14}$/)
  recipientPhone!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  alternatePhone?: string;

  @IsString()
  phoneVerification!: string;

  @IsOptional()
  @IsUUID('4')
  bookingKey?: string;
  @ApiProperty()
  @IsString()
  routeId!: string;

  @ApiProperty()
  @IsEmail()
  recipientEmail!: string;

  @ApiProperty()
  @Matches(/\S/)
  recipientName!: string;

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

  @ApiPropertyOptional({ example: '2026-10-14T09:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  preferredDeliveryAt?: string;
}

export class DeliveryQuoteDto {
  @IsOptional() @IsBoolean() refrigerated?: boolean;
  @IsOptional() @IsIn(PACKAGE_TYPES) packageType?: string;
  @ApiProperty()
  @IsString()
  routeId!: string;

  @ApiProperty({ type: PackageDimensionsDto })
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  packageDimensions!: PackageDimensionsDto;

  @ApiProperty({ example: 2.5, description: 'Package weight in kilograms' })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weight!: number;

  @ApiPropertyOptional({ example: 'Standard', enum: ['Standard', 'Express'] })
  @IsOptional()
  @IsString()
  @IsIn(['Standard', 'Express'])
  type?: string;
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

export class HandoffRecipientDto {
  @Matches(/\S/)
  recipientName!: string;

  @IsEmail()
  recipientEmail!: string;
}

export class CancelDeliveryDto {
  @ApiPropertyOptional({ example: 'No longer needed' })
  @IsOptional()
  @IsString()
  reason?: string;
}
