import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authAPI, ApiError, SESSION_EXPIRED_EVENT, tokenStorage } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  notice: string; // e.g. "Your session expired", shown on the login screen
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  // On page load, ask the server whether the saved token is still valid.
  useEffect(() => {
    if (!tokenStorage.get()) {
      setLoading(false);
      return;
    }
    authAPI
      .me()
      .then(({ user }) => setUser(user))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          tokenStorage.clear();
          setNotice('Your session expired. Please sign in again.');
        } else {
          setNotice(error instanceof Error ? error.message : 'Could not restore your session.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Any API call that gets a 401 fires this event.
  useEffect(() => {
    const onExpired = () => {
      logout();
      setNotice('Your session expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    tokenStorage.set(response.token);
    setNotice('');
    setUser(response.user);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const response = await authAPI.register(email, password, firstName, lastName);
    tokenStorage.set(response.token);
    setNotice('');
    setUser(response.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, notice, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}