import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DataStoreService } from '../data-store/data-store.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

function passwordMatches(plain: string, stored: string): boolean {
  const isBcryptHash = /^\$2[aby]\$/.test(stored || '');
  return isBcryptHash ? bcrypt.compareSync(plain, stored) : plain === stored;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly store: DataStoreService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  register(dto: RegisterDto) {
    const user = this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      status: 'Pending Approval',
      phone: dto.phone,
      profileDetails: dto.profileDetails,
    } as any);

    return {
      message: 'Registration submitted. An administrator must approve your account before you can sign in.',
      userId: user.id,
      status: user.status,
    };
  }

  login(dto: LoginDto) {
    const email = String(dto.email || '').toLowerCase().trim();
    const user = this.store.users.find((u) => String(u.email || '').toLowerCase().trim() === email);

    if (!user) {
      throw new NotFoundException('No account found for this email');
    }

    const status = String(user.status || '').toLowerCase();

    if (status === 'pending approval') {
      throw new ForbiddenException('Your account is awaiting super user approval');
    }

    if (status === 'rejected' || status === 'suspended') {
      throw new ForbiddenException('Your account is not allowed to sign in');
    }

    if (!passwordMatches(dto.password, user.password)) {
      throw new UnauthorizedException('Incorrect password');
    }

    user.lastLogin = new Date().toISOString();
    this.store.persistUsers();

    const token = this.jwtService.sign({ sub: user.id, role: user.role });

    return {
      token,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
