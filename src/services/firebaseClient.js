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
let firebaseAuth;

async function ensureAnonymousSession(auth) {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const { signInAnonymously } = await import("firebase/auth");
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function getCruiserDataSourceMode() {
  if (import.meta.env.MODE === "test") {
    return "mock";
  }

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
    const [{ initializeApp }, { getFirestore }, { getDatabase }, { getAuth }] = await Promise.all([
      import("firebase/app"),
      import("firebase/firestore"),
      import("firebase/database"),
      import("firebase/auth"),
    ]);
    firebaseApp = initializeApp(config);
    firestoreDb = getFirestore(firebaseApp);
    realtimeDb = hasRealtimeDatabaseConfig(config) ? getDatabase(firebaseApp) : null;
    firebaseAuth = getAuth(firebaseApp);
  }

  try {
    const authUser = await ensureAnonymousSession(firebaseAuth);

    return {
      app: firebaseApp,
      auth: firebaseAuth,
      authUser,
      firestore: firestoreDb,
      database: realtimeDb,
    };
  } catch (error) {
    console.warn("Firebase anonymous auth is not ready. Enable Anonymous sign-in in Firebase Auth.", error);
    return null;
  }
}
