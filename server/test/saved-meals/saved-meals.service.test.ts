import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavedMealsService } from 'src/saved-meals/saved-meals.service';
import { FoodsService } from 'src/foods/foods.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      savedMeal: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      savedMealItem: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      foodLog: {
        create: vi.fn(),
      },
      // array-form $transaction (matches applyToLog and the wholesale
      // deleteMany+createMany replace in update) — real Prisma runs the
      // given queries atomically and returns their results; for these tests
      // just running them in order is enough, same convention as
      // workout-templates.service.test.ts
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    },
  };
});

vi.mock('@prisma/client', () => {
  return {
    Prisma: {},
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

const DETAIL_STUB = {
  id: 'm1',
  name: 'Café da manhã',
  items: [],
};

function foodItem(id: string, name: string, kcal: number) {
  return {
    id,
    name,
    brand: null,
    source: 'TACO',
    imageUrl: null,
    kcal,
    protein: 1,
    carbs: 1,
    fat: 1,
    fiber: null,
    sodium: null,
  };
}

describe('SavedMealsService', () => {
  let service: SavedMealsService;
  let foodsService: { assertVisible: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    foodsService = { assertVisible: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedMealsService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
        { provide: FoodsService, useValue: foodsService },
      ],
    }).compile();

    service = module.get(SavedMealsService);
  });

  describe('create', () => {
    it('validates every foodId is visible to the caller before creating', async () => {
      foodsService.assertVisible.mockRejectedValueOnce(new BadRequestException('nope'));

      await expect(
        service.create(USER_ID, {
          name: 'Café da manhã',
          items: [{ foodId: 'food1', quantity: 100 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.savedMeal.create).not.toHaveBeenCalled();
    });

    it('assigns order from array position (1-based)', async () => {
      mockPrisma.savedMeal.create.mockResolvedValueOnce(DETAIL_STUB);

      await service.create(USER_ID, {
        name: 'Café da manhã',
        items: [
          { foodId: 'food1', quantity: 100 },
          { foodId: 'food2', quantity: 50 },
        ],
      });

      const data = mockPrisma.savedMeal.create.mock.calls[0][0].data;
      expect(data.items.create.map((i: any) => i.order)).toEqual([1, 2]);
      expect(data.userId).toBe(USER_ID);
    });

    it('creates an empty saved meal when no items are given', async () => {
      mockPrisma.savedMeal.create.mockResolvedValueOnce(DETAIL_STUB);

      await service.create(USER_ID, { name: 'Empty', items: [] });

      expect(mockPrisma.savedMeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID, name: 'Empty' }),
        }),
      );
    });
  });

  describe('ownership', () => {
    it('update 404s for a saved meal belonging to another user', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(USER_ID, 'someone_elses_meal', { name: 'Hijack' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.savedMeal.update).not.toHaveBeenCalled();
    });

    it('remove 404s for a saved meal belonging to another user', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove(USER_ID, 'someone_elses_meal')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockPrisma.savedMeal.delete).not.toHaveBeenCalled();
    });

    it('remove only deletes the saved meal row — cascade handles SavedMealItem', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({ id: 'm1' });
      mockPrisma.savedMeal.delete.mockResolvedValueOnce({});

      await service.remove(USER_ID, 'm1');

      expect(mockPrisma.savedMeal.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });

  describe('update — items replace', () => {
    it('replaces the item list wholesale when items is provided — order from array position', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({ id: 'm1' }); // ownership
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce(DETAIL_STUB); // findById refetch

      await service.update(USER_ID, 'm1', {
        items: [
          { foodId: 'food1', quantity: 100 },
          { foodId: 'food2', quantity: 200 },
        ],
      });

      expect(foodsService.assertVisible).toHaveBeenCalledWith(USER_ID, ['food1', 'food2']);
      expect(mockPrisma.savedMealItem.deleteMany).toHaveBeenCalledWith({
        where: { savedMealId: 'm1' },
      });
      expect(mockPrisma.savedMealItem.createMany).toHaveBeenCalledWith({
        data: [
          { savedMealId: 'm1', foodId: 'food1', quantity: 100, order: 1 },
          { savedMealId: 'm1', foodId: 'food2', quantity: 200, order: 2 },
        ],
      });
    });

    it('leaves the item list untouched when items is omitted', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({ id: 'm1' }); // ownership
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce(DETAIL_STUB); // findById refetch

      await service.update(USER_ID, 'm1', { name: 'New name' });

      expect(foodsService.assertVisible).not.toHaveBeenCalled();
      expect(mockPrisma.savedMealItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.savedMealItem.createMany).not.toHaveBeenCalled();
    });

    it('validates every foodId is visible before replacing', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({ id: 'm1' }); // ownership
      foodsService.assertVisible.mockRejectedValueOnce(new BadRequestException('nope'));

      await expect(
        service.update(USER_ID, 'm1', { items: [{ foodId: 'food1', quantity: 100 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.savedMealItem.deleteMany).not.toHaveBeenCalled();
    });

    it('accepts an empty array to clear the meal', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({ id: 'm1' }); // ownership
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce(DETAIL_STUB); // findById refetch

      await service.update(USER_ID, 'm1', { items: [] });

      expect(mockPrisma.savedMealItem.deleteMany).toHaveBeenCalledWith({
        where: { savedMealId: 'm1' },
      });
      expect(mockPrisma.savedMealItem.createMany).toHaveBeenCalledWith({ data: [] });
    });
  });

  describe('list', () => {
    it('computes itemCount, itemPreview (first 3 names) and totalKcal per saved meal', async () => {
      mockPrisma.savedMeal.findMany.mockResolvedValueOnce([
        {
          id: 'm1',
          name: 'Café da manhã',
          items: [
            { quantity: 100, food: { name: 'Pão francês', kcal: 300 } },
            { quantity: 50, food: { name: 'Ovo', kcal: 150 } },
          ],
        },
        { id: 'm2', name: 'Vazia', items: [] },
      ]);

      const result = await service.list(USER_ID);

      expect(result[0]).toMatchObject({
        id: 'm1',
        itemCount: 2,
        itemPreview: ['Pão francês', 'Ovo'],
        totalKcal: 300 + 75, // 300*100/100 + 150*50/100
      });
      expect(result[1]).toMatchObject({ id: 'm2', itemCount: 0, itemPreview: [], totalKcal: 0 });
    });
  });

  describe('applyToLog', () => {
    it('404s for a saved meal belonging to another user', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.applyToLog(USER_ID, 'm1', {
          mealType: 'BREAKFAST' as any,
          loggedAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects applying a saved meal with no items', async () => {
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({ id: 'm1', name: 'Vazia', items: [] });

      await expect(
        service.applyToLog(USER_ID, 'm1', {
          mealType: 'BREAKFAST' as any,
          loggedAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates one FoodLog per item in a single transaction, sharing mealType/loggedAt', async () => {
      const loggedAt = new Date('2026-07-30T12:00:00.000Z');
      mockPrisma.savedMeal.findFirst.mockResolvedValueOnce({
        id: 'm1',
        name: 'Café da manhã',
        items: [
          { id: 'i1', quantity: 100, order: 1, food: foodItem('food1', 'Pão francês', 300) },
          { id: 'i2', quantity: 50, order: 2, food: foodItem('food2', 'Ovo', 150) },
        ],
      });
      mockPrisma.foodLog.create.mockResolvedValueOnce({ id: 'log1' });
      mockPrisma.foodLog.create.mockResolvedValueOnce({ id: 'log2' });

      const result = await service.applyToLog(USER_ID, 'm1', {
        mealType: 'BREAKFAST' as any,
        loggedAt,
      });

      expect(mockPrisma.foodLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.foodLog.create.mock.calls[0][0].data).toEqual({
        userId: USER_ID,
        foodId: 'food1',
        quantity: 100,
        mealType: 'BREAKFAST',
        loggedAt,
      });
      expect(mockPrisma.foodLog.create.mock.calls[1][0].data).toEqual({
        userId: USER_ID,
        foodId: 'food2',
        quantity: 50,
        mealType: 'BREAKFAST',
        loggedAt,
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: 'log1' }, { id: 'log2' }]);
    });
  });
});
