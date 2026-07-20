import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../../strava/client/strava-client.service';
import {
  RawActivitySecond,
  StreamProcessor,
} from '../../strava/sync/processors/streams-processor';
import { ProcessedSecond } from '../../strava/sync/types';
import { StravaStreamSet } from '../../strava/sync/strava-api.types';

// thrown when the per-second stream can't be produced at all (Strava fetch
// failed — deleted/revoked activity, network error, rate limit, etc.) —
// distinct from "activity not found", which callers signal by returning null
export class StreamUnavailableError extends Error {}

interface CacheEntry {
  points: ProcessedSecond[];
  source: 'stored' | 'strava';
  expiresAt: number;
}

// short-lived so a single lap-edit session (open panel -> save) doesn't hit
// the Strava API twice for the same activity, without needing a real cache
// invalidation story — same "simple in-memory state" spirit as isSyncing/progress
const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ActivityStreamsService {
  private readonly logger = new Logger(ActivityStreamsService.name);
  private readonly prisma: PrismaClient;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly client: StravaClientService,
  ) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  // null = activity doesn't exist or doesn't belong to this user
  async getStream(
    userId: string,
    activityId: string,
  ): Promise<{ points: ProcessedSecond[]; source: 'stored' | 'strava' } | null> {
    const cached = this.cache.get(activityId);
    if (cached && cached.expiresAt > Date.now()) {
      const owned = await this.prisma.activity.findFirst({
        where: { id: activityId, userId },
        select: { id: true },
      });
      if (!owned) return null;
      return { points: cached.points, source: cached.source };
    }

    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, userId },
      select: { stravaId: true },
    });
    if (!activity) return null;

    const stored = await this.prisma.activitySecond.findMany({
      where: { activityId },
      orderBy: { secondIndex: 'asc' },
    });

    let points: ProcessedSecond[];
    let source: 'stored' | 'strava';

    if (stored.length > 0) {
      const raw: RawActivitySecond[] = stored.map((s) => ({
        secondIndex: s.secondIndex,
        distanceTotalM: s.distanceTotalM,
        heartRate: s.heartRate,
        elevationM: s.elevationM,
        cadence: s.cadence,
      }));
      points = StreamProcessor.processStreams(raw);
      source = 'stored';
    } else {
      points = await this.fetchFromStrava(userId, activity.stravaId);
      source = 'strava';
    }

    this.cache.set(activityId, {
      points,
      source,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return { points, source };
  }

  private async fetchFromStrava(
    userId: string,
    stravaId: bigint,
  ): Promise<ProcessedSecond[]> {
    let rawStreams: StravaStreamSet;
    try {
      rawStreams = await this.client.get<StravaStreamSet>(
        userId,
        `/activities/${stravaId}/streams`,
        {
          keys: 'time,distance,velocity_smooth,heartrate,altitude,cadence',
          key_by_type: 'true',
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to fetch streams for activity ${stravaId}: ${(err as Error).message}`,
      );
      throw new StreamUnavailableError(
        `Could not fetch streams for activity ${stravaId}`,
      );
    }

    const timeStream = rawStreams['time']?.data ?? [];
    if (timeStream.length === 0) {
      throw new StreamUnavailableError(
        `Strava returned no stream data for activity ${stravaId}`,
      );
    }

    const distStream = rawStreams['distance']?.data ?? [];
    const hrStream = rawStreams['heartrate']?.data ?? [];
    const altStream = rawStreams['altitude']?.data ?? [];
    // Strava reports cadence in rpm (one leg) even for runs — ×2 to spm,
    // same convention as Activity.averageCadence/ActivityLap.avgCadence
    const cadStream = rawStreams['cadence']?.data ?? [];

    const raw: RawActivitySecond[] = timeStream.map((t, i) => ({
      secondIndex: t,
      distanceTotalM: distStream[i] ?? 0,
      heartRate: hrStream[i] ?? null,
      elevationM: altStream[i] ?? null,
      cadence: cadStream[i] != null ? cadStream[i] * 2 : null,
    }));

    return StreamProcessor.processStreams(raw);
  }
}
