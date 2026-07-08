import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WORKOUT_LABEL, formatDuration, formatPace } from './activityFormat';

interface ActivityLap {
  id: string;
  lapIndex: number;
  lapType: string;
  startSec: number;
  endSec: number;
  totalDurationSec: number;
  movingDurationSec: number;
  distanceM: number;
  avgPaceSecKm: number;
  avgHr: number;
  elevGainM: number;
  avgGradePercent: number | null;
  vam: number | null;
  avgCadence: number | null;
}

interface ActivityDetail {
  id: string;
  name: string;
  type: string;
  sportType: string | null;
  workoutType: string;
  startDate: string;
  distanceKm: number | null;
  movingTimeSec: number;
  paceRawSecKm: number | null;
  elevationGainM: number | null;
  averageBpm: number | null;
  maxBpm: number | null;
  averageCadence: number | null;
  laps: ActivityLap[];
}

const LAP_TYPE_LABEL: Record<string, string> = {
  RUN: 'Run',
  WORKOUT: 'Workout',
  REST: 'Rest',
  STEADY: 'Steady',
  WARMUP: 'Warmup',
  COOLDOWN: 'Cooldown',
  ACTIVITY: 'Activity',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 px-4 py-3">
      <div className="text-xs font-semibold uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg text-slate-100">{value}</div>
    </div>
  );
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:3000/activities/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivityDetail) => setActivity(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return <p className="p-8 text-center text-slate-400">Loading...</p>;
  if (error)
    return <p className="p-8 text-center text-red-400">Error: {error}</p>;
  if (!activity) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
        ← Back to activities
      </Link>

      <h1 className="mt-2 mb-1 text-2xl font-semibold text-slate-100">
        {activity.name}
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        {new Date(activity.startDate).toLocaleString('pt-BR')} · {activity.type}
        {activity.sportType ? ` (${activity.sportType})` : ''} ·{' '}
        {WORKOUT_LABEL[activity.workoutType] ?? activity.workoutType}
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Distance"
          value={
            activity.distanceKm ? `${activity.distanceKm.toFixed(2)} km` : '—'
          }
        />
        <Stat label="Time" value={formatDuration(activity.movingTimeSec)} />
        <Stat label="Pace" value={formatPace(activity.paceRawSecKm)} />
        <Stat
          label="Elevation Gain"
          value={
            activity.elevationGainM
              ? `${Math.round(activity.elevationGainM)} m`
              : '—'
          }
        />
        <Stat
          label="Avg HR"
          value={
            activity.averageBpm ? `${Math.round(activity.averageBpm)} bpm` : '—'
          }
        />
        <Stat
          label="Max HR"
          value={activity.maxBpm ? `${Math.round(activity.maxBpm)} bpm` : '—'}
        />
        <Stat
          label="Avg Cadence"
          value={
            activity.averageCadence
              ? `${Math.round(activity.averageCadence)} spm`
              : '—'
          }
        />
      </div>

      {activity.laps.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Laps</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  '#',
                  'Type',
                  'Duration',
                  'Distance',
                  'Pace',
                  'Avg HR',
                  'Elev Gain',
                  'Grade',
                  'Cadence',
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.laps.map((lap) => (
                <tr key={lap.id} className="hover:bg-slate-800/60">
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {lap.lapIndex}
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {LAP_TYPE_LABEL[lap.lapType] ?? lap.lapType}
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {formatDuration(lap.movingDurationSec)}
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {(lap.distanceM / 1000).toFixed(2)} km
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {formatPace(lap.avgPaceSecKm)}
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {Math.round(lap.avgHr)}
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {Math.round(lap.elevGainM)} m
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {lap.avgGradePercent !== null
                      ? `${lap.avgGradePercent.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                    {lap.avgCadence !== null ? Math.round(lap.avgCadence) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
