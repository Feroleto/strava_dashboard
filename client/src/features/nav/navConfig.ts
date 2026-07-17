import {
  Activity,
  Bike,
  LayoutGrid,
  Waves,
  type LucideIcon,
} from 'lucide-react';

export type PageId =
  'overview' | 'run/overview' | 'run/activities' | 'run/analysis';

export const DEFAULT_PAGE: PageId = 'run/activities';

/** localStorage key holding the persisted active page */
export const ACTIVE_PAGE_KEY = 'active-page';

export interface NavSubItem {
  id: PageId;
  labelKey: string;
}

export interface NavItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  /** page navigated to when the item itself (not a sub-item) is clicked */
  page?: PageId;
  subs?: NavSubItem[];
  disabled?: boolean;
  badgeKey?: string;
}

export interface NavSection {
  titleKey?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        id: 'overview',
        labelKey: 'sections.overview',
        icon: LayoutGrid,
        page: 'overview',
      },
    ],
  },
  {
    titleKey: 'sections.sportsTitle',
    items: [
      {
        id: 'run',
        labelKey: 'sections.run',
        icon: Activity,
        page: 'run/overview',
        subs: [
          { id: 'run/overview', labelKey: 'sections.runOverview' },
          { id: 'run/activities', labelKey: 'sections.runActivities' },
          { id: 'run/analysis', labelKey: 'sections.runAnalysis' },
        ],
      },
      {
        id: 'cycling',
        labelKey: 'sections.cycling',
        icon: Bike,
        disabled: true,
        badgeKey: 'badges.upcoming',
      },
      {
        id: 'swimming',
        labelKey: 'sections.swimming',
        icon: Waves,
        disabled: true,
        badgeKey: 'badges.upcoming',
      },
    ],
  },
];

/** id of the section-parent whose subs should be revealed, given the active page */
export function activeParentId(page: PageId): string | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.page === page) return item.id;
      if (item.subs?.some((s) => s.id === page)) return item.id;
    }
  }
  return null;
}

export function isKnownPage(value: string | null): value is PageId {
  return (
    value === 'overview' ||
    value === 'run/overview' ||
    value === 'run/activities' ||
    value === 'run/analysis'
  );
}
