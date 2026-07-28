import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
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
                size={20}
              />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="map" options={{ title: 'Harita' }} />
      <Tabs.Screen name="live-map" options={{ title: 'Canlı Harita' }} />
      <Tabs.Screen name="drive" options={{ title: 'Sürüş' }} />
      <Tabs.Screen name="social" options={{ title: 'Sosyal' }} />
      <Tabs.Screen name="forum" options={{ title: 'Akış' }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Sıralama' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
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
    left: 12,
    right: 12,
    bottom: 12,
    height: 72,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    backgroundColor: 'rgba(11,13,10,0.98)',
    shadowColor: colors.black,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  tabItem: { minHeight: 58 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  forumButton: {
    width: 62,
    height: 62,
    marginTop: -20,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: '#080a07',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  forumButtonActive: {
    borderColor: colors.lime,
    shadowOpacity: 0.65,
    shadowRadius: 18,
  },
  forumLogo: { width: 48, height: 48 },
});
