import { useEffect, useMemo, useState } from 'react';
import { useActivityLaps } from './useActivityLaps';
import { useHrZones } from './useHrZones';
import { useMaxHr } from './useMaxHr';
import { useTrainingMetrics } from './useTrainingMetrics';
import { useDecoupling } from './useDecoupling';
import WeeklyVolumeChart from './WeeklyVolumeChart';
import PaceVsVolumeChart from './PaceVsVolumeChart';
import Z2StackedChart from './Z2StackedChart';
import PaceZoneHistogram from './PaceZoneHistogram';
import TrainingLoadChart from './TrainingLoadChart';
import AcwrChart from './AcwrChart';
import EfficiencyFactorChart from './EfficiencyFactorChart';
import MonotonyStrainChart from './MonotonyStrainChart';
import DecouplingTrendChart from './DecouplingTrendChart';

function SectionLabel({
  children,
  first = false,
}: {
  children: string;
  first?: boolean;
}) {
  return (
    <div
      className={`col-span-2 text-[11px] font-semibold tracking-[.08em] text-muted-foreground uppercase ${
        first ? '' : 'mt-6'
      }`}
    >
      {children}
    </div>
  );
}

function MaxHrControl({
  maxHr,
  onSave,
}: {
  maxHr: number | null;
  onSave: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState(maxHr != null ? String(maxHr) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setValue(maxHr != null ? String(maxHr) : '');
  }, [maxHr]);

  async function handleSave() {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 100 || parsed > 230) {
      setErr('Enter a whole number between 100 and 230');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(parsed);
    } catch {
      setErr('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
      <label htmlFor="max-hr-input">Max HR</label>
      <input
        id="max-hr-input"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 190"
        className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-foreground"
      />
      <span>bpm</span>
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md border border-border px-2 py-1 text-foreground hover:bg-chip"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {err ? (
        <span className="text-neg">{err}</span>
      ) : maxHr == null ? (
        <span>
          optional — used as a fallback Z2/EF cutoff when Strava's real zone
          data (premium only) isn't available
        </span>
      ) : null}
    </div>
  );
}

export default function RunAnalysisPage() {
  const { laps, loading, error } = useActivityLaps();
  const { zones: hrZones } = useHrZones();
  const { maxHr, save: saveMaxHr } = useMaxHr();
  const hasMaxHr = maxHr != null;
  const weeks = useTrainingMetrics(laps, maxHr, hrZones);
  const decoupling = useDecoupling(laps);
  // the trailing partial week is a mid-week artifact (every metric plunges
  // until Sunday) — every chart reads completed weeks only, same convention
  // the app already uses elsewhere for weekly training metrics
  const completed = useMemo(
    () => (weeks.at(-1)?.isPartial ? weeks.slice(0, -1) : weeks),
    [weeks],
  );

  if (error) {
    return (
      <p className="p-10 text-center text-[13.5px] text-neg">Error: {error}</p>
    );
  }

  return (
    <div className="p-[30px_34px_34px] tabular-nums">
      <h1 className="text-[19px] font-semibold tracking-[-.01em] text-foreground">
        Analysis
      </h1>
      <p className="mt-[2px] text-[12.5px] text-muted-foreground">
        Run · performance and training load
      </p>
      <MaxHrControl maxHr={maxHr} onSave={saveMaxHr} />

      {loading ? (
        <p className="p-10 text-center text-[13.5px] text-muted-foreground">
          Loading…
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <SectionLabel first>Volume</SectionLabel>
          <WeeklyVolumeChart weeks={completed} />
          <PaceVsVolumeChart weeks={completed} />

          <SectionLabel>Intensity zones</SectionLabel>
          <Z2StackedChart weeks={completed} hasMaxHr={hasMaxHr} />
          <PaceZoneHistogram laps={laps} weeks={completed} />

          <SectionLabel>Training load</SectionLabel>
          <TrainingLoadChart weeks={completed} />
          <AcwrChart weeks={completed} />
          <EfficiencyFactorChart weeks={completed} hasMaxHr={hasMaxHr} />
          <DecouplingTrendChart points={decoupling} />

          <MonotonyStrainChart weeks={completed} />
        </div>
      )}
    </div>
  );
}
