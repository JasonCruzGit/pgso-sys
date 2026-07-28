import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, MapPinned, CalendarDays, Truck, BarChart3, FileBadge, Shield, IdCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'fleet.view,fleet.*' },
  { to: 'map', label: 'Live Map', icon: MapPinned, permission: 'fleet.view,fleet.gps,fleet.*' },
  { to: 'schedules', label: 'Scheduling', icon: CalendarDays, permission: 'fleet.view,fleet.schedule,fleet.*' },
  { to: 'vehicles', label: 'Vehicles', icon: Truck, permission: 'fleet.view,fleet.*' },
  { to: 'registration', label: 'Vehicle Registration', icon: FileBadge, permission: 'fleet.view,fleet.*' },
  { to: 'drivers-license', label: "Driver's License Registration", icon: IdCard, permission: 'fleet.view,fleet.*' },
  { to: 'insurance', label: 'Insurance', icon: Shield, permission: 'fleet.view,fleet.*' },
  { to: 'reports', label: 'Reports', icon: BarChart3, permission: 'fleet.reports,fleet.view,fleet.*,reports.*' },
];

export default function FleetLayout() {
  const { hasPermission } = useAuth();
  const location = useLocation();

  const visibleItems = menuItems.filter((item) =>
    item.permission.split(',').some((p) => hasPermission(p.trim())),
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive || location.pathname.endsWith(`/fleet/${item.to}`) || location.pathname.endsWith(item.to)
                  ? 'bg-palawan-600 text-white shadow-sm shadow-palawan-600/20'
                  : 'bg-white text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

export function FleetIndexRedirect() {
  return <Navigate to="dashboard" replace />;
}
