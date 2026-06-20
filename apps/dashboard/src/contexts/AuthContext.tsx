import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../api/client';
import type { AuthResponse, AuthMe } from '../api/types';
import { TOKEN_KEY } from '../utils/constants';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const me = await api.get<AuthMe>('/auth/me');
      setIsAuthenticated(true);
      setUserId(me.userId);
      setPermissions(me.permissions);
    } catch {
      setIsAuthenticated(false);
      setUserId(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(false);
      setUserId(null);
      setPermissions([]);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    api.setTokens(res.accessToken, res.refreshToken);
    setIsAuthenticated(true);
    setUserId(res.user.id);
    setPermissions([]);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/register', { email, name, password });
    api.setTokens(res.accessToken, res.refreshToken);
    setIsAuthenticated(true);
    setUserId(res.user.id);
    setPermissions([]);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — token may be expired
    }
    api.clearTokens();
    setIsAuthenticated(false);
    setUserId(null);
    setPermissions([]);
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {
      // ignore
    }
    api.clearTokens();
    setIsAuthenticated(false);
    setUserId(null);
    setPermissions([]);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, userId, permissions, login, register, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
