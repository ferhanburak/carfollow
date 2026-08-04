import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { resetHelpTours } from '@/components/contextual-help';
import { LocalizedPressable as Pressable, LocalizedText as Text, localizedAlert } from '@/components/localized-text';
import { HELP_TOPICS, localizedHelp, type HelpTopicId } from '@/help/help-content';
import { useAppLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useAppTheme();
  const { language } = useAppLanguage();
  const { topic } = useLocalSearchParams<{ topic?: HelpTopicId }>();
  const [expanded, setExpanded] = useState<HelpTopicId | null>(topic ?? null);

  const resetTours = async () => {
    await resetHelpTours();
    localizedAlert(
      language === 'tr' ? 'Turlar yeniden etkinleştirildi' : 'Tours enabled again',
      language === 'tr'
        ? 'Bir ekranı sonraki açışında kısa rehberi yeniden göreceksin.'
        : 'You will see its quick guide the next time you open a screen.',
    );
  };

  return (
    <LinearGradient
      colors={resolvedTheme === 'dark'
        ? [colors.background, '#0b0f08', colors.background]
        : [colors.background, colors.backgroundRaised, colors.background]}
      style={styles.root}
    >
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Geri" onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TRACKSNAP // {language === 'tr' ? 'DESTEK' : 'SUPPORT'}</Text>
            <Text style={styles.title}>{language === 'tr' ? 'Yardım ve Rehber' : 'Help & Guide'}</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="help-buoy-outline" size={22} color={colors.lime} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.whatsNew}>
            <View style={styles.whatsNewIcon}>
              <Ionicons name="sparkles" size={20} color={colors.black} />
            </View>
            <View style={styles.whatsNewCopy}>
              <Text style={styles.whatsNewLabel}>{language === 'tr' ? 'NELER YENİ?' : "WHAT'S NEW?"}</Text>
              <Text style={styles.whatsNewTitle}>
                {language === 'tr' ? 'Daha zengin forum paylaşımları' : 'Richer forum posts'}
              </Text>
              <Text style={styles.whatsNewText}>
                {language === 'tr'
                  ? 'Artık anket oluşturabilir, sürücü etiketleyebilir ve bir etkinliği paylaşımına bağlayabilirsin.'
                  : 'You can now create polls, mention drivers and attach an event to a post.'}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>{language === 'tr' ? 'Özellik Rehberleri' : 'Feature Guides'}</Text>
              <Text style={styles.sectionSubtitle}>
                {language === 'tr' ? 'Ayrıntıları görmek için bir başlık seç.' : 'Choose a topic to see its details.'}
              </Text>
            </View>
          </View>

          <View style={styles.topicList}>
            {HELP_TOPICS.map((helpTopic) => {
              const isExpanded = expanded === helpTopic.id;
              return (
                <View key={helpTopic.id} style={[styles.topicCard, isExpanded && styles.topicCardExpanded]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpanded(isExpanded ? null : helpTopic.id)}
                    style={({ pressed }) => [styles.topicHeader, pressed && styles.pressed]}
                  >
                    <View style={styles.topicIcon}>
                      <Ionicons name={helpTopic.icon} size={22} color={colors.lime} />
                    </View>
                    <View style={styles.topicCopy}>
                      <Text style={styles.topicTitle}>{localizedHelp(helpTopic.title, language)}</Text>
                      <Text numberOfLines={isExpanded ? undefined : 2} style={styles.topicSummary}>
                        {localizedHelp(helpTopic.summary, language)}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textFaint}
                    />
                  </Pressable>

                  {isExpanded ? (
                    <View style={styles.topicDetails}>
                      {helpTopic.steps.map((step, index) => (
                        <View key={index} style={styles.guideStep}>
                          <View style={styles.guideStepNumber}>
                            <Text style={styles.guideStepNumberText}>{index + 1}</Text>
                          </View>
                          <Text style={styles.guideStepText}>{localizedHelp(step, language)}</Text>
                        </View>
                      ))}
                      <View style={styles.tipCard}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={colors.lime} />
                        <Text style={styles.tipText}>{localizedHelp(helpTopic.tip, language)}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Pressable onPress={() => void resetTours()} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
            <View style={styles.resetCopy}>
              <Text style={styles.resetTitle}>
                {language === 'tr' ? 'İlk kullanım turlarını yeniden göster' : 'Show first-use tours again'}
              </Text>
              <Text style={styles.resetText}>
                {language === 'tr'
                  ? 'Ekranlardaki kısa rehberleri tekrar etkinleştirir.'
                  : 'Enables the short guides on each screen again.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = createThemedStyles(() => ({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    minHeight: 76,
    marginHorizontal: 14,
    marginTop: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 20,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
    gap: 16,
  },
  whatsNew: {
    padding: 17,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  whatsNewIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsNewCopy: { flex: 1 },
  whatsNewLabel: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 2,
  },
  whatsNewTitle: {
    marginTop: 4,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  whatsNewText: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 19,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  topicList: { gap: 10 },
  topicCard: {
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  topicCardExpanded: { borderColor: colors.borderStrong },
  topicHeader: {
    minHeight: 78,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topicIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicCopy: { flex: 1 },
  topicTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  topicSummary: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  topicDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 9,
  },
  guideStep: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  guideStepNumber: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumberText: {
    color: colors.black,
    fontFamily: fonts.extraBold,
    fontSize: 11,
  },
  guideStepText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  tipCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  tipText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
  },
  resetButton: {
    minHeight: 72,
    padding: 14,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetCopy: { flex: 1 },
  resetTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  resetText: {
    marginTop: 3,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
}));
