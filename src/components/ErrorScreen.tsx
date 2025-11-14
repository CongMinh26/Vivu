import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface ErrorScreenProps {
  error: Error;
  onRetry?: () => void;
}

const getErrorMessage = (error: Error): string => {
  const message = error.message;
  
  if (message.includes('auth/configuration-not-found')) {
    return 'Firebase Authentication chưa được cấu hình.\n\nVui lòng enable Anonymous Authentication trong Firebase Console:\n1. Vào Authentication > Sign-in method\n2. Enable Anonymous\n3. Restart app\n\nXem file FIREBASE_SETUP.md để biết chi tiết.';
  }
  
  if (message.includes('auth/network-request-failed')) {
    return 'Không có kết nối mạng.\n\nVui lòng kiểm tra kết nối internet và thử lại.';
  }
  
  return message;
};

export default function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const errorMessage = getErrorMessage(error);
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Đã xảy ra lỗi</Text>
      <Text style={styles.errorMessage}>{errorMessage}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  errorMessage: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

