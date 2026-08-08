import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalizedPressable as Pressable, LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';
import { getRuntimeLocale } from '@/i18n/language-runtime';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary } from '@/types/cruiser';

export type ProfileFriendshipState = 'none' | 'incoming' | 'outgoing' | 'accepted' | 'blocked' | 'self';

type PublicDriverProfileModalProps = {
  busy?: boolean;
  canInviteClan?: boolean;
  canInviteConvoy?: boolean;
  clanInviteSent?: boolean;
  error?: string;
  friendshipState: ProfileFriendshipState;
  loading?: boolean;
  onAcceptFriend?: () => void | Promise<unknown>;
  onBlock?: () => void | Promise<unknown>;
  onCancelFriend?: () => void | Promise<unknown>;
  onClose: () => void;
  onInviteClan?: () => void | Promise<unknown>;
  onInviteConvoy?: () => void;
  onMessage?: () => void | Promise<unknown>;
  onRejectFriend?: () => void | Promise<unknown>;
  onRemoveFriend?: () => void | Promise<unknown>;
  onReport?: (reason: string, details: string) => Promise<unknown>;
  onRequestFriend?: () => void | Promise<unknown>;
  onUnblock?: () => void | Promise<unknown>;
  onViewProfile?: () => void;
  profile: DriverSummary | null;
  visible: boolean;
};

const reportReasons = [
  { value: 'dangerous-driving', label: 'Tehlikeli sürüş' },
  { value: 'harassment', label: 'Taciz' },
  { value: 'spam', label: 'Spam' },
  { value: 'false-information', label: 'Yanlış bilgi' },
  { value: 'inappropriate-content', label: 'Uygunsuz içerik' },
  { value: 'other', label: 'Diğer' },
];

