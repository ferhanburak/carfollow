import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { DriverProfileProvider } from '@/providers/driver-profile-provider';
import { colors } from '@/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

const icons: Record<string, { active: IconName; idle: IconName }> = {
  map: { active: 'map', idle: 'map-outline' },
  'live-map': { active: 'navigate', idle: 'navigate-outline' },
  drive: { active: 'speedometer', idle: 'speedometer-outline' },
  social: { active: 'people', idle: 'people-outline' },
  leaderboard: { active: 'stats-chart', idle: 'stats-chart-outline' },
  profile: { active: 'person', idle: 'person-outline' },
};

export default function TabLayout() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <DriverProfileProvider>
      <Tabs
        initialRouteName="forum"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.lime,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          sceneStyle: styles.scene,
          tabBarIcon: ({ color, focused }) => {
            if (route.name === 'forum') {
              return (
                <View style={[styles.forumButton, focused && styles.forumButtonActive]}>
                  <Image
                    contentFit="contain"
                    source={require('../../../assets/images/cruiser-road-mark.png')}
                    style={styles.forumLogo}
                  />
                </View>
              );
            }
            const icon = icons[route.name] ?? icons.profile;
            return (
              <View style={[styles.iconButton, focused && styles.iconButtonActive]}>
                <Ionicons
                  color={focused ? colors.black : color}
                  name={focused ? icon.active : icon.idle}
                  size={21}
                />
                {focused ? <View style={styles.activeIndicator} /> : null}
              </View>
            );
          },
        })}
      >
        <Tabs.Screen name="map" options={{ title: 'Harita' }} />
        <Tabs.Screen name="live-map" options={{ title: 'Canlı Harita' }} />
        <Tabs.Screen name="drive" options={{ title: 'Sürüş' }} />
        <Tabs.Screen name="forum" options={{ title: 'Akış' }} />
        <Tabs.Screen name="social" options={{ title: 'Sosyal' }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Sıralama' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      </Tabs>
    </DriverProfileProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scene: { backgroundColor: colors.background },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    height: 68,
    paddingTop: 5,
    paddingBottom: 5,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: 'rgba(11,13,10,0.98)',
    shadowColor: colors.lime,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 18,
    overflow: 'visible',
  },
  tabItem: {
    minHeight: 56,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 7,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 13,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.black,
  },
  forumButton: {
    width: 66,
    height: 66,
    marginTop: -24,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: '#080a07',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 12,
  },
  forumButtonActive: {
    borderColor: colors.lime,
    shadowOpacity: 0.65,
    shadowRadius: 18,
  },
  forumLogo: { width: 52, height: 52 },
});
