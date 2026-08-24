import React, { createContext, useState } from 'react';
import { AuthUser } from '../types';
import { mockCurrentUser } from '../mocks';

export const AuthContext = createContext<{
  user: AuthUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
}>({
  user: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = (email: string, password: string) => {
    // Mock login — später echte Supabase-Auth
    setUser(mockCurrentUser);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
