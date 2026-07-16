import { API_BASE_URL } from '@/lib/apiUrl';

// TODO: swap this for Strava's official "Connect with Strava" button asset
// (SVG/PNG from developers.strava.com/guidelines) once it's vendored into
// the repo — this mirrors the required brand orange (#FC4C02) and wordmark
// in the meantime rather than shipping a generic gray button
export default function LoginScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg p-3.5">
      <div className="flex w-full max-w-[380px] flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 text-center">
        <div>
          <div className="text-[20px] font-semibold text-foreground">SOCORRE</div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Sign in with your Strava account to see your training data.
          </p>
        </div>

        <a
          href={`${API_BASE_URL}/strava/auth`}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] px-5 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#FC4C02' }}
        >
          Connect with Strava
        </a>
      </div>
    </div>
  );
}
