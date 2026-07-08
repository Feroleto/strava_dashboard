import { useEffect, useRef, useState } from 'react';

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
  { key: 'allRuns', label: 'All Runs'},
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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function quickRange(key: QuickKey): DateRange {
  const today = new Date();
  const to = toIsoDate(today);

  if (key === 'allRuns'){
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
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
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
        setDraftFrom(selection.from);
        setDraftTo(selection.to);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
      >
        {periodLabel(selection)}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded border border-slate-700 bg-slate-900 shadow-lg">
          <div className="flex border-b border-slate-800">
            {TABS.map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 px-3 py-2 text-sm ${
                  tab === value
                    ? 'border-b-2 border-slate-300 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
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
                      className="w-full rounded px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
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
                    className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    ‹
                  </button>
                  <span className="text-sm font-medium text-slate-200">
                    {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    aria-label="Próximo ano"
                    className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
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
                        className={`rounded px-2 py-1.5 text-sm ${
                          isSelected
                            ? 'bg-slate-700 text-slate-100'
                            : 'text-slate-300 hover:bg-slate-800'
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
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  From
                  <input
                    type="date"
                    value={draftFrom}
                    max={draftTo || undefined}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  To
                  <input
                    type="date"
                    value={draftTo}
                    min={draftFrom || undefined}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                  />
                </label>
                <button
                  type="button"
                  disabled={!draftFrom || !draftTo}
                  onClick={() =>
                    apply({ kind: 'custom', from: draftFrom, to: draftTo })
                  }
                  className="mt-1 rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
