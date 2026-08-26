import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'vehicle', enum: ['vehicle', 'driver', 'delivery', 'business-client'] })
  @IsString()
  @IsIn(['vehicle', 'driver', 'delivery', 'business-client'])
  ownerType!: string;

  @ApiPropertyOptional({ example: 'TN-09-AB-2345' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: 'Rajesh Kumar' })
  @IsOptional()
  @IsString()
  driver?: string;

  @ApiPropertyOptional({ example: 'DR-2024-001' })
  @IsOptional()
  @IsString()
  delivery?: string;

  @ApiProperty({ example: 'Registration' })
  @IsString()
  documentType!: string;

  @ApiPropertyOptional({ example: '2025-04-01' })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Valid', enum: ['Valid', 'Expiring Soon', 'Expired'] })
  @IsOptional()
  @IsString()
  @IsIn(['Valid', 'Expiring Soon', 'Expired'])
  status?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ example: 'vehicle', enum: ['vehicle', 'driver'] })
  @IsOptional()
  @IsString()
  @IsIn(['vehicle', 'driver'])
  ownerType?: string;

  @ApiPropertyOptional({ example: 'TN-09-AB-2345' })
  @IsOptional()
  @IsString()
  vehicle?: string;

  @ApiPropertyOptional({ example: 'Rajesh Kumar' })
  @IsOptional()
  @IsString()
  driver?: string;

  @ApiPropertyOptional({ example: 'Insurance' })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({ example: '2025-04-01' })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Valid', enum: ['Valid', 'Expiring Soon', 'Expired'] })
  @IsOptional()
  @IsString()
  @IsIn(['Valid', 'Expiring Soon', 'Expired'])
  status?: string;
}