import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type TrackSnapDriveNotificationModule = {
  updateAsync(title: string, summary: string, details: string): Promise<boolean>;
};

const nativeModule = Platform.OS === 'android'
  ? requireNativeModule<TrackSnapDriveNotificationModule>('TrackSnapDriveNotification')
  : null;

export async function updateDriveForegroundNotification(
  title: string,
  summary: string,
  details: string,
) {
  if (!nativeModule) return false;
  return nativeModule.updateAsync(title, summary, details);
}
