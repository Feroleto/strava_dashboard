import { formatKm } from '@/lib/activityFormat';

interface RangeChipProps {
  label: string;
  count: number;
  km: number;
  days: number;
  onClear: () => void;
}

export default function RangeChip({
  label,
  count,
  km,
  days,
  onClear,
}: RangeChipProps) {
  return (
    <div className="mb-[26px] flex">
      <div
        className="flex items-center gap-2.5 rounded-full px-3.5 py-[7px]"
        style={{
          background: 'color-mix(in oklab, var(--acc) 10%, transparent)',
        }}
      >
        <span
          className="text-[12.5px] font-semibold"
          style={{ color: 'var(--acc-tx)' }}
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground">
          {count} run{count === 1 ? '' : 's'} · {formatKm(km)} km · {days} day
          {days === 1 ? '' : 's'}
        </span>
        <button
          onClick={onClear}
          aria-label="Clean custom period"
          className="cursor-pointer text-[14px] leading-none text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
