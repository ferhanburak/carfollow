import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  clearBackgroundDrive,
  isBackgroundDriveRunning,
  readBackgroundDriveSnapshot,
  startBackgroundDrive,
  stopBackgroundDrive,
  subscribeToBackgroundDrive,
  type BackgroundDriveSnapshot,
} from '@/lib/background-drive';
import { createDriveMetrics, type DriveMetrics } from '@/lib/drive-telemetry';
import { firebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/providers/auth-provider';

type DriveStatus =
  | 'idle'
  | 'requesting-permission'
  | 'starting'
  | 'active'
  | 'finalizing'
  | 'completed'
  | 'error';

type FinishDriveResult = {
  ok?: boolean;
  acceptedKm?: number;
  rejectedKm?: number;
};

type StartDriveResult = {
  ok?: boolean;
  resumed?: boolean;
  sessionId?: string;
};

export type DriveSessionState = {
  accuracy: number | null;
  currentSpeedKmh: number;
  elapsedSeconds: number;
  error: string;
  isDriving: boolean;
  location: { lat: number; lng: number; accuracy: number } | null;
  metrics: DriveMetrics;
  pending: boolean;
  sessionId: string | null;
  status: DriveStatus;
  statusMessage: string;
};

const initialState: DriveSessionState = {
  accuracy: null,
  currentSpeedKmh: 0,
  elapsedSeconds: 0,
  error: '',
  isDriving: false,
  location: null,
  metrics: createDriveMetrics(),
  pending: false,
  sessionId: null,
  status: 'idle',
  statusMessage: 'Gerçek GPS sürüş oturumuna hazır.',
};

function getLocationError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.toLowerCase().includes('permission')) {
    return 'Arka plan sürüş takibi için konum ve bildirim izinlerini açmalısın.';
  }
  return message || 'GPS konumu okunamadı.';
}

function elapsedSince(startedAt: number | null) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1_000));
}

async function requestDrivePermissions() {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) throw new Error('Telefonun konum servisini açmalısın.');

  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (!foregroundPermission.granted) {
    throw new Error('Konum izni olmadan sürüş kaydı başlatılamaz.');
  }

  if (Platform.OS === 'ios') {
    const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
    if (!backgroundPermission.granted) {
      throw new Error('Ekran kapalıyken sürüş kaydı için konum iznini “Her Zaman” seçmelisin.');
    }
  }

  if (Platform.OS === 'android') {
    const notificationPermission = await Notifications.requestPermissionsAsync();
    if (!notificationPermission.granted) {
      throw new Error('Arka plan sürüş durumunu görebilmek için bildirim iznini açmalısın.');
    }
  }
}

