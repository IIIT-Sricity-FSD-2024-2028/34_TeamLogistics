import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PaySubscriptionDto {
  @IsNotEmpty()
  @IsIn(['Starter', 'Business', 'Enterprise'])
  plan!: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsIn(['success', 'fail'])
  simulate?: string;
}
