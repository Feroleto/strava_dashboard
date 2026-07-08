import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKOUT_LABEL, formatDuration, formatPace } from './activityFormat';

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
  averageCadence: number | null;
}

interface ActivitiesResponse {
  items: Activity[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export default function ActivitiesList() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [workoutType, setWorkoutType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
    });
    if (workoutType) params.set('workoutType', workoutType);

    fetch(`http://localhost:3000/activities?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivitiesResponse) => {
        setActivities(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, workoutType]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (error)
    return <p className="p-8 text-center text-red-400">Error: {error}</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Activities</h1>
        <select
          value={workoutType}
          onChange={(e) => {
            setWorkoutType(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="">All types</option>
          {Object.entries(WORKOUT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="p-8 text-center text-slate-400">Loading...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[
                'Data',
                'Activity Name',
                'Type',
                'Distance',
                'Time',
                'Pace',
                'Cadence',
                'HR',
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
            {activities.map((a) => (
              <tr
                key={a.id}
                onClick={() => navigate(`/activities/${a.id}`)}
                className="cursor-pointer hover:bg-slate-800/60"
              >
                <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                  {new Date(a.startDate).toLocaleDateString('pt-BR')}
                </td>
                <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                  {a.name}
                </td>
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
                  {a.averageCadence ? Math.round(a.averageCadence) : '-'}
                </td>
                <td className="border-b border-slate-800 px-3 py-2 text-sm text-slate-200">
                  {a.averageBpm ? Math.round(a.averageBpm) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
