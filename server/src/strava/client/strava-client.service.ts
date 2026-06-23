import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

@Injectable()
export class StravaClientService {
  private readonly logger = new Logger(StravaClientService.name);
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const account = await this.prisma.stravaAccount.findUniqueOrThrow({
      where: { userId },
    });

    if (account.expiresAt > new Date()) {
      return account.accessToken;
    }

    this.logger.log(`Token expired for user ${userId}, refreshing...`);
    return this.refreshToken(userId, account.refreshToken);
  }

  async refreshToken(userId: string, refreshToken: string): Promise<string> {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.get('STRAVA_CLIENT_ID'),
        client_secret: this.config.get('STRAVA_CLIENT_SECRET'),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to refresh Strava token');
    }

    const data = await response.json();

    await this.prisma.stravaAccount.update({
      where: { userId },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at * 1000),
      },
    });

    this.logger.log(`Token refreshed for user ${userId}`);
    return data.access_token;
  }

  async get<T>(userId: string, path: string, params?: Record<string, string | number>): Promise<T> {
    const token = await this.getValidAccessToken(userId);

    const url = new URL(`${STRAVA_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 429) {
      throw new Error('STRAVA_RATE_LIMIT');
    }

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.status} ${path}`);
    }

    return response.json() as Promise<T>;
  }
}