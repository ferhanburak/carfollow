import { httpsCallable } from 'firebase/functions';

import { firebaseFunctions } from '@/lib/firebase';

const errorMessages: Record<string, string> = {
  'functions/already-exists': 'Bu kayıt zaten mevcut.',
  'functions/failed-precondition': 'Bu işlem için gerekli koşullar sağlanmıyor.',
  'functions/invalid-argument': 'Girilen bilgileri kontrol edin.',
  'functions/not-found': 'İstenen kayıt bulunamadı.',
  'functions/permission-denied': 'Bu işlem için yetkiniz yok.',
  'functions/resource-exhausted': 'Çok fazla istek gönderildi. Biraz sonra tekrar deneyin.',
  'functions/unauthenticated': 'Oturumunuz sona erdi. Tekrar giriş yapın.',
  'functions/unavailable': 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.',
};

export function getFirebaseErrorMessage(error: unknown, fallback = 'İşlem tamamlanamadı.') {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
  if (errorMessages[code]) return errorMessages[code];
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function callFirebase<TResponse = Record<string, unknown>>(
  name: string,
  payload: Record<string, unknown> = {},
) {
  const result = await httpsCallable<Record<string, unknown>, TResponse>(
    firebaseFunctions,
    name,
  )(payload);
  return result.data;
}

export function toMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value && 'toMillis' in value) {
    const toMillisFn = (value as { toMillis?: () => number }).toMillis;
    if (typeof toMillisFn === 'function') return toMillisFn.call(value);
  }
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
