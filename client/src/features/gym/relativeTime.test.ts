import { describe, it, expect } from 'vitest';
import { relativeTimeFromNow } from './relativeTime';

const NOW = new Date('2026-07-20T12:00:00.000Z').getTime();
const isoDaysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe('relativeTimeFromNow', () => {
  it('returns today for same-day timestamps', () => {
    expect(relativeTimeFromNow(isoDaysAgo(0), NOW)).toEqual({ unit: 'today', count: 0 });
  });

  it('returns yesterday for exactly one day back', () => {
    expect(relativeTimeFromNow(isoDaysAgo(1), NOW)).toEqual({ unit: 'yesterday', count: 1 });
  });

  it('returns days for 2-6 days back', () => {
    expect(relativeTimeFromNow(isoDaysAgo(5), NOW)).toEqual({ unit: 'days', count: 5 });
  });

  it('returns weeks for 7-34 days back', () => {
    expect(relativeTimeFromNow(isoDaysAgo(14), NOW)).toEqual({ unit: 'weeks', count: 2 });
  });

  it('returns months for 35-364 days back', () => {
    expect(relativeTimeFromNow(isoDaysAgo(60), NOW)).toEqual({ unit: 'months', count: 2 });
  });

  it('returns years for 365+ days back', () => {
    expect(relativeTimeFromNow(isoDaysAgo(400), NOW)).toEqual({ unit: 'years', count: 1 });
  });
});
