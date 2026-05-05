import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ReassignTripDto {
  @ApiProperty({ example: 'Kiran Teja', description: 'Name of the new driver' })
  @IsString()
  driver: string;
}
