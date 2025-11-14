/**
 * Helper functions for user management
 * Note: These are utility functions. In React components, prefer using useUser() hook instead.
 */

import { useUser } from '../contexts/UserContext';

/**
 * Hook to get current user ID
 * @returns Current user ID or null
 */
export const useCurrentUserId = (): string | null => {
  const { userId } = useUser();
  return userId;
};

/**
 * Hook to get current group ID
 * @returns Current group ID or null
 */
export const useCurrentGroupId = (): string | null => {
  const { currentGroupId } = useUser();
  return currentGroupId;
};

/**
 * Hook to check if user is in a group
 * @returns true if user is in a group, false otherwise
 */
export const useIsInGroup = (): boolean => {
  const { isInGroup } = useUser();
  return isInGroup;
};

