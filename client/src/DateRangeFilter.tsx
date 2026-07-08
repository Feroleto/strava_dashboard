import { useEffect, useRef, useState } from 'react';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

export interface DateRange {
  from: string;
  to: string;
}

type QuickKey = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'ytd' | 'allRuns';
type Tab = 'quick' | 'month' | 'custom';

type Selection =
  | { kind: 'none' }
  | { kind: 'quick'; key: QuickKey }
  | { kind: 'month'; month: string }
  | { kind: 'custom'; from: string; to: string };

const QUICK_OPTIONS: { key: QuickKey; label: string }[] = [
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last90', label: 'Last 90 days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'allRuns', label: 'All Runs' },
];

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_LABELS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const TABS: [Tab, string][] = [
  ['quick', 'Quick'],
  ['month', 'Month'],
  ['custom', 'Custom'],
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function quickRange(key: QuickKey): DateRange {
  const today = new Date();
  const to = toIsoDate(today);

  if (key === 'allRuns') {
    return { from: '', to: '' };
  }

  if (key === 'last7' || key === 'last30' || key === 'last90') {
    const days = key === 'last7' ? 7 : key === 'last30' ? 30 : 90;
    const from = new Date(today);
    from.setDate(from.getDate() - (days - 1));
    return { from: toIsoDate(from), to };
  }

  if (key === 'thisMonth') {
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return {
      from: `${year}-${pad(month)}-01`,
      to: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
    };
  }

  return { from: `${today.getFullYear()}-01-01`, to };
}

function monthRange(monthValue: string): DateRange {
  const [year, month] = monthValue.split('-').map(Number);
  return {
    from: `${monthValue}-01`,
    to: `${monthValue}-${pad(daysInMonth(year, month))}`,
  };
}

function resolve(selection: Selection): DateRange {
  switch (selection.kind) {
    case 'none':
      return { from: '', to: '' };
    case 'quick':
      return quickRange(selection.key);
    case 'month':
      return monthRange(selection.month);
    case 'custom':
      return { from: selection.from, to: selection.to };
  }
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function periodLabel(selection: Selection): string {
  switch (selection.kind) {
    case 'none':
      return 'Select Period';
    case 'quick':
      return QUICK_OPTIONS.find((o) => o.key === selection.key)?.label ?? '';
    case 'month': {
      const [year, month] = selection.month.split('-').map(Number);
      return `${MONTH_LABELS_FULL[month - 1]} ${year}`;
    }
    case 'custom':
      return `${formatBR(selection.from)} – ${formatBR(selection.to)}`;
  }
}

interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
}

export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('quick');
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [draftRange, setDraftRange] = useState<DayPickerRange | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function apply(next: Selection) {
    setSelection(next);
    onChange(resolve(next));
    setIsOpen(false);
  }

  function openPanel() {
    if (!isOpen) {
      if (selection.kind === 'custom') {
        setDraftRange({
          from: fromIsoDate(selection.from),
          to: fromIsoDate(selection.to),
        });
      }
      if (selection.kind === 'month') {
        setViewYear(Number(selection.month.split('-')[0]));
      }
      setTab(
        selection.kind === 'month'
          ? 'month'
          : selection.kind === 'custom'
            ? 'custom'
            : 'quick',
      );
    }
    setIsOpen((v) => !v);
  }

  function applyDraft() {
    if (!draftRange?.from || !draftRange?.to) return;
    apply({
      kind: 'custom',
      from: toIsoDate(draftRange.from),
      to: toIsoDate(draftRange.to),
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      >
        {periodLabel(selection)}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex border-b border-border">
            {TABS.map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 px-3 py-2 text-sm ${
                  tab === value
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="p-3">
            {tab === 'quick' && (
              <ul className="flex flex-col gap-1">
                {QUICK_OPTIONS.map((option) => (
                  <li key={option.key}>
                    <button
                      type="button"
                      onClick={() => apply({ kind: 'quick', key: option.key })}
                      className="w-full rounded-md px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent"
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'month' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y - 1)}
                    aria-label="Ano anterior"
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    ‹
                  </button>
                  <span className="text-sm font-medium text-foreground">
                    {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    aria-label="Próximo ano"
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_LABELS.map((m, idx) => {
                    const monthValue = `${viewYear}-${pad(idx + 1)}`;
                    const isSelected =
                      selection.kind === 'month' &&
                      selection.month === monthValue;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          apply({ kind: 'month', month: monthValue })
                        }
                        className={`rounded-md px-2 py-1.5 text-sm ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'custom' && (
              <div className="flex flex-col items-center gap-3">
                <Calendar
                  mode="range"
                  numberOfMonths={1}
                  selected={draftRange}
                  onSelect={setDraftRange}
                  defaultMonth={draftRange?.from}
                  className="p-0"
                />
                <Button
                  className="w-full"
                  disabled={!draftRange?.from || !draftRange?.to}
                  onClick={applyDraft}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
