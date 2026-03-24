import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { setToken, clearToken } from '@/api/apiClient';

const AuthContext = createContext();

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
      const me = await api.auth.me();
      setUser(me);
      setIsAuthenticated(true);
    } catch {
      clearToken();
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
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
    const me = await api.auth.me();
    setUser(me);
    setIsAuthenticated(true);
    return me;
  };

  const logout = () => {
    clearToken();
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
