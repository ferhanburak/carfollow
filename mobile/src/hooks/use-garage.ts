import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { firestoreDb } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage, toMillis } from '@/lib/firebase-callable';
import {
  PRIVATE_COLLECTIONS,
  privateCollectionPath,
  privateDocumentPath,
  privateProfilePath,
} from '@/lib/firebase-paths';
import { useAuth } from '@/providers/auth-provider';

export type VehiclePart = {
  id: string;
  key: string;
  name: string;
  vehicleId: string;
  lifeExpectancyKm: number;
  lifeExpectancyMonths: number;
  replacedKm: number;
  replacedAt: string;
  lifePercent?: number;
  remainingPercent?: number;
  createdAt?: unknown;
  [key: string]: unknown;
};

export type ServiceLog = {
  id: string;
  vehicleId: string;
  partKey: string;
  type: 'replacement' | 'inspection' | 'repair';
  serviceDate: string;
  serviceKm: number;
  serviceShop: string;
  cost: number;
  notes: string;
  createdAt: number;
};

export function useGarage() {
  const { profile, refreshProfile, user } = useAuth();
  const [parts, setParts] = useState<VehiclePart[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [vehicle, setVehicle] = useState<Record<string, unknown> | null>(null);
  const [driverStats, setDriverStats] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubscribers = [
      onSnapshot(
        collection(firestoreDb, privateCollectionPath(user.uid, PRIVATE_COLLECTIONS.parts)),
        (snapshot) => setParts(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
        })) as VehiclePart[]),
      ),
      onSnapshot(
        collection(firestoreDb, privateCollectionPath(user.uid, PRIVATE_COLLECTIONS.serviceLogs)),
        (snapshot) => setServiceLogs(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          createdAt: toMillis(item.data().createdAt),
        })) as ServiceLog[]),
      ),
      onSnapshot(
        collection(firestoreDb, privateCollectionPath(user.uid, PRIVATE_COLLECTIONS.vehicles)),
        (snapshot) => {
          const primary = snapshot.docs.find((item) => item.data().isPrimary) ?? snapshot.docs[0];
          setVehicle(primary ? { ...primary.data(), id: primary.id } : null);
        },
      ),
      onSnapshot(
        doc(firestoreDb, privateDocumentPath(user.uid, PRIVATE_COLLECTIONS.driverStats, 'current')),
        (snapshot) => setDriverStats(snapshot.exists() ? snapshot.data() : null),
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user]);

  const activeVehicleId = String(
    profile?.primaryVehicleId ?? vehicle?.vehicleId ?? vehicle?.id ?? '',
  );
  const activeParts = useMemo(
    () => parts.filter((part) => !activeVehicleId || part.vehicleId === activeVehicleId),
    [activeVehicleId, parts],
  );
  const activeLogs = useMemo(
    () => serviceLogs
      .filter((log) => !activeVehicleId || log.vehicleId === activeVehicleId)
      .sort((left, right) => right.serviceDate.localeCompare(left.serviceDate)),
    [activeVehicleId, serviceLogs],
  );

  async function addServiceLog(input: {
    part: VehiclePart;
    type: ServiceLog['type'];
    serviceDate: string;
    serviceKm: number;
    serviceShop: string;
    cost: number;
    notes: string;
  }) {
    if (!user || !activeVehicleId) throw new Error('Aktif araç bulunamadı.');
    const id = `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceRef = doc(
      firestoreDb,
      privateDocumentPath(user.uid, PRIVATE_COLLECTIONS.serviceLogs, id),
    );
    const vehicleRef = doc(
      firestoreDb,
      privateDocumentPath(user.uid, PRIVATE_COLLECTIONS.vehicles, activeVehicleId),
    );
    const passportRef = doc(
      firestoreDb,
      privateDocumentPath(user.uid, PRIVATE_COLLECTIONS.vehiclePassports, activeVehicleId),
    );
    const profileRef = doc(firestoreDb, privateProfilePath(user.uid));
    const partRef = doc(
      firestoreDb,
      privateDocumentPath(user.uid, PRIVATE_COLLECTIONS.parts, input.part.id),
    );

    setBusy('service');
    setError('');
    try {
      await runTransaction(firestoreDb, async (transaction) => {
        const [vehicleSnapshot, passportSnapshot, profileSnapshot, partSnapshot] = await Promise.all([
          transaction.get(vehicleRef),
          transaction.get(passportRef),
          transaction.get(profileRef),
          transaction.get(partRef),
        ]);
        if (!vehicleSnapshot.exists() || !passportSnapshot.exists() ||
            !profileSnapshot.exists() || !partSnapshot.exists()) {
          throw new Error('Araç servis kayıtları bulunamadı.');
        }
        const vehicleData = vehicleSnapshot.data();
        const passport = passportSnapshot.data();
        const profileData = profileSnapshot.data();
        const previousPart = partSnapshot.data();
        const nextOdometer = Math.max(
          Number(vehicleData.odometer ?? 0),
          Number(profileData.odometer ?? 0),
          input.serviceKm,
        );
        const timestamp = serverTimestamp();

        transaction.set(serviceRef, {
          id,
          vehicleId: activeVehicleId,
          userId: user.uid,
          partKey: input.part.key,
          type: input.type,
          serviceDate: input.serviceDate,
          serviceKm: input.serviceKm,
          serviceShop: input.serviceShop.trim(),
          cost: input.cost,
          notes: input.notes.trim(),
          receiptImageUrl: '',
          ...(input.type === 'replacement' ? {
            previousPartState: {
              replacedKm: Number(previousPart.replacedKm ?? 0),
              replacedAt: String(previousPart.replacedAt ?? ''),
              lastServiceLogId: previousPart.lastServiceLogId ?? null,
              lastServiceCost: Number(previousPart.lastServiceCost ?? 0),
              lastServiceShop: String(previousPart.lastServiceShop ?? ''),
              notes: String(previousPart.notes ?? ''),
            },
          } : {}),
          createdAt: timestamp,
        });
        transaction.update(vehicleRef, {
          odometer: nextOdometer,
          lastOdometerSource: 'service',
          lastServiceDate: input.serviceDate,
          updatedAt: timestamp,
        });
        transaction.update(profileRef, { odometer: nextOdometer, updatedAt: timestamp });
        transaction.update(passportRef, {
          serviceLogCount: Number(passport.serviceLogCount ?? 0) + 1,
          totalServiceSpend: Number(passport.totalServiceSpend ?? 0) + input.cost,
          lastServiceDate: input.serviceDate,
          lastMutationId: id,
          lastMutationType: 'service',
          updatedAt: timestamp,
        });
        if (input.type === 'replacement') {
          transaction.set(partRef, {
            ...previousPart,
            replacedKm: input.serviceKm,
            replacedAt: input.serviceDate,
            lastServiceLogId: id,
            lastServiceCost: input.cost,
            lastServiceShop: input.serviceShop.trim(),
            notes: input.notes.trim(),
            updatedAt: timestamp,
          });
        }
      });
      await callFirebase('refreshDriverStats');
      await refreshProfile();
    } catch (serviceError) {
      setError(getFirebaseErrorMessage(serviceError, 'Servis kaydı eklenemedi.'));
      throw serviceError;
    } finally {
      setBusy('');
    }
  }

  async function deleteServiceLog(serviceLogId: string) {
    setBusy(`delete-${serviceLogId}`);
    setError('');
    try {
      await callFirebase('deleteServiceLog', { serviceLogId });
      await callFirebase('refreshDriverStats');
      await refreshProfile();
    } catch (deleteError) {
      setError(getFirebaseErrorMessage(deleteError, 'Servis kaydı silinemedi.'));
      throw deleteError;
    } finally {
      setBusy('');
    }
  }

  return {
    parts: activeParts,
    serviceLogs: activeLogs,
    vehicle,
    driverStats,
    busy,
    error,
    addServiceLog,
    deleteServiceLog,
  };
}
