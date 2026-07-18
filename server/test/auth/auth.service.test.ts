import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/auth/auth.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
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

const USER_ID = 'user_test_123';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('authenticate', () => {
    it('returns null without touching Prisma when there is no session', async () => {
      const result = await service.authenticate(null);

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns the MeResponse (without tokenVersion) when the version matches', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: USER_ID,
        firstName: 'Guilherme',
        profileImgUrl: 'https://example.com/avatar.jpg',
        maxHr: 185,
        tokenVersion: 2,
      });

      const result = await service.authenticate({ userId: USER_ID, tokenVersion: 2 });

      expect(result).toEqual({
        id: USER_ID,
        firstName: 'Guilherme',
        profileImgUrl: 'https://example.com/avatar.jpg',
        maxHr: 185,
      });
      expect(result).not.toHaveProperty('tokenVersion');
    });

    it('returns null when the tokenVersion no longer matches (e.g. logged out elsewhere)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: USER_ID,
        firstName: 'Guilherme',
        profileImgUrl: null,
        maxHr: null,
        tokenVersion: 3,
      });

      const result = await service.authenticate({ userId: USER_ID, tokenVersion: 2 });

      expect(result).toBeNull();
    });

    it('returns null when the user no longer exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.authenticate({ userId: USER_ID, tokenVersion: 0 });

      expect(result).toBeNull();
    });
  });

  describe('invalidateSessions', () => {
    it('increments the tokenVersion for the given user', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({});

      await service.invalidateSessions(USER_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  });
});
