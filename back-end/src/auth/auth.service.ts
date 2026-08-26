import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataStoreService } from '../data-store/data-store.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly store: DataStoreService) {}

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

    if (user.password !== dto.password) {
      throw new UnauthorizedException('Incorrect password');
    }

    user.lastLogin = new Date().toISOString();
    this.store.persistUsers();

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
