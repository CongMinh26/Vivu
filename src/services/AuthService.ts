import { signInAnonymously, User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * Sign in anonymously - Tự động tạo user ID mà không cần đăng nhập
 */
export const signInAnonymouslyUser = async (): Promise<User> => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    throw error;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Listen to auth state changes
 * @param callback Function to call when auth state changes
 * @returns Unsubscribe function
 */
export const onAuthStateChangedListener = (
  callback: (user: User | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Sign out current user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

