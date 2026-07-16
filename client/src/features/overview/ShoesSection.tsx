import { useEffect, useState } from 'react';
import type { Gear } from '@/lib/types';
import { formatKm, formatMonthShortYear } from '@/lib/activityFormat';
import { apiFetch } from '@/lib/api';

// TODO: Strava's Gear API exposes no per-shoe mileage goal at all — this is a
// fixed placeholder until there's a real, user-settable goal field.
const SHOE_LIFESPAN_M = 800_000;

export default function ShoesSection() {
  const [gear, setGear] = useState<Gear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/gear')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setGear)
      .catch(() => setGear([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const activeCount = gear.filter((g) => !g.retired).length;
  const retiredCount = gear.filter((g) => g.retired).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-semibold text-foreground">
          Shoes
        </div>
        <div className="text-[11.5px] text-muted-foreground">
          {activeCount} active · {retiredCount} retired
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-[14px]">
        {gear.map((g) => (
          <ShoeCard key={g.id} gear={g} />
        ))}
        {gear.length === 0 && (
          <p className="col-span-3 py-6 text-center text-[12.5px] text-muted-foreground">
            No shoes synced yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ShoeCard({ gear }: { gear: Gear }) {
  const pct = Math.min(100, (gear.computedDistanceM / SHOE_LIFESPAN_M) * 100);
  const barColor = gear.retired
    ? 'var(--muted-foreground)'
    : pct > 85
      ? 'var(--neg)'
      : 'var(--acc)';

  // no "Race Day" tier: Strava's Gear API only has primary/retired, nothing
  // in between — a shoe that's neither gets no badge
  const badge = gear.primary
    ? { label: 'Default', bg: 'bg-acc-bg', text: 'text-acc-tx' }
    : gear.retired
      ? { label: 'Retired', bg: 'bg-neutral-bg', text: 'text-neutral' }
      : null;

  const meta =
    gear.retired && gear.firstUseDate && gear.lastUseDate
      ? `${formatMonthShortYear(new Date(gear.firstUseDate))} – ${formatMonthShortYear(new Date(gear.lastUseDate))}`
      : gear.firstUseDate
        ? `${gear.runCount} runs · since ${formatMonthShortYear(new Date(gear.firstUseDate))}`
        : `${gear.runCount} runs`;

  return (
    <div
      className={`flex flex-col gap-[10px] rounded-[12px] border border-border p-4 ${
        gear.retired ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-[.08em] text-muted-foreground uppercase">
          {gear.brandName ?? '—'}
        </div>
        {badge && (
          <span
            className={`rounded-[5px] px-[7px] py-[2px] text-[9.5px] font-semibold uppercase ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="text-[15px] font-semibold text-foreground">
        {gear.modelName ?? gear.name}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold text-foreground">
          {formatKm(gear.computedDistanceM / 1000)} km
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          of {Math.round(SHOE_LIFESPAN_M / 1000)} km
        </span>
      </div>

      <div className="h-[6px] rounded-[3px] bg-chip">
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      <div className="text-[11.5px] text-muted-foreground">{meta}</div>
    </div>
  );
}
