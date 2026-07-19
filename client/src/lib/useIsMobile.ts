import { useEffect, useState } from 'react';

// keep in sync with Tailwind's `md` breakpoint: below it the mobile layout
// (tab bar, stacked pages, touch interactions) applies
const QUERY = '(max-width: 767px)';

/** one-off check, safe outside React (and in pure vitest tests, no jsdom) */
export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(isMobileViewport);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
