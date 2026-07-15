import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUniqueOrThrow: vi.fn(),
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

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getMe', () => {
    it('returns the maxHr from the user row', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({ maxHr: 185 });

      const result = await service.getMe(USER_ID);

      expect(result).toEqual({ maxHr: 185 });
      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID } }),
      );
    });

    it('returns null when maxHr has not been set yet', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({ maxHr: null });

      const result = await service.getMe(USER_ID);

      expect(result).toEqual({ maxHr: null });
    });
  });

  describe('updateMaxHr', () => {
    it('updates and returns the new maxHr', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ maxHr: 190 });

      const result = await service.updateMaxHr(USER_ID, 190);

      expect(result).toEqual({ maxHr: 190 });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: { maxHr: 190 },
        }),
      );
    });
  });
});
