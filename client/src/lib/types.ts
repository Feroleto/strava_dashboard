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
  elevGainM: number;
  avgCadence: number;
}

export interface ActivityDetail extends Activity {
  summaryPolyline: string | null;
  laps: ActivityLap[];
}
