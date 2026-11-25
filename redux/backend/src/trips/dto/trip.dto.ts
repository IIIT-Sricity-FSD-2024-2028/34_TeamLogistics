import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class TripLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsISO8601()
  measuredAt?: string;
}

export class ReassignTripDto {
  @ApiProperty({ example: 'DR-301', description: 'New driver ID or unambiguous legacy driver name' })
  @IsString()
  driver: string;
}
