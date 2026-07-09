import { useEffect, useRef, useState } from 'react';

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
    return `~${h}h ${m}min restantes`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `~${m}min ${s}s restantes`;
  }
  return `~${sec}s restantes`;
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
  let statusTone = 'text-muted-foreground';
  if (requestError) {
    statusLine = `Falha ao iniciar: ${requestError}`;
    statusTone = 'text-neg';
  } else if (running && status?.phase === 'listing') {
    statusLine = 'Buscando atividades no Strava…';
  } else if (running && status?.phase === 'rate_limited') {
    statusLine = 'Limite do Strava — aguardando 15 min';
    statusTone = 'text-neg';
  } else if (running) {
    statusLine =
      total != null
        ? `${synced} de ${total} salvas${errors > 0 ? `, ${errors} com erro` : ''}`
        : 'Processando atividades…';
  } else if (watching && status?.state === 'done') {
    statusLine =
      total === 0
        ? 'Sincronizado — nada novo'
        : `Sincronizado — ${synced} ${synced === 1 ? 'atividade salva' : 'atividades salvas'}${errors > 0 ? `, ${errors} com erro` : ''}`;
  } else if (watching && status?.state === 'error') {
    statusLine = `Falha no sync: ${status.message ?? 'erro desconhecido'}`;
    statusTone = 'text-neg';
  } else {
    statusLine = 'Baixar novas atividades';
  }

  return (
    <div className="mt-[26px]">
      <div className="mb-2.5 text-[11.5px] font-medium tracking-[.05em] uppercase text-muted-foreground">
        Strava
      </div>
      <div className="flex items-center justify-between gap-2.5">
        <p className={`min-w-0 text-[12.5px] ${statusTone}`}>{statusLine}</p>
        <button
          onClick={startSync}
          disabled={running}
          className="shrink-0 cursor-pointer rounded-[9px] bg-chip px-[13px] py-1.5 text-[12.5px] font-medium text-foreground hover:bg-grid-ax disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Sincronizando…' : 'Sync'}
        </button>
      </div>

      {running && (
        <div className="mt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-chip">
            {total == null ? (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-acc" />
            ) : (
              <div
                className="h-full rounded-full bg-acc transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            )}
          </div>
          {status?.etaSeconds != null && (
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {formatEta(status.etaSeconds)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
