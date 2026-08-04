import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocalizedPressable as Pressable, LocalizedText as Text } from '@/components/localized-text';
import { getHelpTopic, localizedHelp, type HelpTopicId } from '@/help/help-content';
import { useAppLanguage } from '@/providers/language-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

const HELP_SEEN_PREFIX = 'tracksnap.help.seen.v1.';

export function ContextualHelp({
  autoOpen = true,
  topicId,
}: {
  autoOpen?: boolean;
  topicId: HelpTopicId;
}) {
  const router = useRouter();
  const { language } = useAppLanguage();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const topic = getHelpTopic(topicId);

  useEffect(() => {
    if (!autoOpen) return undefined;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AsyncStorage.getItem(`${HELP_SEEN_PREFIX}${topicId}`).then((seen) => {
      if (!active || seen) return;
      timer = setTimeout(() => {
        if (active) setVisible(true);
      }, 700);
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [autoOpen, topicId]);

  const close = () => {
    setVisible(false);
    setStepIndex(0);
    void AsyncStorage.setItem(`${HELP_SEEN_PREFIX}${topicId}`, '1');
  };

  const open = () => {
    setStepIndex(0);
    setVisible(true);
  };

  const next = () => {
    if (stepIndex < topic.steps.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    close();
  };

  return (
    <>
      <Pressable
        accessibilityLabel={language === 'tr' ? 'Bu ekran için yardım' : 'Help for this screen'}
        onPress={open}
        style={({ pressed }) => [styles.launcher, pressed && styles.pressed]}
      >
        <Ionicons name="help" size={21} color={colors.black} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
        <SafeAreaView style={styles.backdrop}>
          <Pressable style={styles.backdropTouch} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headingRow}>
              <View style={styles.topicIcon}>
                <Ionicons name={topic.icon} size={24} color={colors.lime} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>
                  {language === 'tr' ? 'HIZLI REHBER' : 'QUICK GUIDE'}
                </Text>
                <Text style={styles.title}>{localizedHelp(topic.title, language)}</Text>
              </View>
              <Pressable accessibilityLabel="Kapat" onPress={close} style={styles.closeButton}>
                <Ionicons name="close" size={21} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.summary}>{localizedHelp(topic.summary, language)}</Text>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{stepIndex + 1}</Text>
              </View>
              <Text style={styles.stepText}>{localizedHelp(topic.steps[stepIndex], language)}</Text>
            </View>

            <View style={styles.dots}>
              {topic.steps.map((_step, index) => (
                <View key={index} style={[styles.dot, index === stepIndex && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.tipCard}>
              <Ionicons name="shield-checkmark-outline" size={19} color={colors.lime} />
              <Text style={styles.tipText}>{localizedHelp(topic.tip, language)}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  close();
                  router.push(`/help?topic=${topicId}` as Href);
                }}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>
                  {language === 'tr' ? 'Tüm Rehber' : 'Full Guide'}
                </Text>
              </Pressable>
              <Pressable onPress={next} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>
                  {stepIndex === topic.steps.length - 1
                    ? language === 'tr' ? 'Tamam' : 'Done'
                    : language === 'tr' ? 'İleri' : 'Next'}
                </Text>
                {stepIndex < topic.steps.length - 1 ? (
                  <Ionicons name="arrow-forward" size={18} color={colors.black} />
                ) : null}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

export async function resetHelpTours() {
  await AsyncStorage.multiRemove(
    ['live-map', 'events', 'drive', 'forum', 'social', 'leaderboard', 'profile']
      .map((topic) => `${HELP_SEEN_PREFIX}${topic}`),
  );
}

const styles = createThemedStyles(() => ({
  launcher: {
    position: 'absolute',
    right: 18,
    top: 78,
    zIndex: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lime,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  backdropTouch: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundRaised,
  },
  handle: {
    width: 44,
    height: 4,
    marginBottom: 17,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
    alignSelf: 'center',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topicIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 21,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    marginTop: 16,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  stepCard: {
    minHeight: 116,
    marginTop: 16,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.black,
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 21,
  },
  dots: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textFaint,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.lime,
  },
  tipCard: {
    padding: 13,
    borderRadius: 17,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
  },
  actions: {
    marginTop: 17,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: colors.black,
    fontFamily: fonts.extraBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
}));
