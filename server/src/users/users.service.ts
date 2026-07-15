import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class UsersService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async getMe(userId: string): Promise<{ maxHr: number | null }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { maxHr: true },
    });
    return { maxHr: user.maxHr };
  }

  async updateMaxHr(
    userId: string,
    maxHr: number,
  ): Promise<{ maxHr: number | null }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { maxHr },
      select: { maxHr: true },
    });
    return { maxHr: user.maxHr };
  }
}
