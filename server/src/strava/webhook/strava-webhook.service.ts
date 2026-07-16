import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class StravaWebhookService {
  private readonly logger = new Logger(StravaWebhookService.name);
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  // deleting the StravaAccount is enough to stop syncAllAccounts (the cron
  // batch) from picking this athlete up again — it iterates
  // stravaAccount.findMany() every run. The User row and their historical
  // activities are left untouched.
  async handleDeauthorization(stravaAthleteId: bigint): Promise<void> {
    const { count } = await this.prisma.stravaAccount.deleteMany({
      where: { stravaAthleteId },
    });

    if (count > 0) {
      this.logger.log(`Athlete ${stravaAthleteId} deauthorized — StravaAccount removed`);
    } else {
      this.logger.warn(
        `Received deauthorization for athlete ${stravaAthleteId}, but no matching StravaAccount was found`,
      );
    }
  }
}
