import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Surface } from '@/components/screen-shell';
import { colors, fonts } from '@/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

export function ModulePlaceholder({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <Surface>
      <View style={styles.icon}>
        <Ionicons name={icon} size={24} color={colors.lime} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.rail}>
        <View style={styles.progress} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.limeMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  title: {
    marginTop: 18,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  description: {
    marginTop: 7,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  rail: {
    height: 5,
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#252824',
  },
  progress: {
    width: '42%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.lime,
  },
});
