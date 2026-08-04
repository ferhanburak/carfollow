import { LinearGradient } from 'expo-linear-gradient';
import { Image, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

export function LoadingScreen() {
  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundRaised, colors.background]}
      style={styles.container}
    >
      <View style={styles.glow} />
      <Image
        source={require('../../assets/images/cruiser-road-mark.png')}
        style={styles.logo}
      />
      <Text style={styles.wordmark}>TrackSnap</Text>
    </LinearGradient>
  );
}

const styles = createThemedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(163,230,53,0.08)',
  },
  logo: {
    width: 128,
    height: 128,
  },
  wordmark: {
    marginTop: 14,
    color: colors.lime,
    fontFamily: fonts.extraBold,
    fontSize: 14,
    letterSpacing: 7,
  },
}));
