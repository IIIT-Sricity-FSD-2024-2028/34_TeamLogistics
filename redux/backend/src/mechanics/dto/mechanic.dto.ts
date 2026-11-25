import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateMechanicDto {
  @ApiProperty({ example: 'AutoCare Pro' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'name must contain at least one non-whitespace character' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateMechanicDto {
  @ApiPropertyOptional({ example: 'AutoCare Pro' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'name must contain at least one non-whitespace character' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
