import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class SetRateCardDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsPositive()
  baseFare: number;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @IsPositive()
  perKm: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @IsPositive()
  perKg: number;

  @ApiPropertyOptional({ example: 80, description: 'Customer-facing base price' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  customerBaseFare?: number;

  @ApiPropertyOptional({ example: 13, description: 'Customer-facing price per kilometre' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  customerPerKm?: number;

  @ApiPropertyOptional({ example: 8, description: 'Customer-facing price per kilogram' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  customerPerKg?: number;
}
