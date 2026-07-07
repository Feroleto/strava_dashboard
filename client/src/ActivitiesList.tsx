import { useEffect, useState } from 'react';

interface Activity {
  id: string;
  name: string;
  type: string;
  workoutType: string;
  startDate: string;
  distanceKm: number | null;
  movingTimeSec: number;
  paceRawSecKm: number | null;
  elevationGainM: number | null;
  averageBpm: number | null;
}

function formatPace(secPerKm: number | null): string {
  if (!secPerKm) return '—';
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

const WORKOUT_LABEL: Record<string, string> = {
  EASY_OR_LONG: 'Easy or Long Run',
  INTERVAL: 'Interval',
  HILL_REPEATS: 'Hill Repeats',
};

export default function ActivitiesList() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/activities?page=1&limit=20')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setActivities(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-center text-slate-400">Loading...</p>;
  if (error) return <p className="p-8 text-center text-red-400">Error: {error}</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-slate-100">Activities</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['Data', 'Activity Name', 'Type', 'Distance', 'Time', 'Pace', 'HR'].map((h) => (
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
          {activities.map((a) => (
            <tr key={a.id} className="hover:bg-slate-800/60">
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                {new Date(a.startDate).toLocaleDateString('pt-BR')}
              </td>
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">{a.name}</td>
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                {WORKOUT_LABEL[a.workoutType] ?? a.workoutType}
              </td>
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                {a.distanceKm ? `${a.distanceKm.toFixed(2)} km` : '—'}
              </td>
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                {formatDuration(a.movingTimeSec)}
              </td>
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                {formatPace(a.paceRawSecKm)}
              </td>
              <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                {a.averageBpm ? Math.round(a.averageBpm) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}