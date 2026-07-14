type Size = 'default' | 'compact' | 'mini';

interface SegmentedControlProps<K extends string> {
  items: [K, string][];
  active: K;
  onPick: (key: K) => void;
  size?: Size;
}

const WRAPPER_CLASS: Record<Size, string> = {
  default: 'rounded-[9px] p-[3px]',
  compact: 'rounded-lg p-0.5',
  mini: 'rounded-[8px] p-[2px] gap-[2px]',
};

const BUTTON_CLASS: Record<Size, string> = {
  default: 'rounded-[7px] px-[13px] py-1.5 text-[12.5px]',
  compact: 'rounded-md px-2.5 py-[5px] text-[11.5px]',
  mini: 'rounded-[6px] px-2 py-1 text-[10.5px]',
};

const ACTIVE_CLASS: Record<Size, string> = {
  default: 'bg-seg-active text-foreground',
  compact: 'bg-seg-active text-foreground',
  mini: 'bg-card text-foreground font-semibold shadow-sm',
};

export default function SegmentedControl<K extends string>({
  items,
  active,
  onPick,
  size = 'default',
}: SegmentedControlProps<K>) {
  return (
    <div className={`flex gap-0.5 bg-chip ${WRAPPER_CLASS[size]}`}>
      {items.map(([key, label]) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            onClick={() => onPick(key)}
            className={`cursor-pointer font-medium ${BUTTON_CLASS[size]} ${
              isActive ? ACTIVE_CLASS[size] : 'text-muted-foreground'
            }`}
            style={
              isActive && size !== 'mini'
                ? { boxShadow: 'var(--seg-shadow)' }
                : undefined
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
