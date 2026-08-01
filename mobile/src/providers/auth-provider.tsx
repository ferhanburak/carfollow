import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  firebaseAuth,
  firebaseFunctions,
  firestoreDb,
} from '@/lib/firebase';
import { privateProfilePath } from '@/lib/firebase-paths';

export type CruiserProfile = {
  id?: string;
  firebaseUid?: string;
  primaryVehicleId?: string;
  fullName: string;
  plate: string;
  model: string;
  vehicleType: 'car' | 'motorcycle';
  tuningStage: string;
  horsepower: number;
  odometer: number;
  driverScore: number;
  monthlyKm: number;
  avatar?: string;
  region?: string;
  garage?: string;
  clan?: string;
  clanId?: string;
  clanRole?: string;
  totalKm?: number;
  totalDriveSeconds?: number;
  maxSpeedKmh?: number;
  harmonyVotes?: number;
  alertVotes?: number;
  communityEventLikesReceived?: number;
  communityPhotoLikesReceived?: number;
  communityHelpfulVotesReceived?: number;
  communityKudos?: number;
  achievementBadges?: string[];
  privacy?: {
    plateSearchEnabled?: boolean;
    showPlateOnLiveMap?: boolean;
    showModelInSearch?: boolean;
    showRegionInSearch?: boolean;
    locationPrecision?: 'hidden' | 'approximate' | 'exact';
    safeZoneEnabled?: boolean;
  };
};

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  plate: string;
  model: string;
  odometer: number;
  vehicleType: 'car' | 'motorcycle';
  termsAccepted: boolean;
};

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  profile: CruiserProfile | null;
  error: string;
  clearError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const carParts = [
  { key: 'oil', name: 'Motor Yağı', shortLabel: 'Yağ', zone: 'engine' },
  { key: 'oilFilter', name: 'Yağ Filtresi', shortLabel: 'Yağ Filtresi', zone: 'engine' },
  { key: 'airFilter', name: 'Hava Filtresi', shortLabel: 'Hava', zone: 'engine' },
  { key: 'cabinFilter', name: 'Polen Filtresi', shortLabel: 'Polen', zone: 'cockpit' },
  { key: 'spark', name: 'Bujiler', shortLabel: 'Buji', zone: 'engine' },
  { key: 'coolant', name: 'Soğutma Sıvısı', shortLabel: 'Antifriz', zone: 'engine' },
  { key: 'battery', name: 'Akü', shortLabel: 'Akü', zone: 'engine' },
  { key: 'transmissionFluid', name: 'Şanzıman Yağı', shortLabel: 'Şanzıman', zone: 'drivetrain' },
  { key: 'frontBrakes', name: 'Ön Fren Balataları', shortLabel: 'Ön Fren', zone: 'frontAxle' },
  { key: 'rearBrakes', name: 'Arka Fren Balataları', shortLabel: 'Arka Fren', zone: 'rearAxle' },
  { key: 'frontTires', name: 'Ön Lastikler', shortLabel: 'Ön Lastik', zone: 'frontAxle' },
  { key: 'rearTires', name: 'Arka Lastikler', shortLabel: 'Arka Lastik', zone: 'rearAxle' },
];

const motorcycleParts = [
  ...carParts.filter((part) => !['cabinFilter', 'transmissionFluid'].includes(part.key)),
  { key: 'chain', name: 'Tahrik Zinciri', shortLabel: 'Zincir', zone: 'drivetrain' },
  { key: 'clutch', name: 'Debriyaj Seti', shortLabel: 'Debriyaj', zone: 'drivetrain' },
];

function getErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/invalid-email': 'Geçerli bir e-posta adresi girin.',
    'auth/network-request-failed': 'İnternet bağlantısı kurulamadı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.',
    'auth/weak-password': 'Şifre en az 8 karakter olmalıdır.',
    'functions/already-exists': 'Bu plaka başka bir hesapta kayıtlı.',
  };
  if (messages[code]) return messages[code];
  return error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
}

async function loadProfile(userId: string): Promise<CruiserProfile> {
  const snapshot = await getDoc(doc(firestoreDb, privateProfilePath(userId)));
  if (!snapshot.exists()) throw new Error('CRUISER profili bulunamadı.');
  return snapshot.data() as CruiserProfile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CruiserProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setStatus('anonymous');
      return;
    }
    try {
      setProfile(await loadProfile(nextUser.uid));
      setError('');
      setStatus('authenticated');
    } catch (profileError) {
      setError(getErrorMessage(profileError));
      setStatus('anonymous');
    }
  }), []);

  const refreshProfile = async () => {
    if (!firebaseAuth.currentUser) return;
    setProfile(await loadProfile(firebaseAuth.currentUser.uid));
  };

  const login = async (email: string, password: string) => {
    setError('');
    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password,
      );
      setProfile(await loadProfile(credential.user.uid));
      setUser(credential.user);
      setStatus('authenticated');
      return true;
    } catch (loginError) {
      setError(getErrorMessage(loginError));
      return false;
    }
  };

  const register = async (input: RegisterInput) => {
    setError('');
    if (!input.termsAccepted) {
      setError('KVKK aydınlatma metni ve kullanım koşulları onaylanmalıdır.');
      return false;
    }

    let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
    try {
      credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        input.email.trim(),
        input.password,
      );
      await httpsCallable(firebaseFunctions, 'finalizeRegistration')({
        profile: {
          fullName: input.fullName.trim(),
          plate: input.plate.trim().toUpperCase(),
          model: input.model.trim(),
          odometer: input.odometer,
          vehicleType: input.vehicleType,
          tuningStage: 'Stock',
          horsepower: 0,
          garage: '',
          region: 'Belirtilmedi',
          avatar: '',
          parts: input.vehicleType === 'motorcycle' ? motorcycleParts : carParts,
          privacy: {
            showModelInSearch: true,
            showRegionInSearch: false,
          },
        },
        acceptTerms: true,
        acceptPlateSearch: true,
      });
      setProfile(await loadProfile(credential.user.uid));
      setUser(credential.user);
      setStatus('authenticated');
      return true;
    } catch (registerError) {
      if (credential?.user) {
        try {
          await deleteUser(credential.user);
        } catch {
          // Backend profile creation failed; the account can be recovered administratively.
        }
      }
      setError(getErrorMessage(registerError));
      return false;
    }
  };

  const logout = async () => {
    await signOut(firebaseAuth);
    setUser(null);
    setProfile(null);
    setStatus('anonymous');
  };

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    profile,
    error,
    clearError: () => setError(''),
    login,
    register,
    logout,
    refreshProfile,
  }), [error, profile, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
