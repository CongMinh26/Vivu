import { doc, setDoc, serverTimestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { firestore } from '../config/firebase';
import { LocationData } from './LocationService';
import { subscribeToGroup, Group } from './GroupService';

export interface LocationDocument {
  latitude: number;
  longitude: number;
  timestamp: any; // Firestore Timestamp
  groupId?: string; // Optional, để optimize queries
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

// Throttle state: chỉ update tối đa mỗi 30 giây
let lastUpdateTime = 0;
const THROTTLE_INTERVAL = 30000; // 30 seconds

/**
 * Update location to Firestore
 * @param userId - User ID
 * @param location - Location data
 * @param groupId - Optional group ID for optimization
 * @returns Promise<void>
 */
export const updateLocationToFirestore = async (
  userId: string,
  location: LocationData,
  groupId?: string
): Promise<void> => {
  try {
    // Throttle: chỉ update nếu đã qua 30 giây kể từ lần update cuối
    const now = Date.now();
    if (now - lastUpdateTime < THROTTLE_INTERVAL) {
      console.log('Location update throttled - skipping');
      return;
    }

    const locationRef = doc(firestore, 'locations', userId);

    const locationDoc: LocationDocument = {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: serverTimestamp(),
      accuracy: location.accuracy,
      altitude: location.altitude,
      heading: location.heading,
      speed: location.speed,
    };

    // Add groupId if provided (for query optimization)
    if (groupId) {
      locationDoc.groupId = groupId;
    }

    await setDoc(locationRef, locationDoc, { merge: true });

    lastUpdateTime = now;
    console.log('Location updated to Firestore:', {
      userId,
      latitude: location.latitude,
      longitude: location.longitude,
      groupId,
    });
  } catch (error: any) {
    console.error('Error updating location to Firestore:', error);
    
    // Don't throw error to prevent breaking location tracking
    // Just log it so tracking can continue
    if (error.code === 'permission-denied') {
      console.error('Permission denied - check Firestore Security Rules');
    } else if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      console.error('Network error - location will be retried on next update');
    }
  }
};

/**
 * Reset throttle (useful for testing or manual updates)
 */
export const resetLocationThrottle = (): void => {
  lastUpdateTime = 0;
};

export interface MemberLocation {
  userId: string;
  location: LocationDocument | null;
}

/**
 * Subscribe to real-time location updates for all group members
 * @param groupId - Group ID
 * @param currentUserId - Current user ID (to exclude from members list)
 * @param callback - Function called when any member's location updates
 * @returns Unsubscribe function
 */
export const subscribeToGroupMembersLocations = (
  groupId: string,
  currentUserId: string,
  callback: (memberLocations: Map<string, LocationDocument | null>) => void
): Unsubscribe => {
  let memberUnsubscribes: Map<string, Unsubscribe> = new Map();
  let memberLocations: Map<string, LocationDocument | null> = new Map();
  let groupUnsubscribe: Unsubscribe | null = null;

  // Helper function to subscribe to a member's location
  const subscribeToMemberLocation = (memberId: string) => {
    // Skip if already subscribed
    if (memberUnsubscribes.has(memberId)) {
      return;
    }

    const locationRef = doc(firestore, 'locations', memberId);

    const unsubscribe = onSnapshot(
      locationRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const locationData = docSnap.data() as LocationDocument;
          memberLocations.set(memberId, locationData);
        } else {
          // Member doesn't have location yet
          memberLocations.set(memberId, null);
        }

        // Call callback with updated locations
        callback(new Map(memberLocations));
      },
      (error) => {
        console.error(`Error subscribing to location for member ${memberId}:`, error);
        // Set location to null on error
        memberLocations.set(memberId, null);
        callback(new Map(memberLocations));
      }
    );

    memberUnsubscribes.set(memberId, unsubscribe);
  };

  // Helper function to unsubscribe from a member's location
  const unsubscribeFromMemberLocation = (memberId: string) => {
    const unsubscribe = memberUnsubscribes.get(memberId);
    if (unsubscribe) {
      unsubscribe();
      memberUnsubscribes.delete(memberId);
      memberLocations.delete(memberId);
      callback(new Map(memberLocations));
    }
  };

  // Subscribe to group changes to handle member additions/removals
  groupUnsubscribe = subscribeToGroup(groupId, (group: Group | null) => {
    if (!group) {
      console.error('Group not found:', groupId);
      // Cleanup all subscriptions
      memberUnsubscribes.forEach((unsubscribe) => unsubscribe());
      memberUnsubscribes.clear();
      memberLocations.clear();
      callback(new Map());
      return;
    }

    // Filter out current user
    const otherMembers = group.members.filter((memberId: string) => memberId !== currentUserId);
    const currentMemberIds = new Set(Array.from(memberUnsubscribes.keys()));

    // Subscribe to new members
    otherMembers.forEach((memberId: string) => {
      if (!currentMemberIds.has(memberId)) {
        subscribeToMemberLocation(memberId);
      }
    });

    // Unsubscribe from removed members
    currentMemberIds.forEach((memberId: string) => {
      if (!otherMembers.includes(memberId)) {
        unsubscribeFromMemberLocation(memberId);
      }
    });

    // If no other members, call callback with empty map
    if (otherMembers.length === 0) {
      callback(new Map());
    }
  });

  // Return cleanup function
  return () => {
    if (groupUnsubscribe) {
      groupUnsubscribe();
    }
    memberUnsubscribes.forEach((unsubscribe) => unsubscribe());
    memberUnsubscribes.clear();
    memberLocations.clear();
  };
};

