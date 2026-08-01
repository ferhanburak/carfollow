import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { callFirebase } from '@/lib/firebase-callable';

const PUSH_TOKEN_STORAGE_KEY = 'tracksnap-expo-push-token';
const ALERTS_CHANNEL_ID = 'cruiser-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
    name: 'TrackSnap bildirimleri',
    description: 'Sosyal, forum, etkinlik ve mesaj bildirimleri',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#a3e635',
    sound: 'default',
  });
}

function resolveProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
}

export async function registerDevicePushToken() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  await configureAndroidChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return null;

  const projectId = resolveProjectId();
  if (!projectId) return null;
  const response = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = response.data;
  await callFirebase('registerPushToken', {
    token,
    platform: Platform.OS,
    deviceName: Device.deviceName || Device.modelName || '',
  });
  await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
  return token;
}

export async function unregisterDevicePushToken() {
  if (Platform.OS === 'web') return;
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;
  await callFirebase('unregisterPushToken', { token });
  await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
}

export type PushNavigationData = {
  type?: string;
  targetId?: string;
  threadId?: string;
  senderUserId?: string;
  actionType?: string;
};

export function readPushNavigationData(
  response: Notifications.NotificationResponse,
): PushNavigationData {
  const data = response.notification.request.content.data ?? {};
  return {
    type: typeof data.type === 'string' ? data.type : undefined,
    targetId: typeof data.targetId === 'string' ? data.targetId : undefined,
    threadId: typeof data.threadId === 'string' ? data.threadId : undefined,
    senderUserId: typeof data.senderUserId === 'string' ? data.senderUserId : undefined,
    actionType: typeof data.actionType === 'string' ? data.actionType : undefined,
  };
}
