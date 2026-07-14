import { useMemo } from 'react';
import { useActivities } from '@/lib/useActivities';
import { useTrainingMetrics } from './useTrainingMetrics';
import WeeklyVolumeChart from './WeeklyVolumeChart';
import PaceVsVolumeChart from './PaceVsVolumeChart';
import Z2StackedChart from './Z2StackedChart';
import PaceZoneHistogram from './PaceZoneHistogram';
import TrainingLoadChart from './TrainingLoadChart';
import AcwrChart from './AcwrChart';
import MonotonyStrainChart from './MonotonyStrainChart';

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

export default function RunAnalysisPage() {
  const { activities, loading, error } = useActivities();
  const weeks = useTrainingMetrics(activities);
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
          <Z2StackedChart weeks={completed} />
          <PaceZoneHistogram activities={activities} weeks={completed} />

          <SectionLabel>Training load</SectionLabel>
          <TrainingLoadChart weeks={completed} />
          <AcwrChart weeks={completed} />

          <MonotonyStrainChart weeks={completed} />
        </div>
      )}
    </div>
  );
}
