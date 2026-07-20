import { useTranslation } from 'react-i18next';
import type { LapSizeMode } from '@/lib/types';

interface SizeModeToggleProps {
  value: LapSizeMode;
  onChange: (value: LapSizeMode) => void;
}

export default function SizeModeToggle({ value, onChange }: SizeModeToggleProps) {
  const { t } = useTranslation('activity');

  return (
    <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
      <button
        type="button"
        onClick={() => onChange('distance')}
        className={`cursor-pointer rounded px-2 py-1 text-[12px] ${
          value === 'distance'
            ? 'bg-card font-medium text-foreground'
            : 'text-muted-foreground'
        }`}
      >
        {t('laps.byDistance')}
      </button>
      <button
        type="button"
        onClick={() => onChange('time')}
        className={`cursor-pointer rounded px-2 py-1 text-[12px] ${
          value === 'time'
            ? 'bg-card font-medium text-foreground'
            : 'text-muted-foreground'
        }`}
      >
        {t('laps.byTime')}
      </button>
    </div>
  );
}
