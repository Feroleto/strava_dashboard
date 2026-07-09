interface SegmentedControlProps<K extends string> {
  items: [K, string][];
  active: K;
  onPick: (key: K) => void;
  compact?: boolean;
}

export default function SegmentedControl<K extends string>({
  items,
  active,
  onPick,
  compact = false,
}: SegmentedControlProps<K>) {
  return (
    <div
      className={`flex gap-0.5 bg-chip ${compact ? 'rounded-lg p-0.5' : 'rounded-[9px] p-[3px]'}`}
    >
      {items.map(([key, label]) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            onClick={() => onPick(key)}
            className={`cursor-pointer font-medium ${
              compact
                ? 'rounded-md px-2.5 py-[5px] text-[11.5px]'
                : 'rounded-[7px] px-[13px] py-1.5 text-[12.5px]'
            } ${isActive ? 'bg-seg-active text-foreground' : 'text-muted-foreground'}`}
            style={isActive ? { boxShadow: 'var(--seg-shadow)' } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
