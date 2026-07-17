import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { StravaWebhookService } from './strava-webhook.service';

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  aspect_type: 'create' | 'update' | 'delete';
  object_id: number;
  subscription_id: number;
  owner_id: number;
  event_time: number;
  updates?: Record<string, string>;
}

// no AuthGuard here by design: Strava calls these two endpoints directly and
// sends no session cookie. The subscription verify_token (checked below) is
// the only gate on the GET challenge; Strava never resends it on POST
// events, and Strava doesn't sign webhook events (no X-Strava-Signature or
// equivalent — confirmed against the official docs, not just assumed). The
// best available check on the POST body is subscription_id (see below),
// which the Strava dev community itself notes is "guessable" in theory —
// not airtight, but real. Worst case a forged event still only disconnects
// the wrong account, which the affected user just reconnects — acceptable
// residual risk for a small trusted beta group
@Controller('strava/webhook')
export class StravaWebhookController {
  private readonly logger = new Logger(StravaWebhookController.name);

  constructor(
    private readonly service: StravaWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  verify(@Query() query: Record<string, string>) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = this.config.getOrThrow<string>(
      'STRAVA_WEBHOOK_VERIFY_TOKEN',
    );

    if (mode !== 'subscribe' || token !== expectedToken) {
      throw new BadRequestException('Invalid webhook verification request');
    }

    return { 'hub.challenge': challenge };
  }

  // limit generous enough for Strava's own retry/burst behavior, tight
  // enough to cut off anonymous POST abuse
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  async handleEvent(
    @Body() event: StravaWebhookEvent,
  ): Promise<{ received: true }> {
    const expectedSubscriptionId = this.config.getOrThrow<string>(
      'STRAVA_WEBHOOK_SUBSCRIPTION_ID',
    );
    if (String(event.subscription_id) !== expectedSubscriptionId) {
      this.logger.warn(
        `Ignored webhook event with unexpected subscription_id ${event.subscription_id} (expected ${expectedSubscriptionId})`,
      );
      return { received: true };
    }

    if (
      event.object_type === 'athlete' &&
      event.updates?.authorized === 'false'
    ) {
      await this.service.handleDeauthorization(BigInt(event.object_id));
    } else {
      this.logger.debug(
        `Ignored webhook event: ${event.object_type}/${event.aspect_type} (${event.object_id})`,
      );
    }

    // Strava expects a fast 200 ack regardless of what we did with the event
    return { received: true };
  }
}
