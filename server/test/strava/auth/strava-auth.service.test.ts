import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StravaAccountConflictError, StravaAuthService } from 'src/strava/auth/strava-auth.service';
import { EmailService } from 'src/email/email.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      stravaAccount: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
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

const ATHLETE_ID = 105494700n;
const EXISTING_USER_ID = 'user_existing';
const OTHER_USER_ID = 'user_other';

function tokenExchangeResponse() {
  return {
    ok: true,
    json: async () => ({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 1_700_000_000,
      athlete: { id: Number(ATHLETE_ID), firstname: 'Guilherme', profile: 'https://x/avatar.jpg' },
    }),
  };
}

describe('StravaAuthService.handleCallback', () => {
  let service: StravaAuthService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue(tokenExchangeResponse());
    vi.stubGlobal('fetch', fetchMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaAuthService,
        { provide: ConfigService, useValue: { get: vi.fn(() => 'test-value') } },
        { provide: EmailService, useValue: { sendWelcomeEmail: vi.fn() } },
      ],
    }).compile();

    service = module.get(StravaAuthService);
  });

  it('creates a new User+StravaAccount when nothing exists and there is no existingUserId (plain login)', async () => {
    mockPrisma.stravaAccount.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: 'user_new', tokenVersion: 0 });

    const result = await service.handleCallback('code', null);

    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.stravaAccount.create).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: 'user_new', tokenVersion: 0 });
  });

  it('creates only a StravaAccount (no new User) when nothing exists and existingUserId is present (connect)', async () => {
    mockPrisma.stravaAccount.findUnique.mockResolvedValueOnce(null);
    mockPrisma.stravaAccount.create.mockResolvedValueOnce({
      user: { tokenVersion: 3 },
    });

    const result = await service.handleCallback('code', EXISTING_USER_ID);

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.stravaAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: EXISTING_USER_ID, stravaAthleteId: ATHLETE_ID }),
      select: { user: { select: { tokenVersion: true } } },
    });
    expect(result).toEqual({ userId: EXISTING_USER_ID, tokenVersion: 3 });
  });

  it('refreshes tokens when the account already belongs to the same existingUserId (reconnect)', async () => {
    mockPrisma.stravaAccount.findUnique.mockResolvedValueOnce({
      userId: EXISTING_USER_ID,
      stravaAthleteId: ATHLETE_ID,
    });
    mockPrisma.$transaction.mockResolvedValueOnce([
      {},
      { tokenVersion: 5 },
    ]);

    const result = await service.handleCallback('code', EXISTING_USER_ID);

    expect(mockPrisma.stravaAccount.create).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: EXISTING_USER_ID, tokenVersion: 5 });
  });

  it('refreshes tokens the same way for a plain login into an already-linked account', async () => {
    mockPrisma.stravaAccount.findUnique.mockResolvedValueOnce({
      userId: EXISTING_USER_ID,
      stravaAthleteId: ATHLETE_ID,
    });
    mockPrisma.$transaction.mockResolvedValueOnce([{}, { tokenVersion: 5 }]);

    const result = await service.handleCallback('code', null);

    expect(result).toEqual({ userId: EXISTING_USER_ID, tokenVersion: 5 });
  });

  it('throws StravaAccountConflictError when the account belongs to a different user, without writing anything', async () => {
    mockPrisma.stravaAccount.findUnique.mockResolvedValueOnce({
      userId: OTHER_USER_ID,
      stravaAthleteId: ATHLETE_ID,
    });

    await expect(service.handleCallback('code', EXISTING_USER_ID)).rejects.toThrow(
      StravaAccountConflictError,
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.stravaAccount.create).not.toHaveBeenCalled();
  });
});

describe('StravaAuthService.disconnectAccount', () => {
  let service: StravaAuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaAuthService,
        { provide: ConfigService, useValue: { get: vi.fn(() => 'test-value') } },
        { provide: EmailService, useValue: { sendWelcomeEmail: vi.fn() } },
      ],
    }).compile();

    service = module.get(StravaAuthService);
  });

  it('deletes the StravaAccount for the given userId', async () => {
    mockPrisma.stravaAccount.deleteMany.mockResolvedValueOnce({ count: 1 });

    await service.disconnectAccount(EXISTING_USER_ID);

    expect(mockPrisma.stravaAccount.deleteMany).toHaveBeenCalledWith({
      where: { userId: EXISTING_USER_ID },
    });
  });

  it('does not throw when there is nothing to delete', async () => {
    mockPrisma.stravaAccount.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.disconnectAccount(EXISTING_USER_ID)).resolves.toBeUndefined();
  });
});
