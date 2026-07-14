export type AnalysisPeriod = '4' | '8' | '12' | 'all';

export const PERIOD_OPTIONS: [AnalysisPeriod, string][] = [
  ['4', '4w'],
  ['8', '8w'],
  ['12', '12w'],
  ['all', 'All'],
];

export function sliceByPeriod<T>(items: T[], period: AnalysisPeriod): T[] {
  return period === 'all' ? items : items.slice(-Number(period));
}
