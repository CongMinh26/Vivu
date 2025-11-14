import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, Circle, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  requestLocationPermissionWithHandling,
  checkLocationPermission,
  PermissionStatus,
  getCurrentLocation,
  startLocationTracking,
  stopLocationTracking,
  LocationData,
} from '../services/LocationService';
import {
  updateLocationToFirestore,
  subscribeToGroupMembersLocations,
  LocationDocument,
} from '../services/LocationFirestoreService';
import { useUser } from '../contexts/UserContext';

export default function MapScreen() {
  const { isInGroup, currentGroupId, userId } = useUser();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [memberLocations, setMemberLocations] = useState<Map<string, LocationDocument | null>>(new Map());
  const trackingStartedRef = useRef(false);
  const mapRef = useRef<MapView>(null);
  const membersSubscriptionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const requestPermission = async () => {
      setIsRequesting(true);
      try {
        // Check current permission status first
        const currentStatus = await checkLocationPermission();
        setPermissionStatus(currentStatus);

        // If not granted, request permission
        if (currentStatus !== PermissionStatus.GRANTED) {
          const granted = await requestLocationPermissionWithHandling();
          if (granted) {
            setPermissionStatus(PermissionStatus.GRANTED);
          } else {
            setPermissionStatus(PermissionStatus.DENIED);
          }
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        setPermissionStatus(PermissionStatus.DENIED);
      } finally {
        setIsRequesting(false);
      }
    };

    requestPermission();
  }, []);

  // Start location tracking when permission is granted and user is in group
  useEffect(() => {
    if (permissionStatus === PermissionStatus.GRANTED && isInGroup && !trackingStartedRef.current) {
      const startTracking = async () => {
        try {
          // Get initial location
          const location = await getCurrentLocation();
          setCurrentLocation(location);
          setLocationError(null);
          
          // Set initial map region
          const region: Region = {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01, // ~1km
            longitudeDelta: 0.01, // ~1km
          };
          setMapRegion(region);
          
          // Animate to user location
          if (mapRef.current) {
            mapRef.current.animateToRegion(region, 1000);
          }
          
          // Update initial location to Firestore if user is in group
          if (isInGroup && userId && currentGroupId) {
            try {
              await updateLocationToFirestore(userId, location, currentGroupId);
            } catch (error) {
              console.error('Error updating initial location to Firestore:', error);
            }
          }

          // Start periodic tracking
          await startLocationTracking(
            async (location) => {
              setCurrentLocation(location);
              setLocationError(null);
              console.log('Location updated:', location);
              
              // Update map region smoothly (only if user is viewing map)
              if (mapRef.current && mapRegion) {
                const newRegion: Region = {
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: mapRegion.latitudeDelta,
                  longitudeDelta: mapRegion.longitudeDelta,
                };
                // Only animate if location changed significantly (more than 50m)
                const latDiff = Math.abs(location.latitude - mapRegion.latitude);
                const lngDiff = Math.abs(location.longitude - mapRegion.longitude);
                if (latDiff > 0.0005 || lngDiff > 0.0005) {
                  mapRef.current.animateToRegion(newRegion, 500);
                  setMapRegion(newRegion);
                }
              }
              
              // Update to Firestore if user is in group
              if (isInGroup && userId && currentGroupId) {
                try {
                  await updateLocationToFirestore(userId, location, currentGroupId);
                } catch (error) {
                  console.error('Error updating location to Firestore:', error);
                  // Don't show error to user, just log it
                }
              }
            },
            60000, // 1 minute interval
            true // only when foreground
          );

          trackingStartedRef.current = true;
        } catch (error: any) {
          console.error('Error starting location tracking:', error);
          setLocationError(error.message || 'Không thể bắt đầu theo dõi vị trí.');
        }
      };

      startTracking();
    }

    // Cleanup: stop tracking when component unmounts or user leaves group
    return () => {
      if (!isInGroup || permissionStatus !== PermissionStatus.GRANTED) {
        stopLocationTracking();
        trackingStartedRef.current = false;
      }
    };
  }, [permissionStatus, isInGroup, userId, currentGroupId]);

  // Subscribe to group members' locations
  useEffect(() => {
    if (permissionStatus === PermissionStatus.GRANTED && isInGroup && currentGroupId && userId) {
      // Cleanup previous subscription
      if (membersSubscriptionRef.current) {
        membersSubscriptionRef.current();
        membersSubscriptionRef.current = null;
      }

      // Subscribe to members' locations
      const unsubscribe = subscribeToGroupMembersLocations(
        currentGroupId,
        userId,
        (locations) => {
          const previousSize = memberLocations.size;
          setMemberLocations(locations);
          console.log('Member locations updated:', Array.from(locations.keys()));
          
          // Auto-fit map when new member joins or first member location appears
          if (locations.size > previousSize && mapRef.current) {
            // Use locations from callback directly
            setTimeout(() => {
              fitAllMarkers(locations);
            }, 300);
          }
        }
      );

      membersSubscriptionRef.current = unsubscribe;
    } else {
      // Clear member locations when not in group
      setMemberLocations(new Map());
    }

    // Cleanup subscription
    return () => {
      if (membersSubscriptionRef.current) {
        membersSubscriptionRef.current();
        membersSubscriptionRef.current = null;
      }
    };
  }, [permissionStatus, isInGroup, currentGroupId, userId]);

  // Function to center map to user's current location
  const centerToUserLocation = useCallback(() => {
    if (mapRef.current && currentLocation) {
      const region: Region = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(region, 1000);
    }
  }, [currentLocation]);

  // Function to fit all markers (user + members) on map
  const fitAllMarkers = useCallback((customMemberLocations?: Map<string, LocationDocument | null>) => {
    if (!mapRef.current) return;

    const coordinates: Array<{ latitude: number; longitude: number }> = [];
    const locationsToUse = customMemberLocations || memberLocations;

    // Add user's location
    if (currentLocation) {
      coordinates.push({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }

    // Add members' locations
    locationsToUse.forEach((location) => {
      if (location) {
        coordinates.push({
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    });

    if (coordinates.length === 0) {
      return;
    }

    if (coordinates.length === 1) {
      // If only one coordinate, just center on it
      const region: Region = {
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(region, 1000);
      return;
    }

    // Fit all coordinates with padding
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: {
        top: 100,
        right: 50,
        bottom: 100,
        left: 50,
      },
      animated: true,
    });
  }, [currentLocation, memberLocations]);

  if (isRequesting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang yêu cầu quyền truy cập vị trí...</Text>
      </View>
    );
  }

  if (permissionStatus === PermissionStatus.DENIED) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quyền truy cập vị trí bị từ chối</Text>
        <Text style={styles.subtitle}>
          Vui lòng cấp quyền truy cập vị trí trong Cài đặt để sử dụng tính năng này.
        </Text>
      </View>
    );
  }

  // Default region (Ho Chi Minh City) if no location yet
  const defaultRegion: Region = {
    latitude: 10.8231,
    longitude: 106.6297,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  if (isRequesting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang yêu cầu quyền truy cập vị trí...</Text>
      </View>
    );
  }

  // Check if permission was denied (after checking it's not null and not granted)
  const isDenied = permissionStatus !== null && 
                   permissionStatus !== PermissionStatus.GRANTED && 
                   permissionStatus !== PermissionStatus.UNDETERMINED;
  
  if (isDenied) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quyền truy cập vị trí bị từ chối</Text>
        <Text style={styles.subtitle}>
          Vui lòng cấp quyền truy cập vị trí trong Cài đặt để sử dụng tính năng này.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {permissionStatus === PermissionStatus.GRANTED && mapRegion ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={mapRegion}
          showsUserLocation={false} // We'll use custom marker
          showsMyLocationButton={true}
          followsUserLocation={false}
          onRegionChangeComplete={setMapRegion}
        >
          {/* User's current location marker */}
          {currentLocation && (
            <>
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="Vị trí của bạn"
                description={`Độ chính xác: ${currentLocation.accuracy ? currentLocation.accuracy.toFixed(0) : 'N/A'}m`}
                pinColor="#007AFF" // Blue color for user
              />
              {/* Accuracy circle */}
              {currentLocation.accuracy && (
                <Circle
                  center={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  }}
                  radius={currentLocation.accuracy}
                  strokeColor="#007AFF"
                  fillColor="rgba(0, 122, 255, 0.1)"
                  strokeWidth={2}
                />
              )}
            </>
          )}
          
          {/* Other members' markers */}
          {Array.from(memberLocations.entries()).map(([memberId, location]) => {
            if (!location) return null; // Skip if member doesn't have location yet

            // Generate color based on memberId hash for consistency
            const colors = ['#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];
            const colorIndex = memberId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
            const markerColor = colors[colorIndex];

            return (
              <Marker
                key={memberId}
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title={`Thành viên ${memberId.substring(0, 8)}...`}
                description={
                  location.timestamp
                    ? `Cập nhật: ${new Date(location.timestamp.toDate?.() || location.timestamp).toLocaleTimeString('vi-VN')}`
                    : 'Đang cập nhật...'
                }
                pinColor={markerColor}
              />
            );
          })}
        </MapView>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={defaultRegion}
          showsUserLocation={false}
          showsMyLocationButton={true}
        />
      )}
      
      {/* Map Control Buttons */}
      {permissionStatus === PermissionStatus.GRANTED && (
        <View style={styles.mapControls}>
          {currentLocation && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={centerToUserLocation}
            >
              <Text style={styles.controlButtonText}>📍</Text>
            </TouchableOpacity>
          )}
          {(currentLocation || memberLocations.size > 0) && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => fitAllMarkers()}
            >
              <Text style={styles.controlButtonText}>🔍</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Info overlay */}
      {permissionStatus === PermissionStatus.GRANTED && (
        <View style={styles.infoOverlay}>
          {isInGroup ? (
            <>
              {currentLocation ? (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationTitle}>Vị trí của bạn</Text>
                  <Text style={styles.locationText}>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                  {currentLocation.accuracy && (
                    <Text style={styles.accuracyText}>
                      Độ chính xác: {currentLocation.accuracy.toFixed(0)}m
                    </Text>
                  )}
                  <Text style={styles.trackingStatus}>
                    ✓ Đang theo dõi (mỗi 1 phút)
                  </Text>
                </View>
              ) : locationError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{locationError}</Text>
                </View>
              ) : (
                <View style={styles.locationInfo}>
                  <Text style={styles.locationTitle}>Đang lấy vị trí...</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>Chưa tham gia nhóm</Text>
              <Text style={styles.locationText}>
                Vui lòng tham gia nhóm để bắt đầu theo dõi vị trí.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  infoOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  locationInfo: {
    // Removed marginTop since it's in overlay
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  accuracyText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  trackingStatus: {
    marginTop: 8,
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  errorContainer: {
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    textAlign: 'center',
  },
  mapControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    flexDirection: 'column',
  },
  controlButton: {
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButtonText: {
    fontSize: 24,
  },
});

