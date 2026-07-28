import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, ScreenShell, Surface } from '@/components/screen-shell';
import { colors, fonts } from '@/theme/colors';

export default function MapScreen() {
  return (
    <ScreenShell title="Etkinlik Haritası">
      <Surface>
        <View style={styles.mapPreview}>
          <View style={styles.grid} />
          <View style={[styles.pin, styles.pinOne]}>
            <Ionicons color={colors.black} name="camera" size={17} />
          </View>
          <View style={[styles.pin, styles.pinTwo, styles.pinRose]}>
            <Ionicons color={colors.white} name="people" size={17} />
          </View>
          <View style={styles.route} />
          <View style={styles.mapCopy}>
            <Eyebrow>YAKINDA</Eyebrow>
            <Text style={styles.mapTitle}>Native harita katmanı</Text>
            <Text style={styles.mapDescription}>
              Mevcut etkinlik ve nokta verileri korunarak mobil harita bu alana bağlanacak.
            </Text>
          </View>
        </View>
        <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Ionicons color={colors.black} name="add" size={21} />
          <Text style={styles.actionText}>Etkinlik Ekle</Text>
        </Pressable>
      </Surface>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  mapPreview: {
    minHeight: 420,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#090b09',
  },
  grid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.18,
    borderWidth: 24,
    borderColor: '#20251d',
    transform: [{ rotate: '-8deg' }, { scale: 1.3 }],
  },
  route: {
    position: 'absolute',
    left: -20,
    top: 210,
    width: 330,
    height: 110,
    borderTopWidth: 4,
    borderColor: colors.lime,
    borderRadius: 160,
    transform: [{ rotate: '-18deg' }],
  },
  pin: {
    position: 'absolute',
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinOne: { left: 62, top: 114 },
  pinTwo: { right: 54, top: 244 },
  pinRose: { backgroundColor: colors.rose },
  mapCopy: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(8,10,7,0.91)',
  },
  mapTitle: {
    marginTop: 7,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  mapDescription: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  action: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
