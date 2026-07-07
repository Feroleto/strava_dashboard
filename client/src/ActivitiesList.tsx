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

  if (loading) return <p className="status">Carregando...</p>;
  if (error) return <p className="status error">Erro: {error}</p>;

  return (
    <div className="activities">
      <h1>Activities</h1>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Activity Name</th>
            <th>Type</th>
            <th>Distance</th>
            <th>Time</th>
            <th>Pace</th>
            <th>HR</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.startDate).toLocaleDateString('pt-BR')}</td>
              <td>{a.name}</td>
              <td>{WORKOUT_LABEL[a.workoutType] ?? a.workoutType}</td>
              <td>{a.distanceKm ? `${a.distanceKm.toFixed(2)} km` : '—'}</td>
              <td>{formatDuration(a.movingTimeSec)}</td>
              <td>{formatPace(a.paceRawSecKm)}</td>
              <td>{a.averageBpm ? Math.round(a.averageBpm) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}