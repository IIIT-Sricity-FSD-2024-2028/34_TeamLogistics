import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTransactionDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsNotEmpty()
  @IsString()
  client!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  deliveryId?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  receiptName?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  client!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  deliveryId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  baseCost?: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsNumber()
  total?: number;
}