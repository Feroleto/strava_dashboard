import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface SyncStatus {
  state: 'idle' | 'running' | 'done' | 'error';
  phase: 'listing' | 'processing' | 'rate_limited' | null;
  total: number | null;
  processed: number;
  synced: number;
  errors: number;
  etaSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}

interface SyncPanelProps {
  onSynced: () => void;
}

const POLL_MS = 2000;

function formatEta(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `~${h}h ${m}min remaining`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `~${m}min ${s}s remaining`;
  }
  return `~${sec}s remaining`;
}

export default function SyncPanel({ onSynced }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  // whether this session watched the current/last sync run (avoids showing a
  // stale "sync complete" message from a run that finished before page load)
  const [watching, setWatching] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const running = status?.state === 'running';

  useEffect(() => {
    fetch('http://localhost:3000/strava/sync/status')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((s: SyncStatus) => {
        setStatus(s);
        if (s.state === 'running') setWatching(true);
      })
      .catch(() => {
        // status is cosmetic on load; the button will surface real errors
      });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      fetch('http://localhost:3000/strava/sync/status')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((s: SyncStatus) => {
          setStatus(s);
          if (s.state !== 'running') onSyncedRef.current();
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [running]);

  const startSync = () => {
    setRequestError(null);
    setWatching(true);
    fetch('http://localhost:3000/strava/sync', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((s: SyncStatus) => setStatus(s))
      .catch((err) => setRequestError(err.message));
  };

  const total = status?.total ?? null;
  const processed = status?.processed ?? 0;
  const synced = status?.synced ?? 0;
  const errors = status?.errors ?? 0;
  const percent =
    total == null ? 0 : total === 0 ? 100 : (processed / total) * 100;

  let statusLine: string;
  let statusTone = 'text-slate-400';
  if (requestError) {
    statusLine = `Failed to start sync: ${requestError}`;
    statusTone = 'text-red-400';
  } else if (running && status?.phase === 'listing') {
    statusLine = 'Fetching activity list from Strava…';
  } else if (running && status?.phase === 'rate_limited') {
    statusLine = 'Strava rate limit hit — waiting 15 minutes before resuming';
    statusTone = 'text-amber-400';
  } else if (running) {
    statusLine = 'Downloading and processing activities…';
  } else if (watching && status?.state === 'done') {
    statusLine =
      total === 0
        ? 'Sync complete — no new activities'
        : `Sync complete — ${synced} ${synced === 1 ? 'activity' : 'activities'} saved${errors > 0 ? `, ${errors} failed` : ''}`;
  } else if (watching && status?.state === 'error') {
    statusLine = `Sync failed: ${status.message ?? 'unknown error'}`;
    statusTone = 'text-red-400';
  } else {
    statusLine = 'Download new activities from Strava';
  }

  return (
    <div className="mb-4 rounded border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Strava sync</h2>
          <p className={`mt-0.5 text-xs ${statusTone}`}>{statusLine}</p>
        </div>
        <Button size="sm" onClick={startSync} disabled={running}>
          {running ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>

      {running && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            {total == null ? (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            ) : (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline justify-between text-xs text-slate-400">
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {synced} of {total ?? '…'} activities saved
              {errors > 0 && (
                <span className="text-red-400">, {errors} failed</span>
              )}
            </span>
            {status?.etaSeconds != null && (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatEta(status.etaSeconds)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
