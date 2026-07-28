import * as Location from 'expo-location';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createDriveMetrics,
  processGpsPosition,
  stabilizeDisplayedSpeed,
  updateDriveMetrics,
  type DisplayedSpeed,
  type DriveMetrics,
  type GpsPoint,
} from '@/lib/drive-telemetry';
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
    return 'Konum izni olmadan sürüş kaydı başlatılamaz.';
  }
  return message || 'GPS konumu okunamadı.';
}

export function useDriveSession() {
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<DriveSessionState>(initialState);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pointRef = useRef<GpsPoint | null>(null);
  const metricsRef = useRef<DriveMetrics>(createDriveMetrics());
  const displayedSpeedRef = useRef<DisplayedSpeed | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!state.isDriving || !startedAtRef.current) return;

    const updateElapsed = () => {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - Number(startedAtRef.current)) / 1000),
      );
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

  useEffect(() => () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const consumePosition = useCallback((position: Location.LocationObject) => {
    const reading = processGpsPosition(pointRef.current, position);
    if (reading.accepted) pointRef.current = reading.nextPoint;

    const displayedSpeed = stabilizeDisplayedSpeed(displayedSpeedRef.current, reading);
    displayedSpeedRef.current = displayedSpeed;
    metricsRef.current = updateDriveMetrics(metricsRef.current, reading);

    setState((current) => ({
      ...current,
      accuracy: reading.accuracy ?? current.accuracy,
      currentSpeedKmh: displayedSpeed.speedKmh,
      error: reading.gpsStatus === 'error' ? 'GPS örneği doğrulanamadı.' : '',
      location: reading.location ?? current.location,
      metrics: metricsRef.current,
      statusMessage: reading.gpsStatus === 'weak'
        ? 'GPS doğruluğu zayıf; bu örnek mesafeye eklenmedi.'
        : 'Gerçek GPS telemetrisi aktif.',
    }));
  }, []);

  const beginWatcher = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 1,
        mayShowUserSettingsDialog: true,
        timeInterval: 1_000,
      },
      consumePosition,
    );
  }, [consumePosition]);

  const start = useCallback(async () => {
    if (!user || stateRef.current.pending || stateRef.current.isDriving) return false;

    setState((current) => ({
      ...current,
      error: '',
      pending: true,
      status: 'requesting-permission',
      statusMessage: 'Konum izni kontrol ediliyor...',
    }));

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Telefonun konum servisini açmalısın.');
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Konum izni olmadan sürüş kaydı başlatılamaz.');
      }

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
      const sessionId = response.data.sessionId || requestedSessionId;

      pointRef.current = null;
      metricsRef.current = createDriveMetrics();
      displayedSpeedRef.current = null;
      startedAtRef.current = Date.now();
      await beginWatcher();

      setState({
        ...initialState,
        isDriving: true,
        pending: false,
        sessionId,
        status: 'active',
        statusMessage: response.data.resumed
          ? 'Açık sürüş oturumuna yeniden bağlanıldı.'
          : 'Sürüş başladı; güvenilir GPS örnekleri kaydediliyor.',
      });
      return true;
    } catch (error) {
      const message = getLocationError(error);
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
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
  }, [beginWatcher, user]);

  const finish = useCallback(async () => {
    const current = stateRef.current;
    if (!current.sessionId || current.pending) return false;

    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setState((value) => ({
      ...value,
      currentSpeedKmh: 0,
      isDriving: false,
      pending: true,
      status: 'finalizing',
      statusMessage: 'Sürüş verileri doğrulanıyor...',
    }));

    try {
      const metrics = metricsRef.current;
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
        statusMessage: 'Sürüş verisi korunuyor; tamamlamayı yeniden deneyebilirsin.',
      }));
      return false;
    }
  }, [refreshProfile]);

  const reset = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    pointRef.current = null;
    metricsRef.current = createDriveMetrics();
    displayedSpeedRef.current = null;
    startedAtRef.current = null;
    setState(initialState);
  }, []);

  return { ...state, finish, reset, start };
}
