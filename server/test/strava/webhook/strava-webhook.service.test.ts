import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StravaWebhookService } from 'src/strava/webhook/strava-webhook.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      stravaAccount: {
        deleteMany: vi.fn(),
      },
    },
  };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(function (this: any) {
      return mockPrisma;
    }),
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: class {},
  };
});

describe('StravaWebhookService', () => {
  let service: StravaWebhookService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaWebhookService,
        { provide: ConfigService, useValue: { get: vi.fn(() => 'postgresql://test') } },
      ],
    }).compile();

    service = module.get(StravaWebhookService);
  });

  it('deletes the StravaAccount matching the deauthorized athlete', async () => {
    mockPrisma.stravaAccount.deleteMany.mockResolvedValueOnce({ count: 1 });

    await service.handleDeauthorization(105494700n);

    expect(mockPrisma.stravaAccount.deleteMany).toHaveBeenCalledWith({
      where: { stravaAthleteId: 105494700n },
    });
  });

  it('does not throw when no matching account is found (already disconnected)', async () => {
    mockPrisma.stravaAccount.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.handleDeauthorization(999n)).resolves.toBeUndefined();
  });
});
