import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

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
