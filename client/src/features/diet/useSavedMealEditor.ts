import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { FoodListItem, SavedMealDetail } from '@/lib/types';
import { defaultPortion } from './quantityFormat';

export interface WorkingMealItem {
  // server savedMealItem id for rows loaded from an existing saved meal, a
  // local-only key for rows added during this editing session — either way
  // it's only ever used as a React key, never sent to the server (see save()
  // below, which always POSTs/PATCHes the foodId/quantity list)
  key: string;
  foodId: string;
  /** grams — SavedMealItem has no unit column, units are input-only here */
  quantity: number;
  // display-only (name, kcal preview, serving info for the quantity sheet) —
  // never sent to the server, same spirit as WorkingExercise's exerciseName in
  // useRoutineEditor.ts
  food: FoodListItem;
}

let localKeySeq = 0;
function nextLocalKey(): string {
  localKeySeq += 1;
  return `local-${localKeySeq}`;
}

function toWorking(meal: SavedMealDetail): WorkingMealItem[] {
  return meal.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((i) => ({
      key: i.id,
      foodId: i.food.id,
      quantity: i.quantity,
      food: i.food,
    }));
}

// signature used for dirty-checking the item list against what was loaded —
// order matters, row identity (key) doesn't, same shape as
// useRoutineEditor.ts's exercisesSignature
function itemsSignature(items: WorkingMealItem[]): string {
  return JSON.stringify(items.map((i) => ({ foodId: i.foodId, quantity: i.quantity })));
}

// Same in-memory-build + flush-once-on-save model as useRoutineEditor.ts:
// create mode POSTs the whole thing, edit mode PATCHes the whole thing (name
// + a wholesale items replace, see SavedMealsService.update). `initialItems`
// seeds create mode from the current AddMealPage cart ("Salvar como refeição
// salva") — ignored in edit mode, where the loaded meal's items win once
// they arrive.
export function useSavedMealEditor(mealId: string | null, initialItems: WorkingMealItem[] = []) {
  const isEdit = mealId !== null;
  const [name, setName] = useState('');
  const [items, setItems] = useState<WorkingMealItem[]>(isEdit ? [] : initialItems);
  const initialMeta = useRef({
    name: '',
    itemsSignature: itemsSignature(isEdit ? [] : initialItems),
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    apiFetch(`/saved-meals/${mealId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SavedMealDetail>;
      })
      .then((meal) => {
        if (cancelled) return;
        const working = toWorking(meal);
        setName(meal.name);
        setItems(working);
        initialMeta.current = { name: meal.name, itemsSignature: itemsSignature(working) };
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, mealId]);

  // no explicit quantity means "one of whatever this food is normally measured
  // in" — 1 fatia, 1 unidade, or the flat 100g fallback
  const addFood = useCallback((food: FoodListItem, quantity?: number) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextLocalKey(),
        foodId: food.id,
        quantity: quantity ?? defaultPortion(food).quantity,
        food,
      },
    ]);
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)));
  }, []);

  const removeFood = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const save = useCallback(async (): Promise<SavedMealDetail | null> => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(isEdit ? `/saved-meals/${mealId}` : '/saved-meals', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          items: items.map((i) => ({ foodId: i.foodId, quantity: i.quantity })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as SavedMealDetail;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setSaving(false);
    }
  }, [isEdit, mealId, name, items]);

  // create mode: anything typed/added is unsaved until save(). edit mode: the
  // whole meal only exists in memory until save() too, compared against the
  // snapshot captured when it loaded
  const isDirty = isEdit
    ? name !== initialMeta.current.name ||
      itemsSignature(items) !== initialMeta.current.itemsSignature
    : name.trim().length > 0 || items.length > 0;

  return {
    isEdit,
    isDirty,
    name,
    setName,
    items,
    loading,
    saving,
    error,
    addFood,
    updateQuantity,
    removeFood,
    save,
  };
}