export function PublicDriverProfileModal({
  busy = false,
  canInviteClan = false,
  canInviteConvoy = false,
  clanInviteSent = false,
  error = '',
  friendshipState,
  loading = false,
  onAcceptFriend,
  onBlock,
  onCancelFriend,
  onClose,
  onInviteClan,
  onInviteConvoy,
  onMessage,
  onRejectFriend,
  onRemoveFriend,
  onReport,
  onRequestFriend,
  onUnblock,
  onViewProfile,
  profile,
  visible,
}: PublicDriverProfileModalProps) {
  const insets = useSafeAreaInsets();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(reportReasons[0].value);
  const [reportDetails, setReportDetails] = useState('');
  const [localPending, setLocalPending] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const harmonyVotes = Number(profile?.harmonyVotes ?? 0);
  const alertVotes = Number(profile?.alertVotes ?? 0);
  const totalVotes = harmonyVotes + alertVotes;
  const harmonyRatio = totalVotes ? clampPercent((harmonyVotes / totalVotes) * 100) : 100;
  const score = Number(profile?.driverScore ?? profile?.score ?? 0);
  const reputation = resolveReputation(score, harmonyVotes, alertVotes);
  const pending = busy || Boolean(localPending);

  const closeModal = () => {
    setReportOpen(false);
    setReportDetails('');
    setReportSent(false);
    setLocalPending('');
    onClose();
  };

  const execute = async (key: string, action?: () => void | Promise<unknown>) => {
    if (!action || pending) return;
    setLocalPending(key);
    try {
      await action();
    } catch {
      // The data hook exposes the localized Firebase error inside the modal.
    } finally {
      setLocalPending('');
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeModal}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {profile?.fullName || profile?.plate || 'Sürücü Profili'}
            </Text>
            <Text style={styles.headerMeta}>Sürücü Profili</Text>
          </View>
          <Pressable
            accessibilityLabel="Sürücü profilini kapat"
            onPress={closeModal}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>

        {loading && !profile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.lime} size="large" />
            <Text style={styles.loadingText}>Sürücü profili yükleniyor...</Text>
          </View>
        ) : profile ? (
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom + 18, 28) },
            ]}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              accessibilityLabel="Tam sürücü profilini aç"
              onPress={onViewProfile}
              style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
            >
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(profile.fullName || profile.model || 'T').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.identityCopy}>
                  <Text numberOfLines={1} style={styles.identityName}>
                    {profile.fullName || 'TrackSnap Sürücüsü'}
                  </Text>
                  <Text numberOfLines={1} style={styles.model}>{profile.model || 'Araç bilgisi yok'}</Text>
                  <Text numberOfLines={1} style={styles.region}>
                    {[profile.plate || profile.plateMasked, profile.region].filter(Boolean).join(' · ') || 'Profil bilgileri'}
                  </Text>
                </View>
                <View style={styles.relationPill}>
                  <View style={[styles.statusDot, statusDotStyle(friendshipState)]} />
                  <Text style={styles.relationText}>{friendshipLabel(friendshipState)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <Text style={styles.viewProfileHint}>Profili incelemek için dokun</Text>
            </Pressable>

            <View style={styles.metrics}>
              <Metric label="Sürücü Skoru" value={`${score}/100`} />
              <Metric
                label="Aylık KM"
                value={`${Number(profile.monthlyKm ?? 0).toLocaleString(getRuntimeLocale(), {
                  maximumFractionDigits: 1,
                })} KM`}
              />
              <Metric label="Uyum Oranı" value={`%${harmonyRatio}`} />
            </View>

            <View style={[styles.reputation, reputation.tone === 'alert' && styles.reputationAlert]}>
              <View style={styles.reputationRow}>
                <Text style={styles.reputationTitle}>{reputation.label}</Text>
                <Text style={styles.reputationRelation}>{profile.relation || friendshipLabel(friendshipState)}</Text>
              </View>
              <Text style={styles.reputationCopy}>{reputation.description}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              {friendshipState === 'none' ? (
                <ProfileAction
                  icon="person-add"
                  label="Arkadaş Ekle"
                  onPress={() => execute('friend', onRequestFriend)}
                  primary
                />
              ) : null}
              {friendshipState === 'incoming' ? (
                <>
                  <ProfileAction
                    icon="checkmark"
                    label="İsteği Kabul Et"
                    onPress={() => execute('accept', onAcceptFriend)}
                    primary
                  />
                  <ProfileAction
                    icon="close"
                    label="İsteği Reddet"
                    onPress={() => execute('reject', onRejectFriend)}
                  />
                </>
              ) : null}
              {friendshipState === 'outgoing' ? (
                <ProfileAction
                  icon="arrow-undo"
                  label="İsteği Geri Çek"
                  onPress={() => execute('cancel', onCancelFriend)}
                />
              ) : null}
              {friendshipState === 'accepted' ? (
                <>
                  <ProfileAction icon="checkmark-done" label="Zaten Arkadaş" disabled primary />
                  <ProfileAction
                    icon="chatbubble"
                    label="Mesaj Gönder"
                    onPress={() => execute('message', onMessage)}
                  />
                </>
              ) : null}
              {canInviteClan && !['blocked', 'self'].includes(friendshipState) ? (
                <ProfileAction
                  disabled={clanInviteSent}
                  icon={clanInviteSent ? 'checkmark-done' : 'shield'}
                  label={clanInviteSent ? 'Davet Gönderildi' : 'Klana Davet'}
                  limeOutline
                  onPress={() => execute('clan', onInviteClan)}
                />
              ) : null}
              {canInviteConvoy && !['blocked', 'self'].includes(friendshipState) ? (
                <ProfileAction
                  icon="navigate"
                  label="Konvoya Davet"
                  onPress={onInviteConvoy}
                  rose
                />
              ) : null}
              {friendshipState === 'accepted' ? (
                <ProfileAction
                  icon="person-remove"
                  label="Arkadaşlıktan Çıkar"
                  onPress={() => execute('remove', onRemoveFriend)}
                />
              ) : null}
              {friendshipState === 'blocked' ? (
                <ProfileAction
                  icon="lock-open"
                  label="Engeli Kaldır"
                  onPress={() => execute('unblock', onUnblock)}
                />
              ) : friendshipState !== 'self' ? (
                <ProfileAction
                  icon="ban"
                  label="Sürücüyü Engelle"
                  onPress={() => execute('block', onBlock)}
                  rose
                />
              ) : null}
            </View>

            {friendshipState !== 'self' ? (
              <View style={styles.reportCard}>
                <Pressable
                  accessibilityLabel="Sürücüyü raporla"
                  onPress={() => {
                    setReportSent(false);
                    setReportOpen((current) => !current);
                  }}
                  style={({ pressed }) => [styles.reportToggle, pressed && styles.pressed]}
                >
                  <Ionicons name="flag-outline" size={17} color="#fda4af" />
                  <Text style={styles.reportToggleText}>
                    {reportOpen ? 'Rapor Formunu Kapat' : 'Sürücüyü Raporla'}
                  </Text>
                </Pressable>
                {reportOpen ? (
                  <View style={styles.reportForm}>
                    <View style={styles.reasonGrid}>
                      {reportReasons.map((reason) => (
                        <Pressable
                          key={reason.value}
                          onPress={() => setReportReason(reason.value)}
                          style={[
                            styles.reasonChip,
                            reportReason === reason.value && styles.reasonChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.reasonText,
                              reportReason === reason.value && styles.reasonTextActive,
                            ]}
                          >
                            {reason.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      maxLength={500}
                      multiline
                      onChangeText={setReportDetails}
                      placeholder="İncelemeye yardımcı olacak kısa bir açıklama..."
                      placeholderTextColor={colors.textFaint}
                      style={styles.reportInput}
                      value={reportDetails}
                    />
                    <Pressable
                      disabled={!onReport || pending}
                      onPress={() => execute('report', async () => {
                        await onReport?.(reportReason, reportDetails);
                        setReportDetails('');
                        setReportOpen(false);
                        setReportSent(true);
                      })}
                      style={({ pressed }) => [
                        styles.reportSubmit,
                        (!onReport || pending) && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      {localPending === 'report'
                        ? <ActivityIndicator color={colors.white} />
                        : <Ionicons name="send" size={17} color={colors.white} />}
                      <Text style={styles.reportSubmitText}>Güvenlik Ekibine Gönder</Text>
                    </Pressable>
                  </View>
                ) : null}
                {reportSent ? <Text style={styles.reportSent}>Raporunuz incelemeye gönderildi.</Text> : null}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.loading}>
            <Ionicons name="person-circle-outline" size={44} color={colors.textFaint} />
            <Text style={styles.loadingText}>Bu sürücünün profiline erişilemiyor.</Text>
          </View>
        )}

        {pending ? (
          <View style={styles.pending}>
            <ActivityIndicator color={colors.black} size="small" />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ProfileAction({
  disabled = false,
  icon,
  label,
  limeOutline = false,
  onPress,
  primary = false,
  rose = false,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  limeOutline?: boolean;
  onPress?: () => void;
  primary?: boolean;
  rose?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        limeOutline && styles.actionLime,
        rose && styles.actionRose,
        (disabled || !onPress) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={17}
        color={primary ? colors.black : rose ? '#fda4af' : limeOutline ? colors.limeBright : colors.text}
      />
      <Text
        numberOfLines={2}
        style={[
          styles.actionText,
          primary && styles.actionTextPrimary,
          rose && styles.actionTextRose,
          limeOutline && styles.actionTextLime,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveReputation(score: number, harmonyVotes: number, alertVotes: number) {
  if (score >= 90 && alertVotes <= 1) {
    return {
      label: 'Convoy Elite',
      description: 'Yüksek skor ve temiz uyum kaydı.',
      tone: 'safe',
    };
  }
  if (score >= 75 && harmonyVotes >= alertVotes) {
    return {
      label: 'Road Friendly',
      description: 'Konvoy için güvenli ve uyumlu görünüyor.',
      tone: 'safe',
    };
  }
  return {
    label: 'Watchlist',
    description: 'Davet öncesi davranış geçmişi tekrar kontrol edilmeli.',
    tone: 'alert',
  };
}

function friendshipLabel(state: ProfileFriendshipState) {
  const labels: Record<ProfileFriendshipState, string> = {
    none: 'yabancı',
    incoming: 'istek geldi',
    outgoing: 'istek gitti',
    accepted: 'arkadaş',
    blocked: 'engelli',
    self: 'sen',
  };
  return labels[state];
}

function statusDotStyle(state: ProfileFriendshipState) {
  if (state === 'accepted') return styles.statusFriend;
  if (state === 'blocked') return styles.statusBlocked;
  if (state === 'incoming' || state === 'outgoing') return styles.statusPending;
  return styles.statusNeutral;
}

const styles = createThemedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 19 },
  headerMeta: {
    marginTop: 2,
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  closeButton: {
    minWidth: 68,
    minHeight: 48,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  content: { padding: 15, gap: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  hero: {
    padding: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 18 },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 15 },
  model: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10 },
  region: { marginTop: 3, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 9 },
  viewProfileHint: {
    marginTop: 12,
    color: colors.limeBright,
    fontFamily: fonts.bold,
    fontSize: 9,
    textAlign: 'center',
  },
  relationPill: {
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusFriend: { backgroundColor: colors.lime },
  statusBlocked: { backgroundColor: colors.rose },
  statusPending: { backgroundColor: colors.amber },
  statusNeutral: { backgroundColor: colors.textFaint },
  relationText: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  reputation: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  reputationAlert: {
    borderColor: 'rgba(244,63,94,0.28)',
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  reputationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  reputationTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  reputationRelation: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  reputationCopy: { marginTop: 7, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    flex: 1,
    minWidth: 96,
    minHeight: 68,
    padding: 11,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metricValue: { marginTop: 9, color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 13 },
  error: {
    padding: 12,
    borderRadius: 14,
    color: '#fda4af',
    backgroundColor: 'rgba(244,63,94,0.08)',
    fontFamily: fonts.semibold,
    fontSize: 10,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: {
    width: '48.5%',
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionPrimary: { borderColor: colors.lime, backgroundColor: colors.lime },
  actionLime: { borderColor: 'rgba(163,230,53,0.35)', backgroundColor: 'rgba(163,230,53,0.08)' },
  actionRose: { borderColor: 'rgba(244,63,94,0.32)', backgroundColor: 'rgba(244,63,94,0.10)' },
  actionText: { color: colors.text, fontFamily: fonts.bold, fontSize: 9, textAlign: 'center' },
  actionTextPrimary: { color: colors.black },
  actionTextLime: { color: colors.limeBright },
  actionTextRose: { color: '#fda4af' },
  reportCard: {
    padding: 15,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.22)',
    backgroundColor: 'rgba(244,63,94,0.045)',
  },
  reportToggle: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportToggleText: { color: '#fda4af', fontFamily: fonts.bold, fontSize: 10 },
  reportForm: { marginTop: 13, gap: 12 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reasonChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  reasonChipActive: { borderColor: 'rgba(244,63,94,0.48)', backgroundColor: 'rgba(244,63,94,0.13)' },
  reasonText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 8 },
  reasonTextActive: { color: '#fda4af' },
  reportInput: {
    minHeight: 94,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlignVertical: 'top',
  },
  reportSubmit: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: colors.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportSubmitText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 10 },
  reportSent: {
    marginTop: 12,
    color: colors.limeBright,
    fontFamily: fonts.semibold,
    fontSize: 9,
    textAlign: 'center',
  },
  pending: {
    position: 'absolute',
    right: 17,
    bottom: 17,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
}));
