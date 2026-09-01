import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

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
}
