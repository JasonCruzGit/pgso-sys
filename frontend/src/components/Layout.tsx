import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, QrCode, BarChart3,
  Settings, LogOut, Bell, Search,
  Menu, X, KeyRound, Sparkles, ClipboardCheck, ClipboardList, ClipboardPen,
  MessagesSquare, FolderOpen, Users, MapPin, Building2, ShieldCheck, ScrollText, Archive, Truck, Files,
  PanelLeftClose, PanelLeftOpen, ChevronDown, FolderKanban, Inbox,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import AppLogo from './AppLogo';
import GlobalSearchModal from './GlobalSearchModal';
import NotificationPanel from './NotificationPanel';
import { BRANDING } from '../constants/branding';

const SIDEBAR_COLLAPSED_KEY = 'pgp-gso-sidebar-collapsed';
const RECORDS_SUBMENU_KEY = 'pgp-gso-records-submenu-open';

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  permission: string;
  end?: boolean;
  group: 'primary' | 'more';
  submenu?: 'records';
};

const mainNav: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard.view', end: true, group: 'primary' },
  { to: '/procurement/air', icon: ClipboardList, label: 'AIR', permission: 'procurement.view,procurement.view_own,procurement.create,procurement.*', end: true, group: 'primary' },
  { to: '/item-registry', icon: Archive, label: 'Item Registry', permission: 'procurement.view,procurement.view_own,procurement.*,inventory.view,inventory.*', end: true, group: 'primary' },
  // PO Items hidden from nav — Item Registry covers PO drill-down
  // { to: '/po-items', icon: FileSearch, label: 'PO Items', permission: 'inventory.view,procurement.view,procurement.*,assets.view,property.view,property.*', end: true, group: 'primary' },
  { to: '/fleet', icon: Truck, label: 'Fleet', permission: 'fleet.view,fleet.schedule,fleet.*,fleet.gps,fleet.reports', end: false, group: 'primary' },
  { to: '/documents', icon: Files, label: 'Document Tracking', permission: 'documents.view,documents.*,documents.incoming,documents.outgoing,documents.routing,documents.records', end: false, group: 'primary', submenu: 'records' },
  { to: '/new-inventory-request', icon: ClipboardList, label: 'New Inventory Request', permission: 'requests.create,requests.*,inspection.view,inspection.*,documents.view,documents.*,documents.incoming,documents.outgoing', end: true, group: 'primary', submenu: 'records' },
  { to: '/incoming-inventory-requests', icon: Inbox, label: 'Incoming Items for New Inventory Request', permission: 'requests.create,requests.*,inspection.view,inspection.*,documents.view,documents.*,documents.incoming,documents.outgoing', end: true, group: 'primary', submenu: 'records' },
  { to: '/pre-post-inspection-repair', icon: ClipboardPen, label: 'Pre & Post Inspection of Repair', permission: 'inspection.view,inspection.*', end: true, group: 'primary', submenu: 'records' },
  { to: '/procurement/mr-release', icon: ClipboardCheck, label: 'MR Release', permission: 'requests.release,issuance.*', end: true, group: 'primary' },
  // Hidden for now — use ICS Records / PAR Records; restore when workflow pages are needed
  // { to: '/procurement/ics', icon: FileText, label: 'ICS', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  // { to: '/procurement/par', icon: KeyRound, label: 'PAR', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  { to: '/ics-records', icon: FolderOpen, label: 'ICS Records', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  { to: '/par-records', icon: FolderOpen, label: 'PAR Records', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  { to: '/masterlist', icon: Users, label: 'Masterlist', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  { to: '/individual-property-accountability', icon: ShieldCheck, label: 'Individual Property Accountability', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  { to: '/temporary-certificate', icon: ScrollText, label: 'Temporary Certificate', permission: 'property.view,property.*,requests.release,issuance.*', end: true, group: 'primary' },
  { to: '/tracking', icon: MapPin, label: 'Tracking', permission: 'inventory.view,procurement.view,procurement.*,assets.view,property.view,property.*', end: true, group: 'primary' },
  { to: '/inventory', icon: Package, label: 'Stocks', permission: 'inventory.view', group: 'primary' },
  { to: '/real-properties', icon: Building2, label: 'Real Properties', permission: 'property.view,property.*', end: true, group: 'primary' },
  { to: '/assets', icon: QrCode, label: 'Assets', permission: 'assets.view', group: 'primary' },
  { to: '/communications', icon: MessagesSquare, label: 'Communications', permission: 'messaging.view,messaging.send,messaging.*', group: 'primary' },
  { to: '/documents/reports', icon: BarChart3, label: 'Reports', permission: 'documents.view,documents.*,documents.incoming,documents.outgoing,documents.routing,documents.records', end: true, group: 'primary' },
  { to: '/analytics', icon: Sparkles, label: 'AI Assistant', permission: 'ai.chat,ai.view,ai.analytics,ai.*', group: 'primary' },
  { to: '/property', icon: KeyRound, label: 'Property', permission: 'property.view', group: 'more' },
  // Hidden for now — restore when Inspections module is ready for general use
  // { to: '/inspections', icon: Wrench, label: 'Inspections', permission: 'inspection.view', group: 'more' },
  { to: '/reports', icon: BarChart3, label: 'Reports', permission: 'reports.*', group: 'more' },
];

