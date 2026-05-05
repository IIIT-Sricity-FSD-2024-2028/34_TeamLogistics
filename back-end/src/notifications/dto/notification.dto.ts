import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'New delivery request' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Delivery DR-2024-001 needs review.' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'superuser', description: 'Target role to receive the notification' })
  @IsString()
  to: string;
}
