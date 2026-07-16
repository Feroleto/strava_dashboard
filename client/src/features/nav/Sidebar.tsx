import type { ReactNode } from 'react';
import { ChevronLeft, LogOut, Plus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import SegmentedControl from '@/components/SegmentedControl';
import { useAuth } from '@/features/auth/AuthContext';
import {
  NAV_SECTIONS,
  activeParentId,
  type NavItem,
  type NavSubItem,
  type PageId,
} from './navConfig';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activePage: PageId;
  onNavigate: (page: PageId, opts?: { collapse?: boolean }) => void;
  theme: 'light' | 'dark';
  onTheme: (theme: 'light' | 'dark') => void;
}

function SidebarLabel({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out',
        collapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100',
        className,
      )}
    >
      {children}
    </span>
  );
}

function isItemActive(item: NavItem, activePage: PageId): boolean {
  if (item.subs) return activeParentId(activePage) === item.id;
  return item.page === activePage;
}

function NavItemRow({
  item,
  collapsed,
  active,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      disabled={item.disabled}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[9px] px-[9px] py-2 text-[13px] font-medium',
        collapsed && 'justify-center',
        item.disabled
          ? 'cursor-not-allowed text-muted-foreground'
          : active
            ? 'cursor-pointer bg-acc-bg font-semibold text-acc-tx'
            : 'cursor-pointer text-foreground hover:bg-chip',
      )}
    >
      <Icon className="h-4 w-4 flex-none" strokeWidth={1.7} />
      <SidebarLabel collapsed={collapsed} className="flex-1 text-left">
        {item.label}
      </SidebarLabel>
      {item.badge && (
        <SidebarLabel collapsed={collapsed} className="flex-none">
          <span className="rounded-[5px] bg-chip px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.02em] text-muted-foreground uppercase">
            {item.badge}
          </span>
        </SidebarLabel>
      )}
    </button>
  );
}

function SubList({
  subs,
  activePage,
  onPick,
}: {
  subs: NavSubItem[];
  activePage: PageId;
  onPick: (sub: NavSubItem) => void;
}) {
  return (
    <div className="mt-1 mb-1 ml-[18px] flex flex-col gap-0.5 border-l border-border pl-3">
      {subs.map((sub) => {
        const active = sub.id === activePage;
        return (
          <button
            key={sub.id}
            onClick={() => onPick(sub)}
            className={cn(
              'relative cursor-pointer rounded-[7px] py-[5px] text-left text-[12.5px]',
              active
                ? 'font-semibold text-acc-tx'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <span className="absolute top-0 -left-3 h-full w-[2px] bg-acc" />
            )}
            {sub.label}
          </button>
        );
      })}
    </div>
  );
}

function AddSportRow({ collapsed }: { collapsed: boolean }) {
  const Icon: LucideIcon = Plus;
  return (
    <button
      disabled
      title={collapsed ? 'Add a Sport' : undefined}
      className={cn(
        'flex w-full cursor-not-allowed items-center gap-2.5 rounded-[9px] border border-dashed border-grid-ax px-[9px] py-2 text-[13px] font-medium text-muted-foreground',
        collapsed && 'justify-center',
      )}
    >
      <Icon className="h-4 w-4 flex-none" strokeWidth={1.7} />
      <SidebarLabel collapsed={collapsed}>Add a Sport</SidebarLabel>
    </button>
  );
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  activePage,
  onNavigate,
  theme,
  onTheme,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const initials = user?.firstName ? user.firstName.slice(0, 2).toUpperCase() : '—';

  const handleNavClick = (item: NavItem) => {
    if (item.disabled) return;
    if (item.subs) {
      onNavigate(item.page ?? item.subs[0].id);
    } else if (item.page) {
      onNavigate(item.page, { collapse: true });
    }
  };

  return (
    <div
      className={cn(
        'sticky top-3.5 h-[calc(100vh-28px)] flex-none rounded-2xl border border-border bg-card transition-[width] duration-[280ms] ease-in-out',
        collapsed ? 'w-[66px]' : 'w-[226px]',
      )}
      style={{ boxShadow: '0 8px 24px rgba(8,12,20,.08)' }}
    >
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute top-[27px] -right-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-card"
        style={{ boxShadow: '0 2px 8px rgba(8,12,20,.16)' }}
      >
        <ChevronLeft
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-[280ms]',
            collapsed && 'rotate-180',
          )}
          strokeWidth={1.7}
        />
      </button>

      <div className="flex h-full flex-col overflow-hidden px-3 pt-5 pb-4">
        <div className="flex items-center gap-2.5 px-[9px]">
          <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-acc text-[14px] font-bold text-white">
            SD
          </div>
          <SidebarLabel
            collapsed={collapsed}
            className="text-[15px] font-semibold text-foreground"
          >
            Strava Dashboard
          </SidebarLabel>
        </div>

        <nav className="mt-6 flex flex-col gap-4">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i}>
              {section.title && (
                <SidebarLabel
                  collapsed={collapsed}
                  className="mb-1.5 block px-[9px] text-[10.5px] font-semibold tracking-[.07em] text-muted-foreground uppercase"
                >
                  {section.title}
                </SidebarLabel>
              )}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <div key={item.id}>
                    <NavItemRow
                      item={item}
                      collapsed={collapsed}
                      active={isItemActive(item, activePage)}
                      onClick={() => handleNavClick(item)}
                    />
                    {item.subs &&
                      !collapsed &&
                      activeParentId(activePage) === item.id && (
                        <SubList
                          subs={item.subs}
                          activePage={activePage}
                          onPick={(sub) =>
                            onNavigate(sub.id, { collapse: true })
                          }
                        />
                      )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <AddSportRow collapsed={collapsed} />
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          {!collapsed && (
            <SegmentedControl
              size="compact"
              items={[
                ['light', 'Light'],
                ['dark', 'Dark'],
              ]}
              active={theme}
              onPick={onTheme}
            />
          )}
          <div className="mt-3 flex items-center gap-2.5 px-[9px]">
            {user?.profileImgUrl ? (
              <img
                src={user.profileImgUrl}
                alt=""
                className="h-[30px] w-[30px] flex-none rounded-full object-cover"
              />
            ) : (
              <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-chip text-[12px] font-semibold text-foreground">
                {initials}
              </div>
            )}
            <SidebarLabel collapsed={collapsed} className="flex-1">
              <div className="truncate text-[12.5px] font-semibold text-foreground">
                {user?.firstName ?? 'Runner'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Your profile
              </div>
            </SidebarLabel>
            {!collapsed && (
              <button
                onClick={() => void logout()}
                title="Log out"
                aria-label="Log out"
                className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-[7px] text-muted-foreground hover:bg-chip hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
