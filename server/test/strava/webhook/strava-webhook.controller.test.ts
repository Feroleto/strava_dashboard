import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StravaWebhookController } from 'src/strava/webhook/strava-webhook.controller';
import { StravaWebhookService } from 'src/strava/webhook/strava-webhook.service';

const VERIFY_TOKEN = 'test-verify-token';

describe('StravaWebhookController', () => {
  let controller: StravaWebhookController;
  let service: { handleDeauthorization: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { handleDeauthorization: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StravaWebhookController],
      providers: [
        { provide: StravaWebhookService, useValue: service },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) => {
              if (key === 'STRAVA_WEBHOOK_VERIFY_TOKEN') return VERIFY_TOKEN;
              throw new Error(`Config key not found: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(StravaWebhookController);
  });

  describe('verify (GET challenge)', () => {
    it('echoes the challenge back when the verify token matches', () => {
      const result = controller.verify({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'abc123',
      });

      expect(result).toEqual({ 'hub.challenge': 'abc123' });
    });

    it('rejects a request with the wrong verify token', () => {
      expect(() =>
        controller.verify({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'abc123',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('handleEvent (POST)', () => {
    it('deauthorizes the account when the athlete revokes access', async () => {
      await controller.handleEvent({
        object_type: 'athlete',
        aspect_type: 'update',
        object_id: 105494700,
        updates: { authorized: 'false' },
      });

      expect(service.handleDeauthorization).toHaveBeenCalledWith(105494700n);
    });

    it('ignores unrelated events (e.g. activity create) without touching the account', async () => {
      const result = await controller.handleEvent({
        object_type: 'activity',
        aspect_type: 'create',
        object_id: 999,
      });

      expect(service.handleDeauthorization).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });
});
