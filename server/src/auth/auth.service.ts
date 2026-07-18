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

  // null instead of throwing: a valid cookie for a since-deleted user (or one
  // whose tokenVersion no longer matches, e.g. after logout) should read as
  // "logged out", not a 500
  async authenticate(
    session: { userId: string; tokenVersion: number } | null,
  ): Promise<MeResponse | null> {
    if (!session) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        firstName: true,
        profileImgUrl: true,
        maxHr: true,
        tokenVersion: true,
      },
    });
    if (!user || user.tokenVersion !== session.tokenVersion) return null;

    const { tokenVersion: _tokenVersion, ...me } = user;
    return me;
  }

  async invalidateSessions(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}
