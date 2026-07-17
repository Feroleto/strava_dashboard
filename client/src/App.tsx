import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/features/nav/Sidebar';
import PlaceholderPage from '@/features/nav/PlaceholderPage';
import { FIRST_SYNC_FLAG } from '@/features/onboarding/firstSyncFlag';
import { useAuth } from '@/features/auth/AuthContext';
import {
  PAGE_IMPORTERS,
  bootHasActivities,
  recordHasActivities,
} from '@/lib/boot';
import {
  ACTIVE_PAGE_KEY,
  DEFAULT_PAGE,
  isKnownPage,
  type PageId,
} from '@/features/nav/navConfig';

// code-split per page: keeps Leaflet, the analysis charts and the dashboard
// out of the entry chunk that the logged-out LoginPage visitor downloads.
// Importers are shared with lib/boot.ts, which preloads the active page's
// chunk at t0 — same specifier, so the module map dedupes the download.
const Dashboard = lazy(PAGE_IMPORTERS['run/activities']!);
const RunOverviewPage = lazy(PAGE_IMPORTERS['run/overview']!);
const RunAnalysisPage = lazy(PAGE_IMPORTERS['run/analysis']!);
// login/onboarding are dead weight for the recurring logged-in user; boot.ts
// preloads whichever one the localStorage hints predict will be needed
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const FirstSyncPage = lazy(() => import('@/features/onboarding/FirstSyncPage'));

function PageContent({ page }: { page: PageId }) {
  const { t } = useTranslation('nav');
  switch (page) {
    case 'overview':
      return <PlaceholderPage title={t('sections.overview')} />;
    case 'run/overview':
      return <RunOverviewPage />;
    case 'run/analysis':
      return <RunAnalysisPage />;
    case 'run/activities':
    default:
      return <Dashboard />;
  }
}

// real text content (not a bare background) so the first paint counts as
// FCP while the auth check waits on a possibly cold backend
function BootSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg">
      <div className="flex items-center gap-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-acc text-[14px] font-bold text-white">
          ST
        </div>
        <span className="text-[15px] font-semibold text-foreground">
          SoTreina
        </span>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true',
  );
  const [page, setPage] = useState<PageId>(() => {
    const stored = localStorage.getItem(ACTIVE_PAGE_KEY);
    return isKnownPage(stored) ? stored : DEFAULT_PAGE;
  });
  // first-access gate: null while checking whether the user has any imported
  // activity yet; onboardingDone lets FirstSyncPage hand off to the dashboard
  const [hasActivities, setHasActivities] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // the fetch itself started back in lib/boot.ts, possibly in parallel
    // with /auth/me — here we only consume the shared promise
    bootHasActivities.then((has) => {
      if (!cancelled) setHasActivities(has);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_PAGE_KEY, page);
  }, [page]);

  const navigate = (next: PageId, opts?: { collapse?: boolean }) => {
    setPage(next);
    if (opts?.collapse) setCollapsed(true);
  };

  if (loading || (user && hasActivities === null)) {
    return <BootSplash />;
  }

  if (!user) {
    return (
      <Suspense fallback={<BootSplash />}>
        <LoginPage theme={theme} onTheme={setTheme} />
      </Suspense>
    );
  }

  // no imported history yet (or a first import is still running after a
  // reload) → onboarding sync screen instead of an empty dashboard
  if (
    !onboardingDone &&
    (hasActivities === false || localStorage.getItem(FIRST_SYNC_FLAG) != null)
  ) {
    return (
      <Suspense fallback={<BootSplash />}>
        <FirstSyncPage
          onDone={() => {
            recordHasActivities(true);
            setHasActivities(true);
            setOnboardingDone(true);
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg p-3.5">
      <div className="flex items-start gap-3.5">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          activePage={page}
          onNavigate={navigate}
          theme={theme}
          onTheme={setTheme}
        />
        <div
          className="min-h-[calc(100vh-28px)] min-w-0 flex-1 rounded-2xl border border-border bg-card"
          style={{ boxShadow: '0 8px 24px rgba(8,12,20,.06)' }}
        >
          <Suspense fallback={<div className="min-h-[calc(100vh-28px)]" />}>
            <PageContent page={page} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default App;
