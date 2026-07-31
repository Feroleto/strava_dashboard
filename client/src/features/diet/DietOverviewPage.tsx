import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Settings } from 'lucide-react';
import type { MealType } from '@/lib/types';
import { currentIntlLocale } from '@/lib/dateLocale';
import { useFoodLogs, localDateString } from './useFoodLogs';
import { useNutritionGoal } from './useNutritionGoal';
import { MEAL_TYPES, MACRO_COLORS, capitalize } from './constants';
import NutritionRing from './components/NutritionRing';
import MacroBar from './components/MacroBar';
import AddMealPage from './AddMealPage';
import GoalPage from './GoalPage';

type View = { name: 'overview' } | { name: 'addMeal'; mealType: MealType } | { name: 'goal' };

function formatDayHeader(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const text = d.toLocaleDateString(currentIntlLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return capitalize(text);
}

export default function DietOverviewPage() {
  const { t } = useTranslation('diet');
  const [view, setView] = useState<View>({ name: 'overview' });
  const [refreshKey, setRefreshKey] = useState(0);
  const date = localDateString();
  const { logs, summary, loading } = useFoodLogs(date, refreshKey);
  const { goal, save: saveGoal } = useNutritionGoal();

  if (view.name === 'addMeal') {
    return (
      <AddMealPage
        mealType={view.mealType}
        existingLogs={logs.filter((l) => l.mealType === view.mealType)}
        onBack={() => setView({ name: 'overview' })}
        onSaved={() => {
          setRefreshKey((k) => k + 1);
          setView({ name: 'overview' });
        }}
      />
    );
  }

  if (view.name === 'goal' && goal) {
    return (
      <GoalPage
        goal={goal}
        onBack={() => setView({ name: 'overview' })}
        onSave={async (next) => {
          await saveGoal(next);
          setView({ name: 'overview' });
        }}
      />
    );
  }

  const totalKcal = summary?.totalKcal ?? 0;
  const kcalGoal = goal?.dailyKcalGoal ?? 2000;
  const remaining = Math.round(kcalGoal - totalKcal);

  return (
    <div className="px-5 pt-[76px] pb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[25px] font-bold tracking-[-.02em] text-foreground">
            {t('overview.title')}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{formatDayHeader(date)}</p>
        </div>
        <button
          type="button"
          onClick={() => setView({ name: 'goal' })}
          aria-label={t('overview.editGoal')}
          className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground hover:bg-chip hover:text-foreground"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-5 flex flex-col items-center rounded-[16px] border border-border bg-card p-[22px]">
        <NutritionRing value={totalKcal} max={kcalGoal}>
          <span className="text-[30px] font-bold tabular-nums tracking-[-.02em] text-foreground">
            {Math.round(totalKcal)}
          </span>
          <span className="mt-0.5 text-[11.5px] text-muted-foreground">
            {t('overview.ofGoal', { kcal: kcalGoal })}
          </span>
        </NutritionRing>
        <p className="mt-3 text-[13px] font-semibold text-acc">
          {t('overview.remaining', { kcal: remaining })}
        </p>

        <div className="mt-5 flex w-full flex-col gap-3">
          <MacroBar
            label={t('macro.protein')}
            value={summary?.totalProtein ?? 0}
            max={goal?.dailyProteinGoal ?? 150}
            color={MACRO_COLORS.protein}
          />
          <MacroBar
            label={t('macro.carbs')}
            value={summary?.totalCarbs ?? 0}
            max={goal?.dailyCarbsGoal ?? 250}
            color={MACRO_COLORS.carbs}
          />
          <MacroBar
            label={t('macro.fat')}
            value={summary?.totalFat ?? 0}
            max={goal?.dailyFatGoal ?? 65}
            color={MACRO_COLORS.fat}
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 px-1 text-[14px] font-semibold text-foreground">
          {t('overview.mealsTitle')}
        </div>
        <div className="rounded-[14px] border border-border bg-card">
          {MEAL_TYPES.map((mealType, i) => {
            const items = logs.filter((l) => l.mealType === mealType);
            const kcal = Math.round(
              items.reduce((sum, l) => sum + (l.food.kcal * l.quantity) / 100, 0),
            );
            return (
              <button
                key={mealType}
                type="button"
                onClick={() => setView({ name: 'addMeal', mealType })}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-chip ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-foreground">
                    {t(`meal.${mealType}`)}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {t('overview.items', { count: items.length })} · {kcal} {t('addMeal.kcal')}
                  </div>
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {kcal}
                </span>
                <span
                  aria-hidden
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-chip text-acc"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!loading && (
        <p className="mt-8 px-1 text-center text-[10.5px] leading-[1.5] text-muted-foreground">
          {t('attribution')}
        </p>
      )}
    </div>
  );
}
