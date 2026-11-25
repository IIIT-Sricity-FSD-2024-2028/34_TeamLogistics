import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SettlementPeriodDto {
  @ApiProperty({ example: 'FM-101' })
  @IsString()
  @IsNotEmpty()
  fleetManagerId!: string;

  @ApiProperty({ example: '2026-10', description: 'Settlement month in YYYY-MM format' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must use YYYY-MM format' })
  month!: string;
}
