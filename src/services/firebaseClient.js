function readFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };
}

function hasRequiredFirebaseConfig(config) {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

function hasRealtimeDatabaseConfig(config) {
  return Boolean(config.databaseURL);
}

let firebaseApp;
let firestoreDb;
let realtimeDb;

export function getCruiserDataSourceMode() {
  return import.meta.env.VITE_CRUISER_DATA_SOURCE ?? "mock";
}

export function isFirebaseConfigured() {
  return hasRequiredFirebaseConfig(readFirebaseConfig());
}

export function isFirebaseModeEnabled() {
  return getCruiserDataSourceMode() === "firebase" && isFirebaseConfigured();
}

export async function getFirebaseServices() {
  if (!isFirebaseModeEnabled()) {
    return null;
  }

  if (!firebaseApp) {
    const config = readFirebaseConfig();
    const [{ initializeApp }, { getFirestore }, { getDatabase }] = await Promise.all([
      import("firebase/app"),
      import("firebase/firestore"),
      import("firebase/database"),
    ]);
    firebaseApp = initializeApp(config);
    firestoreDb = getFirestore(firebaseApp);
    realtimeDb = hasRealtimeDatabaseConfig(config) ? getDatabase(firebaseApp) : null;
  }

  return {
    app: firebaseApp,
    firestore: firestoreDb,
    database: realtimeDb,
  };
}
