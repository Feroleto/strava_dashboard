import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Volume2, VolumeX, X } from 'lucide-react';
import type { useRestTimer } from './useRestTimer';

const PRESETS_SEC = [30, 60, 90, 120, 180];

interface RestTimerControlProps {
  timer: ReturnType<typeof useRestTimer>;
}

function formatMmSs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDurationLabel(sec: number): string {
  return sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}min`;
}

// header trigger + popover, replaces the old fixed bottom RestTimerBar —
// same click-outside/Esc pattern as DateRangePicker, but always anchored
// right under the button (mobile included) instead of a bottom sheet, since
// a bottom sheet on a small trigger like this opens too far from the icon
export default function RestTimerControl({ timer }: RestTimerControlProps) {
  const { t } = useTranslation('gym');
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setCustomValue('');
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const startWithDuration = (sec: number) => {
    if (sec > 0) timer.start(Math.round(sec));
    close();
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    startWithDuration(Number(customValue));
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('rest.openTimer')}
        className={
          timer.isActive
            ? 'flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold tabular-nums text-acc-tx'
            : 'flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] text-muted-foreground hover:bg-chip hover:text-foreground'
        }
        style={
          timer.isActive
            ? { background: 'color-mix(in oklab, var(--acc) 12%, transparent)' }
            : undefined
        }
      >
        <Timer className="h-4 w-4" strokeWidth={1.8} />
        {timer.isActive && formatMmSs(timer.remainingMs)}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] max-w-[calc(100vw-32px)] rounded-[14px] border border-border bg-card p-4"
          style={{ boxShadow: '0 12px 32px rgba(8,12,20,.16)' }}
        >
          {timer.isActive ? (
            <div className="space-y-3">
              <div className="text-center text-[28px] font-bold tabular-nums text-foreground">
                {formatMmSs(timer.remainingMs)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => timer.addSeconds(-15)}
                  aria-label={t('rest.minus15')}
                  className="h-10 flex-1 cursor-pointer rounded-[10px] bg-chip text-[13px] font-semibold text-foreground hover:bg-page-bg"
                >
                  −15s
                </button>
                <button
                  type="button"
                  onClick={() => timer.addSeconds(15)}
                  aria-label={t('rest.plus15')}
                  className="h-10 flex-1 cursor-pointer rounded-[10px] bg-chip text-[13px] font-semibold text-foreground hover:bg-page-bg"
                >
                  +15s
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={timer.toggleMuted}
                  className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] font-medium text-muted-foreground hover:bg-chip"
                >
                  {timer.muted ? (
                    <VolumeX className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Volume2 className="h-4 w-4" strokeWidth={1.8} />
                  )}
                  {timer.muted ? t('rest.unmute') : t('rest.mute')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    timer.skip();
                    close();
                  }}
                  className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] font-medium text-neg hover:bg-chip"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                  {t('rest.skip')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[12.5px] font-semibold text-foreground">
                {t('rest.chooseDuration')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS_SEC.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => startWithDuration(sec)}
                    className="cursor-pointer rounded-full bg-chip px-3 py-1.5 text-[12.5px] font-medium text-foreground hover:bg-grid-ax"
                  >
                    {formatDurationLabel(sec)}
                  </button>
                ))}
              </div>
              <form onSubmit={submitCustom} className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  placeholder={t('rest.customPlaceholder')}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-[10px] border border-border bg-transparent px-3 text-[16px] text-foreground outline-none focus:border-acc md:text-[13px]"
                />
                <button
                  type="submit"
                  className="h-10 flex-none cursor-pointer rounded-[10px] bg-pos px-3 text-[12.5px] font-semibold text-white"
                >
                  {t('rest.start')}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
