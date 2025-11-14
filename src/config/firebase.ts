// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCZFX8uu1PZZ4cgOOcWRITgEsMq8HkR3B8',
  authDomain: 'vivu-d41cc.firebaseapp.com',
  projectId: 'vivu-d41cc',
  storageBucket: 'vivu-d41cc.firebasestorage.app',
  messagingSenderId: '291999781088',
  appId: '1:291999781088:web:dd0ff97f65d74147504085',
  measurementId: 'G-KFCK74XB35',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const firestore = getFirestore(app);

export default app;

