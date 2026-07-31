import type { MapPin } from '@/types/cruiser';

const CLOSED_EVENT_STATUSES = new Set(['completed', 'cancelled']);

export function isVisibleMapPin(pin: MapPin) {
  if (pin.type !== 'meet') return true;
  return !CLOSED_EVENT_STATUSES.has(String(pin.lifecycleStatus ?? 'planning').toLowerCase());
}

