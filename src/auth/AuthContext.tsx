import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { apiClient } from '../api/client';
import type { AuthUser, UserRole } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedRoleContext: UserRole;
  setSelectedRoleContext: (role: UserRole) => void;
  login: (email: string, password: string, expectedRole?: UserRole) => Promise<AuthUser>;
  register: (data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    companyId?: string | null;
  }) => Promise<{ message: string; user: AuthUser }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'srats_access_token';
const REFRESH_KEY = 'srats_refresh_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return sessionStorage.getItem(TOKEN_KEY);
  });
  const [refreshToken, setRefreshToken] = useState<string | null>(() => {
    return sessionStorage.getItem(REFRESH_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoleContext, setSelectedRoleContext] = useState<UserRole>('APPLICANT');

  // Wire token provider on apiClient
  useEffect(() => {
    apiClient.setTokenProvider(() => accessToken);
  }, [accessToken]);

  // Session restoration on mount
  useEffect(() => {
    async function restoreSession() {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const { user: profile } = await authService.getMe();
        setUser(profile);
        setSelectedRoleContext(profile.role);
      } catch {
        // If access token invalid/expired, attempt refresh if refresh token available
        if (refreshToken) {
          try {
            const refreshed = await authService.refresh(refreshToken);
            setAccessToken(refreshed.accessToken);
            setRefreshToken(refreshed.refreshToken);
            sessionStorage.setItem(TOKEN_KEY, refreshed.accessToken);
            sessionStorage.setItem(REFRESH_KEY, refreshed.refreshToken);
            setUser(refreshed.user);
            setSelectedRoleContext(refreshed.user.role);
          } catch {
            // Failed refresh, clear session
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(REFRESH_KEY);
            setAccessToken(null);
            setRefreshToken(null);
            setUser(null);
          }
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // Listen to session expired event from apiClient
  useEffect(() => {
    const handleExpired = () => {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    };
    window.addEventListener('srats:session-expired', handleExpired);
    return () => window.removeEventListener('srats:session-expired', handleExpired);
  }, []);

  const login = async (email: string, password: string, expectedRole?: UserRole): Promise<AuthUser> => {
    const session = await authService.login({
      email,
      password,
      expectedRole: expectedRole || selectedRoleContext,
    });

    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    sessionStorage.setItem(TOKEN_KEY, session.accessToken);
    sessionStorage.setItem(REFRESH_KEY, session.refreshToken);
    setUser(session.user);
    setSelectedRoleContext(session.user.role);

    return session.user;
  };

  const register = async (data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    companyId?: string | null;
  }) => {
    return authService.register(data);
  };

  const logout = async () => {
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Ignore logout request errors
    } finally {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        accessToken,
        isAuthenticated: Boolean(user && accessToken),
        isLoading,
        selectedRoleContext,
        setSelectedRoleContext,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
