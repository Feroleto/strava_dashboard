import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode, ChevronLeft, X, Check, Plus, BookmarkPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { currentIntlLocale } from '@/lib/dateLocale';
import type { FoodListItem, FoodLogItem, MealType, SavedMealSummary } from '@/lib/types';
import AddManualFoodPage from './AddManualFoodPage';
import SavedMealsListPage from './SavedMealsListPage';
import SavedMealEditPage from './SavedMealEditPage';
import type { WorkingMealItem } from './useSavedMealEditor';

// html5-qrcode's decoder is a heavy dependency (~100kB gzipped) — split out
// so it only downloads when the user actually taps "escanear"
const BarcodeScannerPage = lazy(() => import('./BarcodeScannerPage'));

const SEARCH_DEBOUNCE_MS = 250;
// no quantity step in this screen — every search/scan add lands at a fixed
// 100g portion; precise quantities are only available via manual entry
const DEFAULT_PORTION_G = 100;

interface AddMealPageProps {
  mealType: MealType;
  existingLogs: FoodLogItem[];
  onBack: () => void;
  onSaved: () => void;
}

type View = 'search' | 'scanner' | 'manual' | 'savedMeals' | 'editSavedMeal';

function todayShort(): string {
  return new Date().toLocaleDateString(currentIntlLocale(), {
    day: 'numeric',
    month: 'long',
  });
}

