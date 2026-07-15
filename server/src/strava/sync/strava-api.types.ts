// Lightweight shapes for the Strava API payloads consumed by the sync
// pipeline. Only the fields actually read by the app are declared; most are
// optional because Strava omits them depending on how the activity was
// recorded (no GPS, no HR monitor, etc)

export interface StravaActivitySummary {
  id: number;
  type: string;
  name?: string;
  gear_id?: string | null;
  map?: { summary_polyline?: string | null };
}

export interface StravaLap {
  lap_index?: number;
  name?: string;
  average_speed?: number;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  start_index?: number;
  end_index?: number;
}

export interface StravaSplitMetric {
  split: number;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_speed?: number;
  average_heartrate?: number;
  elevation_difference?: number;
}

export interface StravaActivityDetail extends StravaActivitySummary {
  name: string;
  sport_type?: string | null;
  start_date: string;
  distance?: number | null;
  moving_time: number;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  description?: string | null;
  laps?: StravaLap[];
  splits_metric?: StravaSplitMetric[];
  best_efforts?: StravaBestEffort[];
}

export interface StravaBestEffort {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  start_date: string;
  pr_rank?: number | null;
  start_index?: number;
  end_index?: number;
}

export interface StravaGear {
  id: string;
  name: string;
  brand_name?: string | null;
  model_name?: string | null;
  distance: number;
  primary: boolean;
  retired: boolean;
}

export type StravaStreamSet = Record<string, { data: number[] } | undefined>;

export interface StravaAthleteZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: { min: number; max: number }[];
  };
}

export interface StravaActivityZoneDistribution {
  type: string;
  distribution_buckets: { min: number; max: number; time: number }[];
}
