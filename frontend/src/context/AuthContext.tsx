import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../api/client';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isEmployee: boolean;
  isDocumentTracker: boolean;
  isInventoryOfficer: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hasPermission = (permission: string): boolean => {
    if (!user?.permissions) return false;
    if (user.permissions.includes('*')) return true;
    if (user.permissions.includes(permission)) return true;
    return user.permissions.some((p) => p.endsWith('.*') && permission.startsWith(p.replace('.*', '')));
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data.user as User;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.clear();
      setUser(null);
    }
  };

  const isEmployee = user?.role?.slug === 'department_user';
  const isDocumentTracker = user?.role?.slug === 'document_tracking'
    || user?.role?.slug === 'document_tracking_admin';
  const isInventoryOfficer = user?.role?.slug === 'gso_inventory_officer';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isEmployee, isDocumentTracker, isInventoryOfficer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
