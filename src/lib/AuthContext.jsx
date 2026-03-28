import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { setToken, clearToken } from '@/api/apiClient';

const AuthContext = createContext();
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const token = localStorage.getItem('cleanix_access_token');
      if (!token) { setIsLoadingAuth(false); setIsAuthenticated(false); return; }

      // Check if remember-me session has expired
      const rememberMe = localStorage.getItem('cleanix_remember_me');
      const loginTime = localStorage.getItem('cleanix_login_time');

      if (rememberMe === 'true' && loginTime) {
        const elapsed = Date.now() - parseInt(loginTime, 10);
        if (elapsed > TWO_DAYS_MS) {
          // Session expired
          clearToken();
          localStorage.removeItem('cleanix_remember_me');
          localStorage.removeItem('cleanix_login_time');
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          return;
        }
      } else if (rememberMe !== 'true') {
        // Not remembered — check if this is a new browser session
        // sessionStorage flag gets cleared when browser/tab closes
        const sessionAlive = sessionStorage.getItem('cleanix_session_alive');
        if (!sessionAlive) {
          // Browser was closed and reopened without remember-me
          clearToken();
          localStorage.removeItem('cleanix_login_time');
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          return;
        }
      }

      const me = await api.auth.me();
      setUser(me);
      setIsAuthenticated(true);
    } catch {
      clearToken();
      localStorage.removeItem('cleanix_remember_me');
      localStorage.removeItem('cleanix_login_time');
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const result = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || 'Login failed');
    setToken(data.access_token);
    localStorage.setItem('cleanix_refresh_token', data.refresh_token);
    localStorage.setItem('cleanix_login_time', String(Date.now()));

    if (rememberMe) {
      localStorage.setItem('cleanix_remember_me', 'true');
    } else {
      localStorage.removeItem('cleanix_remember_me');
      // Mark this browser session as alive
      sessionStorage.setItem('cleanix_session_alive', 'true');
    }

    const me = await api.auth.me();
    setUser(me);
    setIsAuthenticated(true);
    return me;
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem('cleanix_remember_me');
    localStorage.removeItem('cleanix_login_time');
    sessionStorage.removeItem('cleanix_session_alive');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
