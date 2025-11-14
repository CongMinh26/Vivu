import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function GroupsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups Screen</Text>
      <Text style={styles.subtitle}>Quản lý nhóm sẽ được implement ở đây</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

