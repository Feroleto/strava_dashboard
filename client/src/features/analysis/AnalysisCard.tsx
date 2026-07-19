import type { ReactNode } from 'react';
import SegmentedControl from '@/components/SegmentedControl';
import { PERIOD_OPTIONS, type AnalysisPeriod } from './period';

interface AnalysisCardProps {
  title: string;
  period: AnalysisPeriod;
  onPeriodChange: (p: AnalysisPeriod) => void;
  /** default reading, shown when nothing is hovered */
  insight: string;
  /** reading shown while hovering a point/bar/zone; null falls back to insight */
  hoverReading: string | null;
  fullWidth?: boolean;
  children: ReactNode;
}

export default function AnalysisCard({
  title,
  period,
  onPeriodChange,
  insight,
  hoverReading,
  fullWidth = false,
  children,
}: AnalysisCardProps) {
  return (
    <div
      className={`flex flex-col rounded-[12px] border border-border bg-card px-[18px] pt-4 pb-[10px] ${
        fullWidth ? 'md:col-span-2' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-semibold text-foreground">
          {title}
        </div>
        <SegmentedControl
          size="mini"
          items={PERIOD_OPTIONS}
          active={period}
          onPick={onPeriodChange}
        />
      </div>
      <div
        className={`mt-1 min-h-[15px] text-[11.5px] ${
          hoverReading ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {hoverReading ?? insight}
      </div>
      {children}
    </div>
  );
}
