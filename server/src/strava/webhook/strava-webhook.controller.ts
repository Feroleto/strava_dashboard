import { BadRequestException, Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StravaWebhookService } from './strava-webhook.service';

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  aspect_type: 'create' | 'update' | 'delete';
  object_id: number;
  updates?: Record<string, string>;
}

// no AuthGuard here by design: Strava calls these two endpoints directly and
// sends no session cookie. The subscription verify_token (checked below) is
// the only gate on the GET challenge; the POST event has no per-request
// auth at all — that's inherent to Strava's webhook design, not something
// this app can add. Worst case a forged deauth event disconnects the wrong
// account by mistake, which the affected user just reconnects — an
// acceptable risk for a small trusted beta group
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
    const expectedToken = this.config.getOrThrow<string>('STRAVA_WEBHOOK_VERIFY_TOKEN');

    if (mode !== 'subscribe' || token !== expectedToken) {
      throw new BadRequestException('Invalid webhook verification request');
    }

    return { 'hub.challenge': challenge };
  }

  @Post()
  async handleEvent(@Body() event: StravaWebhookEvent): Promise<{ received: true }> {
    if (event.object_type === 'athlete' && event.updates?.authorized === 'false') {
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
