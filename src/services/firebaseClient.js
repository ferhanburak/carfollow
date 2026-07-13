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
let firebaseFunctions;
let firebaseStorage;
let firebaseInitializationPromise;
let lastFirebaseServicesError = "";

export function getCruiserDataSourceMode() {
  if (import.meta.env.MODE === "test") {
    return "mock";
  }

  return import.meta.env.VITE_CRUISER_DATA_SOURCE ?? "mock";
}

export function isFirebaseEmulatorEnabled() {
  return import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
}

export function isFirebaseConfigured() {
  return hasRequiredFirebaseConfig(readFirebaseConfig());
}

export function isFirebaseModeEnabled() {
  return getCruiserDataSourceMode() === "firebase" && isFirebaseConfigured();
}

export function getFirebaseModeDiagnostics() {
  const mode = getCruiserDataSourceMode();
  const config = readFirebaseConfig();

  if (mode !== "firebase") {
    return {
      mode: "mock",
      enabled: false,
      connection: "disabled",
      message: "Mock data mode active. Firebase sync is currently disabled.",
    };
  }

  if (!hasRequiredFirebaseConfig(config)) {
    return {
      mode: "firebase",
      enabled: false,
      connection: "misconfigured",
      message: "Firebase mode is selected but required environment variables are missing.",
    };
  }

  const useEmulators = isFirebaseEmulatorEnabled();
  return {
    mode: "firebase",
    enabled: true,
    connection: useEmulators ? "emulator" : hasRealtimeDatabaseConfig(config) ? "configured" : "partial",
    message: useEmulators
      ? "Firebase Local Emulator Suite is enabled."
      : hasRealtimeDatabaseConfig(config)
        ? "Firebase is configured and ready to authenticate."
        : "Firestore is configured, but Realtime Database URL is missing.",
  };
}

export function getLastFirebaseServicesError() {
  return lastFirebaseServicesError;
}

async function initializeFirebaseServices() {
  if (!isFirebaseModeEnabled()) {
    return null;
  }

  if (firebaseApp) {
    return {
      app: firebaseApp,
      auth: firebaseAuth,
      firestore: firestoreDb,
      database: realtimeDb,
      functions: firebaseFunctions,
      storage: firebaseStorage,
    };
  }

  if (!firebaseInitializationPromise) {
    firebaseInitializationPromise = (async () => {
      const config = readFirebaseConfig();
      const [appModule, firestoreModule, databaseModule, authModule, functionsModule, storageModule] =
        await Promise.all([
          import("firebase/app"),
          import("firebase/firestore"),
          import("firebase/database"),
          import("firebase/auth"),
          import("firebase/functions"),
          import("firebase/storage"),
        ]);

      firebaseApp = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);
      firestoreDb = firestoreModule.getFirestore(firebaseApp);
      realtimeDb = hasRealtimeDatabaseConfig(config) ? databaseModule.getDatabase(firebaseApp) : null;
      firebaseAuth = authModule.getAuth(firebaseApp);
      firebaseFunctions = functionsModule.getFunctions(firebaseApp, "us-central1");
      firebaseStorage = config.storageBucket ? storageModule.getStorage(firebaseApp) : null;

      if (isFirebaseEmulatorEnabled() && !globalThis.__CRUISER_FIREBASE_EMULATORS_CONNECTED__) {
        const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST ?? "127.0.0.1";
        authModule.connectAuthEmulator(firebaseAuth, `http://${host}:9099`, { disableWarnings: true });
        firestoreModule.connectFirestoreEmulator(firestoreDb, host, 8080);
        functionsModule.connectFunctionsEmulator(firebaseFunctions, host, 5001);
        if (realtimeDb) {
          databaseModule.connectDatabaseEmulator(realtimeDb, host, 9000);
        }
        if (firebaseStorage) {
          storageModule.connectStorageEmulator(firebaseStorage, host, 9199);
        }
        globalThis.__CRUISER_FIREBASE_EMULATORS_CONNECTED__ = true;
      }

      return {
        app: firebaseApp,
        auth: firebaseAuth,
        firestore: firestoreDb,
        database: realtimeDb,
        functions: firebaseFunctions,
        storage: firebaseStorage,
      };
    })();
  }

  try {
    const services = await firebaseInitializationPromise;
    lastFirebaseServicesError = "";
    return services;
  } catch (error) {
    firebaseInitializationPromise = null;
    lastFirebaseServicesError = error instanceof Error ? error.message : "Firebase could not be initialized.";
    console.warn("Firebase could not be initialized.", error);
    return null;
  }
}

export async function getFirebaseCoreServices() {
  return initializeFirebaseServices();
}

export async function getFirebaseServices() {
  const services = await initializeFirebaseServices();
  if (!services) {
    return null;
  }

  const authUser = services.auth.currentUser;
  if (!authUser) {
    lastFirebaseServicesError = "Firebase authentication is required for this operation.";
    return null;
  }

  lastFirebaseServicesError = "";
  return {
    ...services,
    authUser,
  };
}
