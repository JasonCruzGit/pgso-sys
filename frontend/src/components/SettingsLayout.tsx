import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  User, Users, FolderTree, Building2, Shield, Server, ChevronRight, Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { to: 'account', label: 'Account', description: 'Profile, password, notifications', icon: User },
  { to: 'users', label: 'Users', description: 'Manage accounts and roles', icon: Users, permission: 'users.*' },
  { to: 'categories', label: 'Categories', description: 'Inventory classification', icon: FolderTree, permission: 'categories.*,inventory.*' },
  { to: 'departments', label: 'Departments', description: 'Offices and divisions', icon: Building2, permission: 'users.*' },
  { to: 'suppliers', label: 'Suppliers', description: 'Vendors and procurement partners', icon: Store, permission: 'suppliers.*,procurement.*,users.*' },
  { to: 'audit', label: 'Audit Trail', description: 'System activity log', icon: Shield, permission: 'audit_logs.view' },
  { to: 'system', label: 'System Info', description: 'Application configuration', icon: Server, permission: 'users.*' },
];

function SettingsNavItem({ to, label, description, icon: Icon }: typeof menuItems[0]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-3 transition ${
          isActive ? 'bg-palawan-50 text-palawan-800' : 'text-slate-600 hover:bg-slate-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isActive ? 'bg-palawan-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{label}</p>
            <p className="truncate text-xs text-slate-400">{description}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
        </>
      )}
    </NavLink>
  );
}

export default function SettingsLayout() {
  const { hasPermission } = useAuth();

  const visibleItems = menuItems.filter((item) => {
    if (!item.permission) return true;
    return item.permission.split(',').some((p) => hasPermission(p.trim()));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure accounts, organization data, and system preferences
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="lg:w-64 lg:shrink-0">
          <div className="card overflow-hidden p-2">
            {visibleItems.map((item) => (
              <SettingsNavItem key={item.to} {...item} />
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function SettingsIndexRedirect() {
  return <Navigate to="account" replace />;
}
