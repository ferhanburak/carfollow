import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error('Mobil Firebase ortam değişkenleri eksik.');
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function resolveAuth(): Auth {
  try {
    const getReactNativePersistence = (
      FirebaseAuth as typeof FirebaseAuth & {
        getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
      }
    ).getReactNativePersistence;
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = resolveAuth();
export const firestoreDb = getFirestore(
  firebaseApp,
  process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || 'carfollow-eu',
);
export const realtimeDb = getDatabase(
  firebaseApp,
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
);
export const firebaseFunctions = getFunctions(
  firebaseApp,
  process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'europe-west1',
);
export const firebaseStorage = getStorage(
  firebaseApp,
  `gs://${firebaseConfig.storageBucket}`,
);