const employeeHiddenPrefixes = ['/procurement', '/property', '/ics-records', '/par-records', '/masterlist', '/individual-property-accountability', '/temporary-certificate', '/pre-post-inspection-repair', '/new-inventory-request', '/incoming-inventory-requests', '/tracking', '/item-registry', '/po-items', '/documents', '/fleet'];

/** Menus visible only to GSO Inventory Officer (role slug: gso_inventory_officer). */
const inventoryOfficerAllowedPaths = [
  '/item-registry',
  '/procurement/mr-release',
  '/ics-records',
  '/par-records',
  '/masterlist',
  '/temporary-certificate',
  '/communications',
];

function getNavLabel(to: string, label: string, isEmployee: boolean, msgUnread?: number): string {
  if (to === '/communications' && msgUnread && msgUnread > 0) {
    return `${label} (${msgUnread > 99 ? '99+' : msgUnread})`;
  }
  if (isEmployee && to === '/assets') return 'My Assets';
  return label;
}

export default function Layout() {
  const { user, logout, hasPermission, isEmployee, isDocumentTracker, isInventoryOfficer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [recordsOpen, setRecordsOpen] = useState(() => {
    try {
      return localStorage.getItem(RECORDS_SUBMENU_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(RECORDS_SUBMENU_KEY, recordsOpen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [recordsOpen]);

  const { data: notifCount } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data.count),
    refetchInterval: 60000,
  });

  const { data: msgUnread } = useQuery({
    queryKey: ['communications-unread'],
    queryFn: () => api.get('/communications/unread-count').then((r) => r.data.count),
    refetchInterval: 30000,
    enabled: hasPermission('messaging.view') || hasPermission('messaging.send') || hasPermission('messaging.*'),
  });

  const visibleNav = mainNav.filter((item) => {
    if (isInventoryOfficer) {
      return inventoryOfficerAllowedPaths.includes(item.to);
    }
    if (isDocumentTracker && (item.to === '/' || item.label === 'Dashboard')) {
      return false;
    }
    if (isEmployee && employeeHiddenPrefixes.some((prefix) => item.to === prefix || item.to.startsWith(`${prefix}/`))) {
      return false;
    }
    // Always show GSO document forms for document tracking accounts
    if (isDocumentTracker && (
      item.to === '/new-inventory-request'
      || item.to === '/incoming-inventory-requests'
      || item.to === '/pre-post-inspection-repair'
      || item.to === '/documents'
      || item.to === '/documents/reports'
    )) {
      return true;
    }
    return item.permission.split(',').some((p) => hasPermission(p.trim()));
  });

  const recordsItems = isDocumentTracker || isInventoryOfficer
    ? []
    : visibleNav.filter((item) => item.submenu === 'records');
  const topLevelItems = isDocumentTracker || isInventoryOfficer
    ? visibleNav
    : visibleNav.filter((item) => item.submenu !== 'records');
  const recordsActive = recordsItems.some((item) =>
    item.end
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  useEffect(() => {
    if (recordsActive) setRecordsOpen(true);
  }, [recordsActive]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const toggleSidebar = () => setSidebarCollapsed((v) => !v);

  const renderLink = (
    { to, icon: Icon, label, end }: NavItem,
    onNavigate?: () => void,
    collapsed = false,
    nested = false,
  ) => {
    const displayLabel = getNavLabel(to, label, isEmployee, msgUnread);
    return (
      <NavLink
        key={to}
        to={to}
        end={end}
        title={collapsed ? displayLabel : undefined}
        onClick={onNavigate}
        className={({ isActive }) => {
          const active = to === '/documents'
            ? isActive && !location.pathname.startsWith('/documents/reports')
            : isActive;
          return `flex items-center rounded-xl text-sm font-medium transition ${
            collapsed
              ? 'justify-center px-2 py-2.5'
              : nested
                ? 'gap-3 py-2 pl-10 pr-3'
                : 'gap-3 px-3 py-2.5'
          } ${active ? 'bg-palawan-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
        }}
      >
        <Icon size={nested && !collapsed ? 16 : 18} strokeWidth={1.75} className="shrink-0" />
        {!collapsed && <span className="truncate">{displayLabel}</span>}
      </NavLink>
    );
  };

  const renderNavLinks = (onNavigate?: () => void, collapsed = false) => {
    const fleetIndex = topLevelItems.findIndex((item) => item.to === '/fleet');
    const beforeRecords = fleetIndex >= 0 ? topLevelItems.slice(0, fleetIndex + 1) : [];
    const afterRecords = fleetIndex >= 0 ? topLevelItems.slice(fleetIndex + 1) : topLevelItems;

    const renderRecordsGroup = () => {
      if (recordsItems.length === 0) return null;
      if (collapsed) {
        return recordsItems.map((child) => renderLink(child, onNavigate, true));
      }
      return (
        <div key="records-submenu" className="space-y-1">
          <button
            type="button"
            onClick={() => setRecordsOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              recordsActive ? 'bg-palawan-50 text-palawan-800' : 'text-slate-700 hover:bg-slate-100'
            }`}
            aria-expanded={recordsOpen}
          >
            <FolderKanban size={18} strokeWidth={1.75} className="shrink-0" />
            <span className="flex-1 truncate text-left uppercase tracking-wide">Records</span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-slate-400 transition ${recordsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {recordsOpen && (
            <div className="space-y-0.5">
              {recordsItems.map((child) => renderLink(child, onNavigate, false, true))}
            </div>
          )}
        </div>
      );
    };

    return [
      ...beforeRecords.map((item) => renderLink(item, onNavigate, collapsed)),
      renderRecordsGroup(),
      ...afterRecords.map((item) => renderLink(item, onNavigate, collapsed)),
    ];
  };

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-clip app-bg">
      {/* Desktop sidebar */}
      <aside
        className={`safe-top sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200 ease-out lg:flex min-h-0 ${
          sidebarCollapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <div className={`border-b border-slate-100 ${sidebarCollapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
            <NavLink
              to={isDocumentTracker ? '/documents' : isInventoryOfficer ? '/item-registry' : '/'}
              className={`flex min-w-0 items-center ${sidebarCollapsed ? 'justify-center' : 'flex-1 gap-3'}`}
              title={`${BRANDING.officeName} Home`}
            >
              <AppLogo size="sm" className="shrink-0 shadow-md ring-2 ring-white" />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{BRANDING.officeName}</p>
                  <p className="truncate text-[11px] text-slate-500">{BRANDING.lguName}</p>
                </div>
              )}
            </NavLink>
            <button
              type="button"
              onClick={toggleSidebar}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              aria-pressed={sidebarCollapsed}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>
        <nav className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          {renderNavLinks(undefined, sidebarCollapsed)}
        </nav>
        <div className={`safe-bottom border-t border-slate-100 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          <NavLink
            to="/settings"
            title={sidebarCollapsed ? 'System Settings' : undefined}
            className={({ isActive }) =>
              `mb-1 flex items-center rounded-xl text-sm font-medium transition ${
                sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${isActive ? 'bg-palawan-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`
            }
          >
            <Settings size={18} className="shrink-0" />
            {!sidebarCollapsed && 'System Settings'}
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center rounded-xl text-sm font-medium text-red-600 transition hover:bg-red-50 ${
              sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {!sidebarCollapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="safe-top absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <AppLogo size="xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{BRANDING.officeName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {renderNavLinks(() => setMobileOpen(false))}
            </nav>
            <div className="safe-bottom border-t border-slate-100 p-3">
              <NavLink
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-palawan-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Settings size={18} /> System Settings
              </NavLink>
              <button
                type="button"
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-x-clip">
        <header className="mobile-header safe-x">
          <div className="relative flex items-center gap-2 py-2 lg:gap-4 lg:py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                className="shrink-0 rounded-xl bg-white p-2 shadow-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <button
                type="button"
                className="hidden shrink-0 rounded-xl bg-white p-2 text-slate-500 shadow-sm transition hover:text-slate-800 lg:inline-flex"
                onClick={toggleSidebar}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                aria-pressed={sidebarCollapsed}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center lg:hidden">
              <NavLink to="/" className="pointer-events-auto shrink-0" title={`${BRANDING.systemAcronym} Home`}>
                <AppLogo size="xs" className="shadow-md ring-2 ring-white" />
              </NavLink>
              <p className="mt-0.5 max-w-[9rem] text-center text-[10px] font-bold leading-tight text-slate-900 sm:max-w-[11rem] sm:text-[11px]">
                {BRANDING.systemAcronym}
              </p>
            </div>

            <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden rounded-xl bg-white p-2.5 text-slate-500 shadow-sm hover:text-slate-800 lg:inline-flex"
                title="Search (Ctrl+K)"
              >
                <Search size={18} />
              </button>
              <button
                ref={bellRef}
                type="button"
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setNotifOpen((v) => !v);
                }}
                className="relative rounded-xl bg-white p-2 text-slate-500 shadow-sm hover:text-slate-800 sm:p-2.5"
                title="Transaction notifications"
              >
                <Bell size={18} />
                {(notifCount ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {notifCount! > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings/account')}
                className="flex max-w-full items-center gap-2.5 rounded-2xl bg-white p-1 shadow-sm transition hover:shadow-md lg:py-1.5 lg:pl-1.5 lg:pr-3"
                title="Account settings"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-palawan-600 to-palawan-400 text-sm font-bold text-white lg:h-9 lg:w-9">
                  {firstName.charAt(0)}
                </div>
                <div className="hidden min-w-0 text-left lg:block">
                  <p className="max-w-[10rem] truncate text-sm font-semibold leading-tight text-slate-900 xl:max-w-[14rem]">{user?.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{user?.role?.name}</p>
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="app-shell-main flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        anchorRef={bellRef}
      />
    </div>
  );
}
