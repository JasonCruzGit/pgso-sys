import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Bot, BarChart3, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  {
    to: 'ai-assistant',
    label: 'Assistant',
    icon: Bot,
    permission: 'ai.chat,ai.*',
  },
  {
    to: 'kpis',
    label: 'Analytics',
    icon: BarChart3,
    permission: 'ai.view,ai.analytics,ai.*',
  },
  {
    to: 'executive',
    label: 'Executive',
    icon: Briefcase,
    permission: 'ai.view,ai.analytics,ai.*',
  },
];

export default function AnalyticsLayout() {
  const { hasPermission } = useAuth();
  const location = useLocation();

  const visibleItems = menuItems.filter((item) =>
    item.permission.split(',').some((p) => hasPermission(p.trim())),
  );

  return (
    <div className="analytics-page">
      <div className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive || location.pathname.endsWith(item.to)
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

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

export function AnalyticsIndexRedirect() {
  return <Navigate to="ai-assistant" replace />;
}
