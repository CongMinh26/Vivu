import * as Location from 'expo-location';
import { Platform, Alert, Linking, AppState, AppStateStatus } from 'react-native';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationData extends LocationCoordinates {
  timestamp: number;
}

export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
}

/**
 * Check current location permission status
 * @returns PermissionStatus enum value
 */
export const checkLocationPermission = async (): Promise<PermissionStatus> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status as PermissionStatus;
  } catch (error) {
    console.error('Error checking location permission:', error);
    return PermissionStatus.DENIED;
  }
};

/**
 * Request location permission
 * @returns PermissionStatus enum value
 */
export const requestLocationPermission = async (): Promise<PermissionStatus> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status as PermissionStatus;
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return PermissionStatus.DENIED;
  }
};

/**
 * Open device settings to allow user to manually enable location permission
 * iOS: Opens Settings app
 * Android: Shows alert with instructions
 */
export const openLocationSettings = async (): Promise<void> => {
  if (Platform.OS === 'ios') {
    try {
      // Try to open app settings directly
      const url = 'app-settings:';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to alert
        Alert.alert(
          'Cài đặt',
          'Vui lòng vào Cài đặt > Vivu > Vị trí và bật quyền truy cập vị trí.',
          [
            {
              text: 'Hủy',
              style: 'cancel',
            },
            {
              text: 'Mở Cài đặt',
              onPress: () => Linking.openURL('app-settings:'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      Alert.alert(
        'Cài đặt',
        'Vui lòng vào Cài đặt > Vivu > Vị trí và bật quyền truy cập vị trí.',
        [
          {
            text: 'Hủy',
            style: 'cancel',
          },
          {
            text: 'Mở Cài đặt',
            onPress: () => Linking.openURL('app-settings:'),
          },
        ]
      );
    }
  } else {
    // Android: Show instructions
    Alert.alert(
      'Cấp quyền vị trí',
      'Vui lòng vào Cài đặt > Ứng dụng > Vivu > Quyền > Vị trí và bật quyền truy cập vị trí.',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Mở Cài đặt',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }
};

/**
 * Request location permission with user-friendly error handling
 * @returns true if permission granted, false otherwise
 */
export const requestLocationPermissionWithHandling = async (): Promise<boolean> => {
  // First check current status
  const currentStatus = await checkLocationPermission();
  
  if (currentStatus === PermissionStatus.GRANTED) {
    return true;
  }

  // Request permission
  const status = await requestLocationPermission();

  if (status === PermissionStatus.GRANTED) {
    return true;
  }

  // Permission denied - show alert
  Alert.alert(
    'Quyền truy cập vị trí',
    'Ứng dụng cần quyền truy cập vị trí để chia sẻ vị trí của bạn với nhóm. Vui lòng cấp quyền trong Cài đặt.',
    [
      {
        text: 'Hủy',
        style: 'cancel',
      },
      {
        text: 'Mở Cài đặt',
        onPress: () => openLocationSettings(),
      },
    ]
  );

  return false;
};

// Location tracking state
let trackingInterval: NodeJS.Timeout | null = null;
let isTracking = false;
let trackingCallback: ((location: LocationData) => void) | null = null;
let appStateSubscription: any = null;

/**
 * Get current location
 * @param options Optional location options
 * @returns LocationData with coordinates and timestamp
 */
export const getCurrentLocation = async (
  options?: Location.LocationOptions
): Promise<LocationData> => {
  try {
    // Check permission first
    const permissionStatus = await checkLocationPermission();
    if (permissionStatus !== PermissionStatus.GRANTED) {
      throw new Error('Location permission not granted');
    }

    // Check if location services are enabled
    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) {
      throw new Error('Location services are disabled. Please enable GPS.');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      ...options,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      altitude: location.coords.altitude ?? null,
      altitudeAccuracy: location.coords.altitudeAccuracy ?? null,
      heading: location.coords.heading ?? null,
      speed: location.coords.speed ?? null,
      timestamp: location.timestamp,
    };
  } catch (error: any) {
    console.error('Error getting current location:', error);
    
    // Provide user-friendly error messages
    if (error.message?.includes('permission')) {
      throw new Error('Không có quyền truy cập vị trí. Vui lòng cấp quyền trong Cài đặt.');
    } else if (error.message?.includes('GPS') || error.message?.includes('services')) {
      throw new Error('GPS không khả dụng. Vui lòng bật GPS và thử lại.');
    } else if (error.message?.includes('timeout')) {
      throw new Error('Không thể lấy vị trí. Vui lòng kiểm tra kết nối GPS và thử lại.');
    }
    
    throw new Error('Không thể lấy vị trí. Vui lòng thử lại.');
  }
};

/**
 * Handle app state changes for location tracking
 */
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active' && isTracking && trackingCallback) {
    // App came to foreground - resume tracking
    console.log('App active - resuming location tracking');
  } else if (nextAppState === 'background' || nextAppState === 'inactive') {
    // App went to background - pause tracking
    console.log('App background - pausing location tracking');
    // Note: We keep the interval running but won't update Firestore in background
    // This can be enhanced later with background location if needed
  }
};

/**
 * Start location tracking
 * @param callback Function to call with each location update
 * @param interval Interval in milliseconds (default: 60000 = 1 minute)
 * @param onlyWhenForeground If true, only track when app is in foreground (default: true)
 */
export const startLocationTracking = async (
  callback: (location: LocationData) => void,
  interval: number = 60000, // 1 minute default
  onlyWhenForeground: boolean = true
): Promise<void> => {
  // Check permission first
  const permissionStatus = await checkLocationPermission();
  if (permissionStatus !== PermissionStatus.GRANTED) {
    throw new Error('Location permission not granted');
  }

  // Stop any existing tracking
  if (isTracking) {
    stopLocationTracking();
  }

  isTracking = true;
  trackingCallback = callback;

  // Subscribe to app state changes if tracking only when foreground
  if (onlyWhenForeground) {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  }

  // Get initial location immediately
  try {
    const initialLocation = await getCurrentLocation();
    callback(initialLocation);
  } catch (error) {
    console.error('Error getting initial location:', error);
  }

  // Set up interval for periodic updates
  trackingInterval = setInterval(async () => {
    if (!isTracking) {
      return;
    }

    // Only track when app is in foreground if onlyWhenForeground is true
    if (onlyWhenForeground && AppState.currentState !== 'active') {
      return;
    }

    try {
      const location = await getCurrentLocation();
      if (trackingCallback) {
        trackingCallback(location);
      }
    } catch (error) {
      console.error('Error getting location in tracking interval:', error);
      // Continue tracking even if one update fails
    }
  }, interval);

  console.log(`Location tracking started with interval: ${interval}ms`);
};

/**
 * Stop location tracking
 */
export const stopLocationTracking = (): void => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  isTracking = false;
  trackingCallback = null;

  console.log('Location tracking stopped');
};

/**
 * Check if location tracking is currently active
 */
export const isLocationTrackingActive = (): boolean => {
  return isTracking;
};

