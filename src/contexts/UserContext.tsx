import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

interface UserContextType {
  userId: string | null;
  currentGroupId: string | null;
  isInGroup: boolean;
  setCurrentGroupId: (groupId: string | null) => Promise<void>;
  clearGroup: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = '@vivu:currentGroupId';

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: React.ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load currentGroupId from AsyncStorage when app starts
  useEffect(() => {
    const loadGroupId = async () => {
      try {
        const savedGroupId = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedGroupId) {
          setCurrentGroupIdState(savedGroupId);
        }
      } catch (error) {
        console.error('Error loading groupId from storage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGroupId();
  }, []);

  // Set currentGroupId and save to AsyncStorage
  const setCurrentGroupId = useCallback(async (groupId: string | null) => {
    try {
      setCurrentGroupIdState(groupId);
      if (groupId) {
        await AsyncStorage.setItem(STORAGE_KEY, groupId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving groupId to storage:', error);
      throw error;
    }
  }, []);

  // Clear group (leave group)
  const clearGroup = useCallback(async () => {
    await setCurrentGroupId(null);
  }, [setCurrentGroupId]);

  const userId = user?.uid || null;
  const isInGroup = currentGroupId !== null;

  const value: UserContextType = {
    userId,
    currentGroupId,
    isInGroup,
    setCurrentGroupId,
    clearGroup,
  };

  // Don't render children until we've loaded from storage
  if (loading) {
    return null;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// Helper functions for convenience
export const getCurrentUserId = (): string | null => {
  // This is a utility function, but it's better to use useUser hook in components
  return null; // Will be set by context
};

export const getCurrentGroupId = (): string | null => {
  // This is a utility function, but it's better to use useUser hook in components
  return null; // Will be set by context
};

