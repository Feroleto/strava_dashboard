import { StravaActivityDetail } from '../strava-api.types';

export function classifyWorkoutType(
  activity: Pick<StravaActivityDetail, 'description'>,
): 'EASY_OR_LONG' | 'INTERVAL' | 'HILL_REPEATS' {
  const description = (activity.description ?? '').toLowerCase();

  const hillKeywords = ['hill', 'subida', 'elevação'];
  if (hillKeywords.some((k) => description.includes(k))) return 'HILL_REPEATS';

  const intervalKeywords = ['tiro', 'interval', 'split'];
  if (intervalKeywords.some((k) => description.includes(k))) return 'INTERVAL';

  if (/\d+\s*[xX*]\s*\d+/.test(description)) return 'INTERVAL';
  if (/\d+\s*[xX]\s*\d+[:\']/.test(description)) return 'INTERVAL';

  return 'EASY_OR_LONG';
}
