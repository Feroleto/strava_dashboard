import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/features/nav/Sidebar';
import PlaceholderPage from '@/features/nav/PlaceholderPage';
import Dashboard from '@/features/dashboard/Dashboard';
import RunOverviewPage from '@/features/overview/RunOverviewPage';
import RunAnalysisPage from '@/features/analysis/RunAnalysisPage';
import LoginPage from '@/features/auth/LoginPage';
import FirstSyncPage, {
  FIRST_SYNC_FLAG,
} from '@/features/onboarding/FirstSyncPage';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import type { ActivitiesResponse } from '@/lib/types';
import {
  DEFAULT_PAGE,
  isKnownPage,
  type PageId,
} from '@/features/nav/navConfig';

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

function App() {
  const { user, loading } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true',
  );
  const [page, setPage] = useState<PageId>(() => {
    const stored = localStorage.getItem('active-page');
    return isKnownPage(stored) ? stored : DEFAULT_PAGE;
  });
  // first-access gate: null while checking whether the user has any imported
  // activity yet; onboardingDone lets FirstSyncPage hand off to the dashboard
  const [hasActivities, setHasActivities] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiFetch('/activities?limit=1')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivitiesResponse) => setHasActivities(data.total > 0))
      // fail open — the dashboard surfaces its own fetch errors
      .catch(() => setHasActivities(true));
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('active-page', page);
  }, [page]);

  const navigate = (next: PageId, opts?: { collapse?: boolean }) => {
    setPage(next);
    if (opts?.collapse) setCollapsed(true);
  };

  if (loading || (user && hasActivities === null)) {
    return <div className="min-h-screen bg-page-bg" />;
  }

  if (!user) {
    return <LoginPage theme={theme} onTheme={setTheme} />;
  }

  // no imported history yet (or a first import is still running after a
  // reload) → onboarding sync screen instead of an empty dashboard
  if (
    !onboardingDone &&
    (hasActivities === false || localStorage.getItem(FIRST_SYNC_FLAG) != null)
  ) {
    return (
      <FirstSyncPage
        onDone={() => {
          setHasActivities(true);
          setOnboardingDone(true);
        }}
      />
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
          <PageContent page={page} />
        </div>
      </div>
    </div>
  );
}

export default App;
