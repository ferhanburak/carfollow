import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
  localizedAlert,
} from '@/components/localized-text';
import { useAppLanguage } from '@/providers/language-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

export type MonthlyRecapData = {
  averageSpeedKmh: number;
  communityKudos: number;
  driverScore: number;
  driveSeconds: number;
  fullName: string;
  helpfulVotes: number;
  likesReceived: number;
  maxSpeedKmh: number;
  model: string;
  monthDate?: number;
  monthlyKm: number;
  nightKm: number;
};

type Props = {
  data: MonthlyRecapData;
  onClose: () => void;
  visible: boolean;
};

const CARD_COUNT = 4;

export function MonthlyRecapModal({ data, onClose, visible }: Props) {
  const insets = useSafeAreaInsets();
  const { language } = useAppLanguage();
  const cardRef = useRef<View>(null);
  const [page, setPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const copy = language === 'en' ? EN : TR;
  const month = useMemo(() => new Date(data.monthDate ?? openedAt).toLocaleDateString(
    language === 'en' ? 'en-US' : 'tr-TR',
    { month: 'long', year: 'numeric' },
  ), [data.monthDate, language, openedAt]);

  const close = () => {
    setPage(0);
    onClose();
  };

  const changePage = (next: number) => {
    void Haptics.selectionAsync();
    setPage(Math.max(0, Math.min(CARD_COUNT - 1, next)));
  };

  const share = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      if (!await Sharing.isAvailableAsync()) {
        localizedAlert('Paylaşım kullanılamıyor', 'Bu cihazda sistem paylaşım menüsü açılamadı.');
        return;
      }
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        dialogTitle: copy.shareTitle,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      localizedAlert('Paylaşım başarısız', 'Aylık özet kartı oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={close} visible={visible}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable accessibilityLabel={copy.close} onPress={close} style={styles.iconButton}>
            <Ionicons color={colors.text} name="close" size={23} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{copy.title}</Text>
            <Text style={styles.headerMeta}>{month}</Text>
          </View>
          <View style={styles.pageBadge}>
            <Text style={styles.pageBadgeText}>{page + 1}/{CARD_COUNT}</Text>
          </View>
        </View>

        <View style={styles.stage}>
          <View ref={cardRef} collapsable={false} style={styles.captureFrame}>
            <RecapCard copy={copy} data={data} month={month} page={page} />
          </View>

          <View style={styles.dots}>
            {Array.from({ length: CARD_COUNT }, (_, index) => (
              <Pressable
                accessibilityLabel={`${index + 1}`}
                key={index}
                onPress={() => changePage(index)}
                style={[styles.dot, index === page && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable
            disabled={page === 0}
            onPress={() => changePage(page - 1)}
            style={[styles.navButton, page === 0 && styles.disabled]}
          >
            <Ionicons color={colors.text} name="arrow-back" size={21} />
          </Pressable>
          <Pressable
            disabled={sharing}
            onPress={() => void share()}
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          >
            {sharing ? (
              <ActivityIndicator color="#050605" size="small" />
            ) : (
              <Ionicons color="#050605" name="share-social" size={20} />
            )}
            <Text style={styles.shareButtonText}>{copy.share}</Text>
          </Pressable>
          <Pressable
            disabled={page === CARD_COUNT - 1}
            onPress={() => changePage(page + 1)}
            style={[styles.navButton, page === CARD_COUNT - 1 && styles.disabled]}
          >
            <Ionicons color={colors.text} name="arrow-forward" size={21} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RecapCard({ copy, data, month, page }: {
  copy: RecapCopy;
  data: MonthlyRecapData;
  month: string;
  page: number;
}) {
  const nightRatio = data.monthlyKm > 0
    ? Math.min(100, Math.round((data.nightKm / data.monthlyKm) * 100))
    : 0;
  const palette = CARD_PALETTES[page];

  return (
    <LinearGradient colors={palette.gradient} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={[styles.orbit, styles.orbitOne, { borderColor: palette.line }]} />
      <View style={[styles.orbit, styles.orbitTwo, { borderColor: palette.line }]} />
      <View style={styles.cardTop}>
        <Text style={[styles.brand, { color: palette.accent }]}>TRACKSNAP</Text>
        <Text style={styles.month}>{month.toLocaleUpperCase()}</Text>
      </View>

      {page === 0 ? (
        <View style={styles.storyBody}>
          <Text style={styles.kicker}>{copy.roadMonth}</Text>
          <Text style={[styles.heroNumber, { color: palette.accent }]}>
            {formatNumber(data.monthlyKm)}
          </Text>
          <Text style={styles.heroUnit}>KM</Text>
          <Text style={styles.statement}>{copy.distanceStatement}</Text>
          <View style={styles.identityLine}>
            <Text numberOfLines={1} style={styles.identity}>{data.fullName}</Text>
            <Text numberOfLines={1} style={styles.vehicle}>{data.model}</Text>
          </View>
        </View>
      ) : null}

      {page === 1 ? (
        <View style={styles.storyBody}>
          <Ionicons color={palette.accent} name="speedometer" size={44} />
          <Text style={styles.storyTitle}>{copy.tempoTitle}</Text>
          <View style={styles.metricStack}>
            <StoryMetric accent={palette.accent} label={copy.driveTime} value={formatDuration(data.driveSeconds, copy)} />
            <StoryMetric accent={palette.accent} label={copy.averageSpeed} value={`${formatNumber(data.averageSpeedKmh)} KM/H`} />
            <StoryMetric accent={palette.accent} label={copy.maxSpeed} value={`${formatNumber(data.maxSpeedKmh)} KM/H`} />
          </View>
        </View>
      ) : null}

      {page === 2 ? (
        <View style={styles.storyBody}>
          <Ionicons color={palette.accent} name="moon" size={42} />
          <Text style={styles.storyTitle}>{copy.nightTitle}</Text>
          <Text style={[styles.heroNumberSmall, { color: palette.accent }]}>{formatNumber(data.nightKm)}</Text>
          <Text style={styles.heroUnit}>KM</Text>
          <Text style={styles.statement}>
            {copy.nightStatement.replace('{ratio}', String(nightRatio))}
          </Text>
          <View style={styles.ratioTrack}>
            <View style={[styles.ratioFill, { backgroundColor: palette.accent, width: `${nightRatio}%` }]} />
          </View>
        </View>
      ) : null}

      {page === 3 ? (
        <View style={styles.storyBody}>
          <Ionicons color={palette.accent} name="people" size={44} />
          <Text style={styles.storyTitle}>{copy.communityTitle}</Text>
          <View style={styles.communityGrid}>
            <StoryMetric accent={palette.accent} compact label={copy.likes} value={formatNumber(data.likesReceived)} />
            <StoryMetric accent={palette.accent} compact label={copy.helpful} value={formatNumber(data.helpfulVotes)} />
            <StoryMetric accent={palette.accent} compact label={copy.kudos} value={formatNumber(data.communityKudos)} />
            <StoryMetric accent={palette.accent} compact label={copy.score} value={`${Math.round(data.driverScore)}/100`} />
          </View>
          <Text style={styles.statement}>{copy.communityStatement}</Text>
        </View>
      ) : null}

      <View style={styles.cardBottom}>
        <Text style={styles.cardIndex}>0{page + 1} / 0{CARD_COUNT}</Text>
        <Text style={[styles.hashTag, { color: palette.accent }]}>#TrackSnapWrapped</Text>
      </View>
    </LinearGradient>
  );
}

function StoryMetric({ accent, compact = false, label, value }: {
  accent: string;
  compact?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.storyMetric, compact && styles.storyMetricCompact]}>
      <Text style={styles.storyMetricLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.storyMetricValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function formatNumber(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatDuration(seconds: number, copy: RecapCopy) {
  const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} ${copy.hour} ${minutes} ${copy.minute}` : `${minutes} ${copy.minute}`;
}

const TR = {
  title: 'Aylık Özet',
  close: 'Aylık özeti kapat',
  share: 'Kartı Paylaş',
  shareTitle: 'TrackSnap aylık özetini paylaş',
  roadMonth: 'BU AY YOLLAR SENİNDİ',
  distanceStatement: 'Her kilometre bu ayın hikâyesine eklendi.',
  tempoTitle: 'Sürüş Tempon',
  driveTime: 'Sürüş süresi',
  averageSpeed: 'Ortalama hız',
  maxSpeed: 'Maksimum hız',
  nightTitle: 'Gece Rotası',
  nightStatement: 'Aylık mesafenin %{ratio} kadarı gece sürüşlerinden geldi.',
  communityTitle: 'Yoldaki Etkin',
  likes: 'Alınan beğeni',
  helpful: 'Faydalı oy',
  kudos: 'Topluluk puanı',
  score: 'Sürücü skoru',
  communityStatement: 'Yol sadece gidilen mesafe değil, bıraktığın etkidir.',
  hour: 'SA',
  minute: 'DK',
} as const;

type RecapCopy = Record<keyof typeof TR, string>;

const EN: RecapCopy = {
  title: 'Monthly Recap',
  close: 'Close monthly recap',
  share: 'Share Card',
  shareTitle: 'Share TrackSnap monthly recap',
  roadMonth: 'YOU OWNED THE ROAD',
  distanceStatement: 'Every kilometer became part of this month’s story.',
  tempoTitle: 'Your Driving Tempo',
  driveTime: 'Drive time',
  averageSpeed: 'Average speed',
  maxSpeed: 'Maximum speed',
  nightTitle: 'After Dark',
  nightStatement: '%{ratio} of your monthly distance happened after dark.',
  communityTitle: 'Your Road Impact',
  likes: 'Likes received',
  helpful: 'Helpful votes',
  kudos: 'Community score',
  score: 'Driver score',
  communityStatement: 'The road is not only distance, but the impact you leave behind.',
  hour: 'HR',
  minute: 'MIN',
};

const CARD_PALETTES = [
  { gradient: ['#081000', '#172b05', '#050605'] as const, accent: '#b7ff1f', line: 'rgba(183,255,31,0.18)' },
  { gradient: ['#170305', '#56111e', '#090506'] as const, accent: '#ff4d6d', line: 'rgba(255,77,109,0.20)' },
  { gradient: ['#050714', '#111a47', '#070913'] as const, accent: '#8ba9ff', line: 'rgba(139,169,255,0.18)' },
  { gradient: ['#171006', '#4a2e05', '#090704'] as const, accent: '#ffc832', line: 'rgba(255,200,50,0.18)' },
] as const;

const styles = createThemedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17 },
  headerMeta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  pageBadge: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBadgeText: { color: colors.lime, fontFamily: fonts.extraBold, fontSize: 10 },
  stage: { flex: 1, padding: 14, alignItems: 'center', justifyContent: 'center' },
  captureFrame: { width: '100%', maxWidth: 430 },
  card: {
    width: '100%',
    aspectRatio: 0.69,
    maxHeight: 570,
    padding: 22,
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    justifyContent: 'space-between',
  },
  orbit: { position: 'absolute', borderWidth: 1, borderRadius: 999 },
  orbitOne: { width: 330, height: 330, right: -180, top: -90 },
  orbitTwo: { width: 260, height: 260, left: -165, bottom: -55 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 3.2 },
  month: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.3 },
  storyBody: { flex: 1, paddingVertical: 24, justifyContent: 'center' },
  kicker: { color: '#ffffff', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2.2 },
  heroNumber: { marginTop: 18, fontFamily: fonts.extraBold, fontSize: 76, lineHeight: 82 },
  heroNumberSmall: { marginTop: 17, fontFamily: fonts.extraBold, fontSize: 65, lineHeight: 72 },
  heroUnit: { color: '#ffffff', fontFamily: fonts.extraBold, fontSize: 21, letterSpacing: 4 },
  storyTitle: { marginTop: 17, color: '#ffffff', fontFamily: fonts.extraBold, fontSize: 27, lineHeight: 33 },
  statement: { marginTop: 18, maxWidth: 290, color: 'rgba(255,255,255,0.72)', fontFamily: fonts.semibold, fontSize: 12, lineHeight: 19 },
  identityLine: { marginTop: 25, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  identity: { color: '#ffffff', fontFamily: fonts.extraBold, fontSize: 14 },
  vehicle: { marginTop: 4, color: 'rgba(255,255,255,0.58)', fontFamily: fonts.regular, fontSize: 10 },
  metricStack: { marginTop: 20, gap: 8 },
  storyMetric: { minHeight: 63, padding: 12, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.24)' },
  storyMetricCompact: { width: '48%', minHeight: 72 },
  storyMetricLabel: { color: 'rgba(255,255,255,0.56)', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase' },
  storyMetricValue: { marginTop: 6, fontFamily: fonts.extraBold, fontSize: 17 },
  ratioTrack: { height: 8, marginTop: 19, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  ratioFill: { height: '100%', borderRadius: 999 },
  communityGrid: { marginTop: 21, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardIndex: { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.2 },
  hashTag: { fontFamily: fonts.extraBold, fontSize: 9 },
  dots: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 22, height: 5, borderRadius: 999, backgroundColor: colors.border },
  dotActive: { width: 38, backgroundColor: colors.lime },
  footer: { paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', gap: 9, alignItems: 'center' },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: { color: '#050605', fontFamily: fonts.extraBold, fontSize: 11 },
  disabled: { opacity: 0.32 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
}));
