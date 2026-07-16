import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface MeResponse {
  id: string;
  firstName: string | null;
  profileImgUrl: string | null;
  maxHr: number | null;
}

@Injectable()
export class AuthService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async getMe(userId: string): Promise<MeResponse> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, firstName: true, profileImgUrl: true, maxHr: true },
    });
  }
}
