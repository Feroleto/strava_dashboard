import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

@Injectable()
export class StravaAuthService {
  private readonly logger = new Logger(StravaAuthService.name);
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  buildAuthUrl(): string {
    console.log('CLIENT_ID:', this.config.get('STRAVA_CLIENT_ID'));
    const params = new URLSearchParams({
      client_id: this.config.get<string>('STRAVA_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: this.config.get<string>('STRAVA_REDIRECT_URI')!,
      approval_prompt: 'force',
      scope: 'read,activity:read_all,profile:read_all',
    });

    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.get('STRAVA_CLIENT_ID'),
        client_secret: this.config.get('STRAVA_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Strava token exchange failed: ${response.status} — ${body}`);
    }

    const data = await response.json();

    await this.prisma.stravaAccount.upsert({
      where: { userId },
      update: {
        stravaAthleteId: BigInt(data.athlete.id),
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at * 1000),
      },
      create: {
        userId,
        stravaAthleteId: BigInt(data.athlete.id),
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at * 1000),
      },
    });

    this.logger.log(`Strava account connected for user ${userId} (athlete ${data.athlete.id})`);
  }
}