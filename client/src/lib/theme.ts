export type ThemePref = 'auto' | 'light' | 'dark';

// second tuple element is a common.json key, translated at render time
export const THEME_OPTIONS: [ThemePref, string][] = [
  ['auto', 'theme.auto'],
  ['light', 'theme.light'],
  ['dark', 'theme.dark'],
];

/** anything other than an explicit manual choice means "follow the browser" */
export function parseThemePref(stored: string | null): ThemePref {
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}
