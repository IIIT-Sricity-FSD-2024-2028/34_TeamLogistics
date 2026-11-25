import { IsEmail, IsNotEmpty, IsString, IsOptional, Matches, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @Matches(/^\d{6}$/)
  code?: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;

  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
