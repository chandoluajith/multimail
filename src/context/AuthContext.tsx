import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface AuthUser {
  userId: string;
  email:  string;
  name:   string;
  avatar: string;
}

interface AuthContextType {
  user:          AuthUser | null;
  isAuthLoading: boolean;
  login:         () => void;
  logout:        () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsAuthLoading(false));
  }, []);

  const login = () => {
    window.location.href = api.loginUrl();
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
