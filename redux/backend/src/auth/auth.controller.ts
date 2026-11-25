import { writeStagedUpload, finishUpload } from '../documents/upload-journal';
import { scanUpload } from '../documents/scan-upload';
import { BadRequestException, Body, Controller, Post, Req, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Roles, Role } from '../common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { randomUUID } from 'crypto';
import { DataStoreService } from '../data-store/data-store.service';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly store: DataStoreService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Authenticate a user against the backend user records' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('session')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async browserSession(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    if (!result.token) return result;
    const { token, ...profile } = result;
    response.cookie('ds-' + profile.userId, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', path: '/api', maxAge: dto.remember ? profile.expiresInMinutes! * 60_000 : undefined });
    return { ...profile, cookieSession: true };
  }

  @Post('logout')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  logout(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const id = (req as any).user.userId;
    const user = this.store.users.find((u) => u.id === id)!;
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    this.store.persistUsers();
    response.clearCookie('ds-' + id, { path: '/api' });
    return { signedOut: true };
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Request a one-time password reset code' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Reset a password using a valid one-time code' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('register-driver')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'licence', maxCount: 1 }, { name: 'bank', maxCount: 1 }],
    { limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 1, fieldSize: 16384 } }))
  async registerDriver(@Body('application') application: string, @UploadedFiles() files: Record<string, Express.Multer.File[]>) {
    let dto: RegisterDto;
    try {
      dto = plainToInstance(RegisterDto, JSON.parse(application));
      await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true });
    } catch {
      throw new BadRequestException('Invalid driver registration details');
    }
    if (dto.role !== 'driver') throw new BadRequestException('Expected driver registration');
    const evidence = [files?.licence?.[0], files?.bank?.[0]];
    for (const file of evidence) {
      if (!file || !file.buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
        throw new BadRequestException('Upload a PNG for both the licence and bank document');
      }
    }
    for (const file of evidence) await scanUpload(file.buffer);
    const staged: string[] = [];
    try {
      return this.store.atomic(() => {
        const docs = evidence.map((file, index) => {
          const id = randomUUID();
          const name = id + '.png';
          writeStagedUpload(name,file.buffer);
          staged.push(name);
          return { id, ownerType: 'registration', documentType: index === 0 ? 'Licence' : 'Bank document',
            fileUrl: '/uploads/documents/' + name, fileName: file.originalname, status: 'Submitted' };
        });
        dto.profileDetails = { ...dto.profileDetails, licenseDocument: docs[0].fileName,
          licenseDocumentId: docs[0].id, bankBook: docs[1].fileName, bankDocumentId: docs[1].id };
        const result = this.authService.register(dto);
        this.store.documents.push(...docs.map((doc) => ({ ...doc, uploadedBy: result.userId })));
        this.store.persistDocuments();
        return result;
      });
    } finally {
      for (const name of staged) finishUpload(name, this.store.documents.some(doc => doc.fileUrl?.endsWith('/'+name)));
    }
  }

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Self-register a new fleet manager, business client, or driver account (requires superuser approval before login)' })
  register(@Body() dto: RegisterDto) {
    if (dto.role === 'driver') throw new BadRequestException('Use driver registration with licence and bank documents');
    return this.authService.register(dto);
  }
}
