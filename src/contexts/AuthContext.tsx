import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { signInAnonymouslyUser, onAuthStateChangedListener } from '../services/AuthService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  const authenticate = React.useCallback(() => {
    setLoading(true);
    setError(null);
    
    // Listen to auth state changes
    const unsubscribe = onAuthStateChangedListener((currentUser) => {
      if (currentUser) {
        // User is signed in
        setUser(currentUser);
        setLoading(false);
        setError(null);
      } else {
        // User is not signed in, sign in anonymously
        signInAnonymouslyUser()
          .then((newUser) => {
            setUser(newUser);
            setLoading(false);
            setError(null);
          })
          .catch((err) => {
            console.error('Failed to sign in anonymously:', err);
            setError(err as Error);
            setLoading(false);
          });
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = authenticate();
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [authenticate, retryKey]);

  const handleRetry = React.useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    retry: handleRetry,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

