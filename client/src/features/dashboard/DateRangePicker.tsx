import { useEffect, useRef, useState } from 'react';
import { formatDayMonth, formatMonthLong } from '@/lib/activityFormat';

export interface DateRange {
  // midnight first activity
  start: number;
  // midnight last activity
  end: number;
}

interface DateRangePickerProps {
  range: DateRange | null;
  onChange: (range: DateRange | null) => void;
  // limits date navigation between activities date range
  minDate?: Date;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function midnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function monthStart(d: Date): Date {
  const c = midnight(d);
  c.setDate(1);
  return c;
}

function addMonths(d: Date, k: number): Date {
  const c = new Date(d);
  c.setMonth(c.getMonth() + k);
  return c;
}

function lastDayOfMonth(m: Date): Date {
  return new Date(m.getFullYear(), m.getMonth() + 1, 0);
}

function buildPresets(): [string, DateRange][] {
  const today = midnight(new Date());
  const thisM = monthStart(today);
  const lastM = addMonths(thisM, -1);
  const threeAgo = new Date(today);
  threeAgo.setMonth(threeAgo.getMonth() - 3);
  const y = today.getFullYear();
  return [
    [
      'This Month',
      { start: thisM.getTime(), end: lastDayOfMonth(thisM).getTime() },
    ],
    [
      'Last Month',
      { start: lastM.getTime(), end: lastDayOfMonth(lastM).getTime() },
    ],
    ['Last 3 Months', { start: threeAgo.getTime(), end: today.getTime() }],
    ['This Year', { start: new Date(y, 0, 1).getTime(), end: today.getTime() }],
    [
      'Last Year',
      {
        start: new Date(y - 1, 0, 1).getTime(),
        end: new Date(y - 1, 11, 31).getTime(),
      },
    ],
  ];
}

function CalendarIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function DateRangePicker({
  range,
  onChange,
  minDate,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // fist month — default: last month (second month = current month)
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    addMonths(monthStart(new Date()), -1),
  );
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [hoverDate, setHoverDate] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setPendingStart(null);
    setHoverDate(null);
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setVisibleMonth(
      range
        ? monthStart(new Date(range.start))
        : addMonths(monthStart(new Date()), -1),
    );
    setPendingStart(null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
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

  const paint: DateRange | null =
    pendingStart != null
      ? {
          start: Math.min(pendingStart, hoverDate ?? pendingStart),
          end: Math.max(pendingStart, hoverDate ?? pendingStart),
        }
      : range;

  const minMonth = minDate ? monthStart(minDate) : null;
  const maxMonth = monthStart(new Date());
  const canPrev = !minMonth || visibleMonth.getTime() > minMonth.getTime();
  const canNext = addMonths(visibleMonth, 1).getTime() < maxMonth.getTime();

  const clickDay = (ts: number) => {
    if (pendingStart == null) {
      setPendingStart(ts);
      return;
    }
    onChange({
      start: Math.min(pendingStart, ts),
      end: Math.max(pendingStart, ts),
    });
    close();
  };

  const hint =
    pendingStart != null
      ? 'Select last date'
      : range
        ? `${formatDayMonth(new Date(range.start))} – ${formatDayMonth(new Date(range.end))}`
        : 'Select start date';

  const renderMonth = (month: Date, side: 'first' | 'second') => {
    const offset = (month.getDay() + 6) % 7; // week starts on monday
    const total = lastDayOfMonth(month).getDate();
    const cells: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
    return (
      <div className="w-[216px]">
        <div className="flex items-center justify-between">
          {side === 'first' ? (
            <button
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              disabled={!canPrev}
              aria-label="Mês anterior"
              className="h-[26px] w-[26px] cursor-pointer rounded-[7px] text-muted-foreground hover:bg-chip disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ‹
            </button>
          ) : (
            <span className="w-[26px]" />
          )}
          <div className="text-[12.5px] font-semibold text-foreground">
            {formatMonthLong(month)}
          </div>
          {side === 'second' ? (
            <button
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              disabled={!canNext}
              aria-label="Próximo mês"
              className="h-[26px] w-[26px] cursor-pointer rounded-[7px] text-muted-foreground hover:bg-chip disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ›
            </button>
          ) : (
            <span className="w-[26px]" />
          )}
        </div>
        <div className="mt-2 grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="flex h-5 items-center justify-center text-[10px] uppercase text-muted-foreground"
            >
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day == null) return <div key={`empty-${i}`} />;
            const ts = new Date(
              month.getFullYear(),
              month.getMonth(),
              day,
            ).getTime();
            const isEdge =
              paint != null && (ts === paint.start || ts === paint.end);
            const inMid = paint != null && ts > paint.start && ts < paint.end;
            return (
              <button
                key={ts}
                onClick={() => clickDay(ts)}
                onMouseEnter={() => setHoverDate(ts)}
                className={`flex h-[27px] cursor-pointer items-center justify-center text-[12px] ${
                  isEdge
                    ? 'rounded-[8px] font-semibold text-white'
                    : inMid
                      ? 'text-foreground'
                      : 'rounded-[7px] text-foreground hover:bg-chip'
                }`}
                style={
                  isEdge
                    ? { background: 'var(--acc)' }
                    : inMid
                      ? {
                          background:
                            'color-mix(in oklab, var(--acc) 10%, transparent)',
                        }
                      : undefined
                }
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        className={`flex cursor-pointer items-center gap-1.5 rounded-[8px] border px-[11px] py-[5px] text-[11.5px] font-medium ${
          range ? 'border-transparent' : 'text-muted-foreground'
        }`}
        style={
          range
            ? {
                background: 'color-mix(in oklab, var(--acc) 10%, transparent)',
                color: 'var(--acc-tx)',
              }
            : { borderColor: 'var(--grid-ax)' }
        }
      >
        <CalendarIcon />
        {range
          ? `${formatDayMonth(new Date(range.start))} – ${formatDayMonth(new Date(range.end))}`
          : 'Custom'}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 rounded-[14px] border bg-card p-4"
          style={{
            top: 'calc(100% + 10px)',
            borderColor: 'var(--grid-ax)',
            boxShadow: '0 12px 32px rgba(8,12,20,.16)',
          }}
        >
          <div className="flex">
            <div className="flex w-[132px] flex-col gap-1 border-r border-border pr-3">
              {buildPresets().map(([label, preset]) => (
                <button
                  key={label}
                  onClick={() => {
                    onChange(preset);
                    close();
                  }}
                  className="cursor-pointer rounded-[8px] px-[10px] py-[7px] text-left text-[12.5px] font-medium text-foreground hover:bg-chip"
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="flex gap-[22px] pl-4"
              onMouseLeave={() => setHoverDate(null)}
            >
              {renderMonth(visibleMonth, 'first')}
              {renderMonth(addMonths(visibleMonth, 1), 'second')}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="text-[12px] text-muted-foreground">{hint}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onChange(null);
                  setPendingStart(null);
                  setHoverDate(null);
                }}
                className="cursor-pointer rounded-[8px] px-2.5 py-[5px] text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                Clean
              </button>
              <button
                onClick={close}
                className="cursor-pointer rounded-[8px] bg-chip px-2.5 py-[5px] text-[12px] font-medium text-foreground hover:bg-grid-ax"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
