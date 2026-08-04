import AsyncStorage from '@react-native-async-storage/async-storage';

const ROUTE_HISTORY_KEY = '@tracksnap/route-history-v1';
const PENDING_ROUTE_SUMMARY_KEY = '@tracksnap/pending-route-summary-v1';
const MAX_ROUTE_POINTS = 1_200;
const MAX_HISTORY_ITEMS = 20;

export type RoutePoint = {
  accuracy?: number;
  lat: number;
  lng: number;
  timestamp: number;
};

export type RouteSummary = {
  averageSpeedKmh: number;
  distanceKm: number;
  durationSeconds: number;
  endedAt: number;
  id: string;
  kind: 'drive' | 'convoy';
  maxSpeedKmh: number;
  points: RoutePoint[];
  startedAt: number;
  title: string;
};

type SummaryListener = (summary: RouteSummary) => void;

const listeners = new Set<SummaryListener>();
let summaryWriteQueue: Promise<unknown> = Promise.resolve();

export function appendRoutePoint(
  points: RoutePoint[],
  candidate: RoutePoint,
): RoutePoint[] {
  if (!isUsablePoint(candidate)) return points;
  const previous = points.at(-1);
  if (previous) {
    const elapsedMs = candidate.timestamp - previous.timestamp;
    const distanceM = distanceBetweenPoints(previous, candidate) * 1_000;
    if (elapsedMs <= 0 || (distanceM < 5 && elapsedMs < 15_000)) return points;
  }

  const next = [...points, candidate];
  if (next.length <= MAX_ROUTE_POINTS) return next;

  // Keep both ends while thinning older samples on unusually long sessions.
  return next.filter((_point, index) => index === 0 || index === next.length - 1 || index % 2 === 0);
}

export function calculateRouteDistanceKm(points: RoutePoint[]) {
  return points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous ? total + distanceBetweenPoints(previous, point) : total;
  }, 0);
}

export function trimRouteEndpoints(points: RoutePoint[], distanceM = 200) {
  if (points.length < 2 || distanceM <= 0) return points;
  let startIndex = 0;
  let startDistanceM = 0;
  while (startIndex < points.length - 1 && startDistanceM < distanceM) {
    startDistanceM += distanceBetweenPoints(points[startIndex], points[startIndex + 1]) * 1_000;
    startIndex += 1;
  }

  let endIndex = points.length - 1;
  let endDistanceM = 0;
  while (endIndex > 0 && endDistanceM < distanceM) {
    endDistanceM += distanceBetweenPoints(points[endIndex], points[endIndex - 1]) * 1_000;
    endIndex -= 1;
  }
  return startIndex < endIndex ? points.slice(startIndex, endIndex + 1) : [];
}

export function saveRouteSummary(summary: RouteSummary) {
  const normalized = normalizeSummary(summary);
  const operation = summaryWriteQueue.then(async () => {
    const history = await readRouteHistory();
    const nextHistory = [
      normalized,
      ...history.filter((item) => item.id !== normalized.id),
    ].slice(0, MAX_HISTORY_ITEMS);

    await Promise.all([
      AsyncStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(nextHistory)),
      AsyncStorage.setItem(PENDING_ROUTE_SUMMARY_KEY, JSON.stringify(normalized)),
    ]);
    listeners.forEach((listener) => listener(normalized));
    return normalized;
  });
  summaryWriteQueue = operation.catch(() => undefined);
  return operation;
}

export async function consumePendingRouteSummary() {
  const stored = await AsyncStorage.getItem(PENDING_ROUTE_SUMMARY_KEY);
  if (!stored) return null;
  await AsyncStorage.removeItem(PENDING_ROUTE_SUMMARY_KEY);
  try {
    return normalizeSummary(JSON.parse(stored) as RouteSummary);
  } catch {
    return null;
  }
}

export async function clearPendingRouteSummary() {
  await AsyncStorage.removeItem(PENDING_ROUTE_SUMMARY_KEY);
}

export function subscribeToRouteSummaries(listener: SummaryListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createGpx(summary: RouteSummary) {
  const points = summary.points.map((point) => [
    `    <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}">`,
    `      <time>${new Date(point.timestamp).toISOString()}</time>`,
    '    </trkpt>',
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="TrackSnap" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapeXml(summary.title)}</name>`,
    `    <time>${new Date(summary.startedAt).toISOString()}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(summary.title)}</name>`,
    '    <trkseg>',
    points,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n');
}

async function readRouteHistory(): Promise<RouteSummary[]> {
  const stored = await AsyncStorage.getItem(ROUTE_HISTORY_KEY);
  if (!stored) return [];
  try {
    const value = JSON.parse(stored) as unknown;
    return Array.isArray(value) ? value.map((item) => normalizeSummary(item as RouteSummary)) : [];
  } catch {
    return [];
  }
}

function normalizeSummary(summary: RouteSummary): RouteSummary {
  const startedAt = Number(summary.startedAt || Date.now());
  const endedAt = Number(summary.endedAt || Date.now());
  const points = Array.isArray(summary.points)
    ? summary.points.filter(isUsablePoint).slice(-MAX_ROUTE_POINTS)
    : [];
  return {
    averageSpeedKmh: Math.max(0, Number(summary.averageSpeedKmh ?? 0)),
    distanceKm: Math.max(0, Number(summary.distanceKm ?? calculateRouteDistanceKm(points))),
    durationSeconds: Math.max(0, Number(summary.durationSeconds ?? (endedAt - startedAt) / 1_000)),
    endedAt,
    id: String(summary.id || `route-${startedAt}`),
    kind: summary.kind === 'convoy' ? 'convoy' : 'drive',
    maxSpeedKmh: Math.max(0, Number(summary.maxSpeedKmh ?? 0)),
    points,
    startedAt,
    title: String(summary.title || 'TrackSnap rotası'),
  };
}

function isUsablePoint(point: RoutePoint) {
  return Number.isFinite(point?.lat)
    && Number.isFinite(point?.lng)
    && Number.isFinite(point?.timestamp)
    && Math.abs(point.lat) <= 90
    && Math.abs(point.lng) <= 180
    && Number(point.accuracy ?? 0) <= 60;
}

function distanceBetweenPoints(a: RoutePoint, b: RoutePoint) {
  const earthRadiusKm = 6_371;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2
  );
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