export function useDriveSession() {
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<DriveSessionState>(initialState);
  const snapshotRef = useRef<BackgroundDriveSnapshot | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const hydrateSnapshot = useCallback((snapshot: BackgroundDriveSnapshot, running: boolean) => {
    snapshotRef.current = snapshot;
    startedAtRef.current = snapshot.startedAt;
    setState((current) => ({
      ...current,
      accuracy: snapshot.accuracy,
      currentSpeedKmh: running ? snapshot.currentSpeedKmh : 0,
      elapsedSeconds: elapsedSince(snapshot.startedAt),
      error: running ? '' : 'Sürüş takibi durdu; kaydı sunucuya gönderebilirsin.',
      isDriving: running,
      location: snapshot.location,
      metrics: snapshot.metrics,
      pending: false,
      sessionId: snapshot.sessionId,
      status: running ? 'active' : 'error',
      statusMessage: running
        ? snapshot.statusMessage
        : 'Sürüş verisi cihazda korunuyor; kaydı tamamlamayı yeniden deneyebilirsin.',
    }));
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const restore = async () => {
      const snapshot = await readBackgroundDriveSnapshot();
      if (!mounted || !snapshot) return;
      if (snapshot.userId !== user.uid) {
        await clearBackgroundDrive();
        return;
      }
      const running = await isBackgroundDriveRunning();
      if (mounted) hydrateSnapshot(snapshot, running);
    };

    void restore();
    const unsubscribe = subscribeToBackgroundDrive((snapshot) => {
      if (snapshot.userId === user.uid) hydrateSnapshot(snapshot, true);
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void restore();
    });

    return () => {
      mounted = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [hydrateSnapshot, user]);

  useEffect(() => {
    if (!state.isDriving || !startedAtRef.current) return;
    const updateElapsed = () => {
      const elapsedSeconds = elapsedSince(startedAtRef.current);
      setState((current) => (
        current.elapsedSeconds === elapsedSeconds
          ? current
          : { ...current, elapsedSeconds }
      ));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1_000);
    return () => clearInterval(timer);
  }, [state.isDriving]);

  const start = useCallback(async () => {
    if (!user || stateRef.current.pending || stateRef.current.isDriving) return false;

    setState((current) => ({
      ...current,
      error: '',
      pending: true,
      status: 'requesting-permission',
      statusMessage: 'Arka plan konum ve bildirim izinleri kontrol ediliyor...',
    }));

    let openedSessionId = '';
    try {
      await requestDrivePermissions();
      setState((current) => ({
        ...current,
        status: 'starting',
        statusMessage: 'Güvenli sürüş oturumu açılıyor...',
      }));

      const requestedSessionId = `mobile_${user.uid}_${Date.now()}`;
      const response = await httpsCallable<
        { sessionId: string },
        StartDriveResult
      >(firebaseFunctions, 'startDriveSession')({ sessionId: requestedSessionId });
      openedSessionId = response.data.sessionId || requestedSessionId;

      const snapshot = await startBackgroundDrive(openedSessionId, user.uid);
      hydrateSnapshot(snapshot, true);
      setState((current) => ({
        ...current,
        error: '',
        isDriving: true,
        pending: false,
        status: 'active',
        statusMessage: response.data.resumed
          ? 'Açık sürüş oturumuna yeniden bağlanıldı; arka plan takibi aktif.'
          : 'Sürüş başladı; ekran kapalıyken de GPS kaydedilecek.',
      }));
      return true;
    } catch (error) {
      if (openedSessionId) {
        await httpsCallable(firebaseFunctions, 'finishDriveSession')({
          acceptedSampleCount: 0,
          qualifiedSpeedSampleCount: 0,
          reportedKm: 0,
          reportedMaxSpeedKmh: 0,
          reportedMovingSeconds: 0,
          sessionId: openedSessionId,
        }).catch(() => undefined);
      }
      const message = getLocationError(error);
      await clearBackgroundDrive();
      setState((current) => ({
        ...current,
        error: message,
        isDriving: false,
        pending: false,
        status: 'error',
        statusMessage: message,
      }));
      return false;
    }
  }, [hydrateSnapshot, user]);

  const finish = useCallback(async () => {
    const current = stateRef.current;
    if (!current.sessionId || current.pending) return false;

    setState((value) => ({
      ...value,
      currentSpeedKmh: 0,
      isDriving: false,
      pending: true,
      status: 'finalizing',
      statusMessage: 'Arka plan takibi kapatılıyor ve sürüş doğrulanıyor...',
    }));

    try {
      await stopBackgroundDrive();
      const snapshot = await readBackgroundDriveSnapshot();
      const metrics = snapshot?.metrics ?? snapshotRef.current?.metrics ?? current.metrics;
      const response = await httpsCallable<
        {
          acceptedSampleCount: number;
          qualifiedSpeedSampleCount: number;
          reportedKm: number;
          reportedMaxSpeedKmh: number;
          reportedMovingSeconds: number;
          sessionId: string;
        },
        FinishDriveResult
      >(firebaseFunctions, 'finishDriveSession')({
        acceptedSampleCount: metrics.acceptedSampleCount,
        qualifiedSpeedSampleCount: metrics.qualifiedSpeedSampleCount,
        reportedKm: metrics.sessionKm,
        reportedMaxSpeedKmh: metrics.maxSpeedKmh,
        reportedMovingSeconds: metrics.movingSeconds,
        sessionId: current.sessionId,
      });
      const acceptedKm = Number(response.data.acceptedKm ?? metrics.sessionKm);
      const rejectedKm = Number(response.data.rejectedKm ?? 0);
      await clearBackgroundDrive();
      snapshotRef.current = null;
      startedAtRef.current = null;
      await refreshProfile();

      setState((value) => ({
        ...value,
        currentSpeedKmh: 0,
        error: '',
        isDriving: false,
        pending: false,
        sessionId: null,
        status: 'completed',
        statusMessage: rejectedKm > 0
          ? `${acceptedKm.toFixed(2)} KM onaylandı, ${rejectedKm.toFixed(2)} KM filtrelendi.`
          : `${acceptedKm.toFixed(2)} KM onaylandı ve istatistiklere işlendi.`,
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Sürüş kaydı tamamlanamadı.';
      setState((value) => ({
        ...value,
        error: message,
        isDriving: false,
        pending: false,
        status: 'error',
        statusMessage: 'Sürüş verisi cihazda korunuyor; tamamlamayı yeniden deneyebilirsin.',
      }));
      return false;
    }
  }, [refreshProfile]);

  const reset = useCallback(() => {
    void clearBackgroundDrive();
    snapshotRef.current = null;
    startedAtRef.current = null;
    setState(initialState);
  }, []);

  return { ...state, finish, reset, start };
}
