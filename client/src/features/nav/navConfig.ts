import {
  Activity,
  Bike,
  LayoutGrid,
  Waves,
  type LucideIcon,
} from 'lucide-react';

export type PageId =
  'overview' | 'run/activities' | 'run/personal-best' | 'run/shoes';

export const DEFAULT_PAGE: PageId = 'run/activities';

export interface NavSubItem {
  id: PageId;
  label: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** page navigated to when the item itself (not a sub-item) is clicked */
  page?: PageId;
  subs?: NavSubItem[];
  disabled?: boolean;
  badge?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutGrid, page: 'overview' },
    ],
  },
  {
    title: 'Sports',
    items: [
      {
        id: 'run',
        label: 'Run',
        icon: Activity,
        page: 'run/activities',
        subs: [
          { id: 'run/activities', label: 'Activities' },
          { id: 'run/personal-best', label: 'Personal Best' },
          { id: 'run/shoes', label: 'Shoes' },
        ],
      },
      {
        id: 'cycling',
        label: 'Cycling',
        icon: Bike,
        disabled: true,
        badge: 'UPCOMING',
      },
      {
        id: 'swimming',
        label: 'Swimming',
        icon: Waves,
        disabled: true,
        badge: 'UPCOMING',
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
    value === 'run/activities' ||
    value === 'run/personal-best' ||
    value === 'run/shoes'
  );
}
