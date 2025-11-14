import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../config/firebase';

export interface Group {
  id: string;
  inviteCode: string;
  members: string[];
  createdBy: string;
  createdAt: any;
  // Trip information
  tripName?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

/**
 * Generate random invite code (6 characters: alphanumeric)
 */
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Check if invite code already exists in Firestore
 */
const checkInviteCodeExists = async (inviteCode: string): Promise<boolean> => {
  try {
    const q = query(collection(firestore, 'groups'), where('inviteCode', '==', inviteCode));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking invite code:', error);
    throw error;
  }
};

/**
 * Generate unique invite code that doesn't exist in Firestore
 */
const generateUniqueInviteCode = async (): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateInviteCode();
    const exists = await checkInviteCodeExists(code);
    if (!exists) {
      return code;
    }
    attempts++;
  }

  throw new Error('Không thể tạo mã mời duy nhất. Vui lòng thử lại.');
};

export interface CreateGroupData {
  tripName: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

/**
 * Create a new group
 * @param userId - ID of the user creating the group
 * @param tripData - Trip information (tripName, destination, etc.)
 * @returns Group object with id and inviteCode
 */
export const createGroup = async (userId: string, tripData: CreateGroupData): Promise<Group> => {
  try {
    // Validate required fields
    if (!tripData.tripName || !tripData.tripName.trim()) {
      throw new Error('Vui lòng nhập tên chuyến đi');
    }
    if (!tripData.destination || !tripData.destination.trim()) {
      throw new Error('Vui lòng nhập địa điểm đến');
    }

    // Check if user is already in a group
    const userGroupsQuery = query(
      collection(firestore, 'groups'),
      where('members', 'array-contains', userId)
    );
    const userGroupsSnapshot = await getDocs(userGroupsQuery);
    if (!userGroupsSnapshot.empty) {
      throw new Error('Bạn đã ở trong một nhóm. Vui lòng rời nhóm trước khi tạo nhóm mới.');
    }

    // Generate unique invite code
    const inviteCode = await generateUniqueInviteCode();

    // Create group document
    const groupData = {
      inviteCode,
      members: [userId],
      createdBy: userId,
      createdAt: serverTimestamp(),
      tripName: tripData.tripName.trim(),
      destination: tripData.destination.trim(),
      startDate: tripData.startDate || null,
      endDate: tripData.endDate || null,
      description: tripData.description?.trim() || null,
    };

    const docRef = await addDoc(collection(firestore, 'groups'), groupData);

    return {
      id: docRef.id,
      inviteCode,
      members: [userId],
      createdBy: userId,
      createdAt: groupData.createdAt,
      tripName: groupData.tripName,
      destination: groupData.destination,
      startDate: groupData.startDate || undefined,
      endDate: groupData.endDate || undefined,
      description: groupData.description || undefined,
    };
  } catch (error: any) {
    console.error('Error creating group:', error);
    throw error;
  }
};

/**
 * Get group by ID
 */
export const getGroupById = async (groupId: string): Promise<Group | null> => {
  try {
    const docRef = doc(firestore, 'groups', groupId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Group;
    }

    return null;
  } catch (error) {
    console.error('Error getting group:', error);
    throw error;
  }
};

/**
 * Get group by invite code
 */
export const getGroupByInviteCode = async (inviteCode: string): Promise<Group | null> => {
  try {
    const q = query(collection(firestore, 'groups'), where('inviteCode', '==', inviteCode));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as Group;
    }

    return null;
  } catch (error) {
    console.error('Error getting group by invite code:', error);
    throw error;
  }
};

/**
 * Join group by invite code
 */
export const joinGroupByInviteCode = async (
  inviteCode: string,
  userId: string
): Promise<Group> => {
  try {
    // Validate invite code format
    if (!/^[A-Z0-9]{6}$/.test(inviteCode)) {
      throw new Error('Mã mời không hợp lệ. Mã mời phải có 6 ký tự chữ và số.');
    }

    // Find group by invite code
    const group = await getGroupByInviteCode(inviteCode);

    if (!group) {
      throw new Error('Mã mời không tồn tại. Vui lòng kiểm tra lại.');
    }

    // Check if user is already in this group
    if (group.members.includes(userId)) {
      throw new Error('Bạn đã ở trong nhóm này rồi.');
    }

    // Check if user is already in another group
    const userGroupsQuery = query(
      collection(firestore, 'groups'),
      where('members', 'array-contains', userId)
    );
    const userGroupsSnapshot = await getDocs(userGroupsQuery);
    if (!userGroupsSnapshot.empty) {
      throw new Error('Bạn đã ở trong một nhóm khác. Vui lòng rời nhóm trước khi tham gia nhóm mới.');
    }

    // Add user to group
    const groupRef = doc(firestore, 'groups', group.id);
    await updateDoc(groupRef, {
      members: [...group.members, userId],
    });

    // Return updated group
    return {
      ...group,
      members: [...group.members, userId],
    };
  } catch (error: any) {
    console.error('Error joining group:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates for a group
 * @param groupId - ID of the group to subscribe to
 * @param callback - Function to call when group data changes
 * @returns Unsubscribe function
 */
export const subscribeToGroup = (
  groupId: string,
  callback: (group: Group | null) => void
): Unsubscribe => {
  const groupRef = doc(firestore, 'groups', groupId);

  return onSnapshot(
    groupRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const group = {
          id: docSnap.id,
          ...docSnap.data(),
        } as Group;
        callback(group);
      } else {
        // Group was deleted
        callback(null);
      }
    },
    (error) => {
      console.error('Error subscribing to group:', error);
      callback(null);
    }
  );
};

/**
 * Leave group
 */
export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
  try {
    const groupRef = doc(firestore, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      throw new Error('Nhóm không tồn tại.');
    }

    const group = groupSnap.data() as Group;
    
    // Check if user is in the group
    if (!group.members.includes(userId)) {
      throw new Error('Bạn không ở trong nhóm này.');
    }

    const updatedMembers = group.members.filter((memberId) => memberId !== userId);

    if (updatedMembers.length === 0) {
      // If no members left, set members to empty array
      await updateDoc(groupRef, {
        members: [],
      });
    } else {
      await updateDoc(groupRef, {
        members: updatedMembers,
      });
    }
  } catch (error: any) {
    console.error('Error leaving group:', error);
    throw error;
  }
};

