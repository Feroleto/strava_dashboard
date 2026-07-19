import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SegmentedControl from '@/components/SegmentedControl';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppLanguage } from '@/i18n/useAppLanguage';
import { THEME_OPTIONS, type ThemePref } from '@/lib/theme';

interface ProfilePageProps {
  themePref: ThemePref;
  onThemePref: (pref: ThemePref) => void;
}

function PrefRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[52px] items-center justify-between gap-3 py-2 ${
        last ? '' : 'border-b border-border'
      }`}
    >
      <div className="text-[13.5px] font-medium text-foreground">{label}</div>
      {children}
    </div>
  );
}

/** account/preferences page — reached via the mobile tab bar's "Profile" tab */
export default function ProfilePage({
  themePref,
  onThemePref,
}: ProfilePageProps) {
  const { t } = useTranslation('nav');
  const { user, logout } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const initials = user?.firstName
    ? user.firstName.slice(0, 2).toUpperCase()
    : '—';
  const themes: [ThemePref, string][] = THEME_OPTIONS.map(([k, key]) => [
    k,
    t(`common:${key}`),
  ]);

  return (
    <div className="mx-auto max-w-[560px] px-5 pt-[18px] pb-[44px] md:px-[34px] md:pt-[30px] md:pb-[34px]">
      {/* on mobile the section title lives in the app bar (MobileChrome) */}
      <h1 className="hidden text-[19px] font-semibold tracking-[-.01em] text-foreground md:block">
        {t('profile.title')}
      </h1>

      <div className="flex items-center gap-3.5 rounded-[14px] border border-border bg-card p-4 md:mt-5">
        {user?.profileImgUrl ? (
          <img
            src={user.profileImgUrl}
            alt=""
            width={52}
            height={52}
            className="h-[52px] w-[52px] flex-none rounded-full object-cover"
          />
        ) : (
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-chip text-[17px] font-semibold text-foreground">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-foreground">
            {user?.firstName ?? t('runnerFallback')}
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-pos-bg px-[9px] py-[3px] text-[10.5px] font-semibold text-pos">
            <span className="h-[5px] w-[5px] rounded-full bg-pos" />
            {t('onboarding:badge.connected')}
          </div>
        </div>
      </div>

      <div className="mt-3.5 rounded-[14px] border border-border bg-card px-4 py-1">
        <PrefRow label={t('profile.units')}>
          <span className="text-[13px] text-muted-foreground">
            {t('profile.unitsKm')}
          </span>
        </PrefRow>
        <PrefRow label={t('profile.theme')}>
          <SegmentedControl
            size="compact"
            items={themes}
            active={themePref}
            onPick={onThemePref}
          />
        </PrefRow>
        <PrefRow label={t('profile.language')} last>
          <SegmentedControl
            size="compact"
            items={[
              ['pt', 'PT'],
              ['en', 'EN'],
            ]}
            active={language}
            onPick={setLanguage}
          />
        </PrefRow>
      </div>

      <button
        onClick={() => void logout()}
        className="mt-3.5 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-border bg-card text-[14px] font-semibold text-neg"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.8} />
        {t('logOut')}
      </button>
    </div>
  );
}
