import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MapScreen from '../screens/MapScreen';
import GroupsScreen from '../screens/GroupsScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Bản đồ',
          tabBarLabel: 'Bản đồ',
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: 'Nhóm',
          tabBarLabel: 'Nhóm',
        }}
      />
    </Tab.Navigator>
  );
}

