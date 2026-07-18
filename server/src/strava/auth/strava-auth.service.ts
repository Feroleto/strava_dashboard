import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

interface StravaTokenExchangeResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string | null;
    profile: string | null;
  };
}

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

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('STRAVA_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: this.config.get<string>('STRAVA_REDIRECT_URI')!,
      approval_prompt: 'force',
      scope: 'read,activity:read_all,profile:read_all',
      state,
    });

    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  // exchanges the OAuth code for tokens, then finds or creates the User
  // whose StravaAccount matches the returned athlete id — this is both the
  // "authorize sync" flow and the login flow, they're the same action here
  async handleCallback(code: string): Promise<{ userId: string; tokenVersion: number }> {
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

    const data = (await response.json()) as StravaTokenExchangeResponse;
    const stravaAthleteId = BigInt(data.athlete.id);
    const tokenFields = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
    };

    const existing = await this.prisma.stravaAccount.findUnique({
      where: { stravaAthleteId },
    });

    if (existing) {
      const [, updatedUser] = await this.prisma.$transaction([
        this.prisma.stravaAccount.update({
          where: { stravaAthleteId },
          data: tokenFields,
        }),
        this.prisma.user.update({
          where: { id: existing.userId },
          data: {
            firstName: data.athlete.firstname,
            profileImgUrl: data.athlete.profile,
          },
        }),
      ]);

      this.logger.log(`Strava account reconnected for user ${existing.userId}`);
      return { userId: existing.userId, tokenVersion: updatedUser.tokenVersion };
    }

    const user = await this.prisma.user.create({
      data: {
        firstName: data.athlete.firstname,
        profileImgUrl: data.athlete.profile,
        stravaAccount: {
          create: { stravaAthleteId, ...tokenFields },
        },
      },
    });

    this.logger.log(`New user created ${user.id} (athlete ${data.athlete.id})`);
    return { userId: user.id, tokenVersion: user.tokenVersion };
  }
}