export default function AddMealPage({ mealType, existingLogs, onBack, onSaved }: AddMealPageProps) {
  const { t } = useTranslation('diet');
  const [view, setView] = useState<View>('search');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<FoodListItem[]>([]);
  const [existing, setExisting] = useState(existingLogs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // set only when reached via a barcode scan that found no match — links the
  // manually-cadastrado food to that code
  const [pendingExternalId, setPendingExternalId] = useState<string | undefined>();
  // null = creating a new saved meal; a string = editing that one
  const [editingSavedMealId, setEditingSavedMealId] = useState<string | null>(null);
  // seeds a new saved meal's items from the current cart, via "Salvar como
  // refeição salva" — ignored when editingSavedMealId is set
  const [editorInitialItems, setEditorInitialItems] = useState<WorkingMealItem[]>([]);
  const [applyingSavedMeal, setApplyingSavedMeal] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      apiFetch(`/foods/search?q=${encodeURIComponent(search.trim())}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<FoodListItem[]>;
        })
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search]);

  const toggleCart = (food: FoodListItem) => {
    setCart((c) => (c.some((f) => f.id === food.id) ? c.filter((f) => f.id !== food.id) : [...c, food]));
  };

  const removeExisting = (id: string) => {
    setExisting((e) => e.filter((l) => l.id !== id));
    void apiFetch(`/food-logs/${id}`, { method: 'DELETE' });
  };

  const removeCartItem = (index: number) => {
    setCart((c) => c.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (cart.length === 0) {
      onSaved();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const loggedAt = new Date().toISOString();
      for (const food of cart) {
        const res = await apiFetch('/food-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foodId: food.id,
            quantity: DEFAULT_PORTION_G,
            mealType,
            loggedAt,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      onSaved();
    } catch {
      setError(t('addMeal.error'));
    } finally {
      setSaving(false);
    }
  };

  // single call — mirrors starting a workout from a routine template — that
  // creates a FoodLog per saved-meal item server-side (SavedMealsService.applyToLog)
  // instead of looping N sequential POSTs like handleSave's ad-hoc cart does
  const applySavedMeal = async (meal: SavedMealSummary) => {
    setApplyingSavedMeal(true);
    setError(null);
    try {
      const res = await apiFetch(`/saved-meals/${meal.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealType, loggedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSaved();
    } catch {
      setError(t('addMeal.error'));
    } finally {
      setApplyingSavedMeal(false);
    }
  };

  if (view === 'savedMeals') {
    return (
      <SavedMealsListPage
        onBack={() => setView('search')}
        applying={applyingSavedMeal}
        onUse={(meal) => void applySavedMeal(meal)}
        onEdit={(mealId) => {
          setEditingSavedMealId(mealId);
          setView('editSavedMeal');
        }}
        onCreateNew={() => {
          setEditingSavedMealId(null);
          setEditorInitialItems([]);
          setView('editSavedMeal');
        }}
      />
    );
  }

  if (view === 'editSavedMeal') {
    return (
      <SavedMealEditPage
        mealId={editingSavedMealId}
        initialItems={editorInitialItems}
        onBack={() => setView('savedMeals')}
        onSaved={() => setView('savedMeals')}
      />
    );
  }

  if (view === 'manual') {
    return (
      <AddManualFoodPage
        initialExternalId={pendingExternalId}
        onBack={() => {
          setPendingExternalId(undefined);
          setView('search');
        }}
        onCreated={(food) => {
          setPendingExternalId(undefined);
          setCart((c) => [...c, food]);
          setView('search');
        }}
      />
    );
  }

  if (view === 'scanner') {
    return (
      <Suspense fallback={null}>
        <BarcodeScannerPage
          onBack={() => setView('search')}
          onFound={(food) => {
            setCart((c) => [...c, food]);
            setView('search');
          }}
          onNotFound={(barcode) => {
            setPendingExternalId(barcode);
            setView('manual');
          }}
        />
      </Suspense>
    );
  }

  const kcalOf = (food: FoodListItem) => Math.round((food.kcal * DEFAULT_PORTION_G) / 100);
  const totalItems = existing.length + cart.length;
  const totalKcal =
    existing.reduce((sum, l) => sum + (l.food.kcal * l.quantity) / 100, 0) +
    cart.reduce((sum, f) => sum + (f.kcal * DEFAULT_PORTION_G) / 100, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('addMeal.back')}
          className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[9px] text-muted-foreground hover:bg-chip hover:text-foreground"
        >
          <ChevronLeft className="h-4.5 w-4.5" strokeWidth={1.8} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-foreground">
            {t(`meal.${mealType}`)}
          </div>
          <div className="text-[11.5px] text-muted-foreground">{todayShort()}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[88px]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border bg-chip px-3">
            <Search className="h-4 w-4 flex-none text-muted-foreground" strokeWidth={1.8} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('addMeal.searchPlaceholder')}
              className="h-10 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground md:text-[15px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setView('scanner')}
            aria-label={t('addMeal.scanBarcode')}
            className="flex h-[42px] w-[42px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-border bg-chip text-muted-foreground hover:bg-grid-ax hover:text-foreground"
          >
            <ScanBarcode className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setView('savedMeals')}
            aria-label={t('savedMeals.listTitle')}
            className="flex h-[42px] w-[42px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-border bg-chip text-muted-foreground hover:bg-grid-ax hover:text-foreground"
          >
            <BookmarkPlus className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>

        {totalItems > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 px-1 text-[11.5px] font-semibold tracking-[.05em] text-muted-foreground uppercase">
              {t('addMeal.inThisMeal')}
            </div>
            <div className="flex flex-col gap-1">
              {existing.map((log) => (
                <div
                  key={log.id}
                  className="flex min-h-[52px] items-center gap-2 rounded-[10px] px-3 py-2 hover:bg-chip"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-foreground">
                      {log.food.name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {Math.round(log.quantity)}g ·{' '}
                      {Math.round((log.food.kcal * log.quantity) / 100)} {t('addMeal.kcal')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExisting(log.id)}
                    aria-label={t('addMeal.remove')}
                    className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-[7px] text-muted-foreground hover:bg-grid-ax hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
              {cart.map((food, i) => (
                <div
                  key={`cart-${food.id}-${i}`}
                  className="flex min-h-[52px] items-center gap-2 rounded-[10px] px-3 py-2 hover:bg-chip"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-foreground">
                      {food.name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {DEFAULT_PORTION_G}g · {kcalOf(food)} {t('addMeal.kcal')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCartItem(i)}
                    aria-label={t('addMeal.remove')}
                    className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-[7px] text-muted-foreground hover:bg-grid-ax hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditorInitialItems(
                    cart.map((food, i) => ({
                      key: `cart-${food.id}-${i}`,
                      foodId: food.id,
                      foodName: food.name,
                      quantity: DEFAULT_PORTION_G,
                      kcalPer100: food.kcal,
                    })),
                  );
                  setEditingSavedMealId(null);
                  setView('editSavedMeal');
                }}
                className="mt-2 cursor-pointer text-[12.5px] font-medium text-acc hover:underline"
              >
                {t('savedMeals.saveCurrentAsMeal')}
              </button>
            )}
          </div>
        )}

        <div className="mt-5">
          {search.trim() && (
            <div className="mb-1.5 px-1 text-[11.5px] font-semibold tracking-[.05em] text-muted-foreground uppercase">
              {t('addMeal.searchResults')}
            </div>
          )}
          {searching && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              {t('addMeal.loading')}
            </p>
          )}
          {!searching && search.trim() && results.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-[13px] text-muted-foreground">
                {t('addMeal.noResults', { query: search.trim() })}
              </p>
            </div>
          )}
          {!searching &&
            results.map((food) => {
              const inCart = cart.some((f) => f.id === food.id);
              return (
                <div
                  key={food.id}
                  className="flex min-h-[56px] items-center gap-2 rounded-[10px] px-3 py-2 hover:bg-chip"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-foreground">
                      {food.name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {DEFAULT_PORTION_G}g · {kcalOf(food)} {t('addMeal.kcal')} · P{' '}
                      {Math.round(food.protein)}g · C {Math.round(food.carbs)}g · G{' '}
                      {Math.round(food.fat)}g
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCart(food)}
                    aria-label={food.name}
                    className={`flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full ${
                      inCart ? 'bg-acc-bg text-acc-tx' : 'bg-chip text-acc hover:bg-grid-ax'
                    }`}
                  >
                    {inCart ? (
                      <Check className="h-4 w-4" strokeWidth={2.2} />
                    ) : (
                      <Plus className="h-4 w-4" strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              );
            })}
        </div>

        <button
          type="button"
          onClick={() => setView('manual')}
          className="mt-4 cursor-pointer text-[12.5px] font-medium text-acc hover:underline"
        >
          {t('addMeal.manualLink')}
        </button>

        {error && <p className="mt-3 text-[12px] text-neg">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-border bg-card px-5 py-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent">
        <span className="text-[12.5px] text-muted-foreground">
          {t('addMeal.itemsCount', { count: totalItems })} · {Math.round(totalKcal)}{' '}
          {t('addMeal.kcal')}
        </span>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="cursor-pointer rounded-[11px] bg-acc px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-default disabled:opacity-70"
        >
          {saving ? t('addMeal.saving') : t('addMeal.save')}
        </button>
      </div>
    </div>
  );
}
