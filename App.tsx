import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { UserProvider } from './src/contexts/UserContext';
import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/components/LoadingScreen';
import ErrorScreen from './src/components/ErrorScreen';

function AppContent() {
  const { user, loading, error, retry } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={retry} />;
  }

  if (!user) {
    return <LoadingScreen />;
  }

  return (
    <UserProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <AppNavigator />
      </NavigationContainer>
    </UserProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
