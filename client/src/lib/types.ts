export interface Activity {
  id: string;
  name: string;
  workoutType: string;
  startDate: string;
  distanceKm: number | null;
  movingTimeSec: number;
  paceRawSecKm: number | null;
  elevationGainM: number | null;
  averageBpm: number | null;
  maxBpm: number | null;
  averageCadence: number | null;
}

export interface ActivitiesResponse {
  items: Activity[];
  total: number;
}

export interface ActivityLap {
  id: string;
  lapIndex: number;
  lapType: string;
  movingDurationSec: number;
  distanceM: number;
  avgPaceSecKm: number;
  avgHr: number;
  maxHr: number | null;
  elevGainM: number;
  avgCadence: number;
}

export interface ActivityDetail extends Activity {
  summaryPolyline: string | null;
  laps: ActivityLap[];
}

// flat, cross-activity lap for GET /activities/laps (Run > Analysis) — avgHr
// is 0 (never null) when no HR monitor was present for that lap
export interface ActivityLapPoint {
  activityId: string;
  activityStartDate: string;
  distanceM: number;
  movingDurationSec: number;
  avgPaceSecKm: number;
  avgHr: number;
}

export interface ActivityLapsResponse {
  items: ActivityLapPoint[];
}

export interface Gear {
  id: string;
  name: string;
  brandName: string | null;
  modelName: string | null;
  distance: number;
  computedDistanceM: number;
  runCount: number;
  firstUseDate: string | null;
  lastUseDate: string | null;
  primary: boolean;
  retired: boolean;
}

export interface PersonalBestRecord {
  name: string;
  /** 1–3, derived server-side from moving time (fastest first) */
  rank: number;
  movingTime: number;
  /** meters, as measured by Strava for the effort */
  distance: number;
  startDate: string;
  activityId: string;
  /** Strava's rank frozen at upload time — "was a PR back then" */
  prRank: number | null;
}
