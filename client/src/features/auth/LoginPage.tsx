import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Lock } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { API_BASE_URL } from '@/lib/apiUrl';
import SegmentedControl from '@/components/SegmentedControl';
import { useAppLanguage } from '@/i18n/useAppLanguage';

// TODO: swap the button for Strava's official "Connect with Strava" asset
// (SVG/PNG from developers.strava.com/guidelines) once it's vendored into
// the repo — this mirrors the required brand orange (#FC4C02) and wordmark
// in the meantime. #FC4C02 is Strava's brand color: fixed in both themes,
// deliberately not tokenized.

function HowItWorksPopover() {
  const { t } = useTranslation('auth');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative self-start">
      {open && (
        <div className="absolute bottom-full left-0 mb-2.5 w-[300px] rounded-xl border border-border bg-popover p-4 text-[12px] leading-[1.55] text-popover-foreground shadow-lg">
          {t('login.howItWorks.body')}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11.5px] font-medium text-acc-tx hover:underline"
      >
        {t('login.howItWorks.trigger')}
      </button>
    </div>
  );
}

interface LoginPageProps {
  theme: 'light' | 'dark';
  onTheme: (theme: 'light' | 'dark') => void;
}

export default function LoginPage({ theme, onTheme }: LoginPageProps) {
  const { t } = useTranslation('auth');
  const { language, setLanguage } = useAppLanguage();
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState(() =>
    new URLSearchParams(window.location.search).has('auth_error'),
  );

  useEffect(() => {
    // keep the notice in state but drop ?auth_error=1 from the address bar
    if (authError) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [authError]);

  const connect = () => {
    if (connecting) return;
    setAuthError(false);
    setConnecting(true);
    window.location.href = `${API_BASE_URL}/strava/auth`;
  };

  return (
    <div className="flex h-screen">
      {/* Left panel — editorial, always dark regardless of app theme */}
      <div className="hidden min-w-0 flex-[1.25] flex-col bg-[#0B0F17] px-[44px] pt-[36px] md:flex">
        <div className="flex items-center gap-[10px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-acc text-[12px] font-bold text-white">
            ST
          </div>
          <span className="text-[14px] font-semibold text-[#EDF1F7]">
            SoTreina
          </span>
        </div>

        <div className="my-auto py-10">
          <h1 className="text-[40px] font-bold leading-[1.16] tracking-[-.025em] text-[#EDF1F7]">
            <Trans
              t={t}
              i18nKey="login.headline"
              components={{ br: <br />, acc: <span className="text-acc" /> }}
            />
          </h1>
          <p className="mt-4 text-[14.5px] leading-[1.5] text-[#8A93A5]">
            {t('login.subheadline')}
          </p>
        </div>

        <svg
          viewBox="0 0 720 120"
          className="mt-auto w-full"
          fill="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="110"
            x2="720"
            y2="110"
            stroke="rgba(255,255,255,.14)"
            strokeWidth="1"
          />
          <path
            d="M8 96 C 80 88 130 60 200 64 C 270 68 310 36 380 42 C 450 48 510 80 570 54 C 620 32 675 26 712 30"
            stroke="var(--acc)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".55"
          />
        </svg>
      </div>

      {/* Right panel — login, follows the app theme */}
      {/* seam treatment against the always-dark left panel (md+ only — the seam
          doesn't exist on mobile): dark matches its #0B0F17 + hairline border;
          light keeps bg-card with an inset shadow as if the dark panel cast it */}
      <div className="relative flex w-full flex-none flex-col justify-center bg-card px-[52px] py-[48px] md:w-[480px] md:shadow-[inset_20px_0_30px_-22px_rgba(8,12,20,.42)] dark:bg-[#0B0F17] md:dark:border-l md:dark:border-white/[.09] dark:shadow-none">
        <div className="absolute right-[26px] top-[26px] flex items-center gap-2">
          <SegmentedControl
            size="compact"
            items={[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            active={theme}
            onPick={onTheme}
          />
          <SegmentedControl
            size="compact"
            items={[
              ['pt', 'PT'],
              ['en', 'EN'],
            ]}
            active={language}
            onPick={setLanguage}
          />
        </div>

        <h2 className="text-[20px] font-semibold tracking-[-.01em] text-foreground">
          {t('login.signIn')}
        </h2>
        <p className="mt-[7px] text-[13px] leading-[1.55] text-muted-foreground">
          {t('login.signInSubtitle')}
        </p>

        {authError && (
          <p className="mt-[18px] text-[12px] text-neg">
            {t('login.authError')}
          </p>
        )}

        <button
          type="button"
          onClick={connect}
          disabled={connecting}
          className="mt-[26px] flex w-full items-center justify-center gap-[9px] rounded-[11px] bg-[#FC4C02] py-[13px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#E04300] disabled:cursor-default disabled:opacity-80 disabled:hover:bg-[#FC4C02]"
        >
          {connecting ? (
            <>
              <Loader2 size={15} className="animate-spin" strokeWidth={2} />
              {t('login.connecting')}
            </>
          ) : (
            <>
              {t('login.connect')}
              <ArrowRight size={15} strokeWidth={2} />
            </>
          )}
        </button>

        <p className="mt-[11px] text-[11.5px] text-muted-foreground">
          {t('login.redirectNotice')}
        </p>

        <div className="absolute bottom-[26px] left-[52px] right-[52px] flex flex-col gap-[10px]">
          <div className="flex items-start gap-[7px] text-muted-foreground">
            <Lock size={14} strokeWidth={1.7} className="mt-px shrink-0" />
            <span className="text-[11px] leading-[1.5]">
              {t('login.readOnlyNotice')}
            </span>
          </div>
          <HowItWorksPopover />
        </div>
      </div>
    </div>
  );
}
