import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary, MapPin } from '@/types/cruiser';

type MapNodeDetailModalProps = {
  busy?: boolean;
  currentUserId?: string;
  onClose: () => void;
  onCancelTrip?: () => void;
  onJoin?: () => void;
  onLike?: () => void;
  onOpenDriver?: (driver: DriverSummary) => void;
  onRateMember?: (driver: DriverSummary, signal: 'harmony' | 'alert') => void;
  onRemoveMember?: (driver: DriverSummary) => void;
  onRespondRequest?: (driver: DriverSummary, decision: 'approved' | 'declined') => void;
  onSetRole?: (driver: DriverSummary, role: 'manager' | 'member') => void;
  pin: MapPin | null;
};

export function MapNodeMarker({
  pin,
  selected = false,
}: {
  pin: MapPin;
  selected?: boolean;
}) {
  const palette = getMapNodePalette(pin);
  return (
    <View
      style={[
        styles.markerHalo,
        { borderColor: palette.color },
        selected && styles.markerHaloSelected,
      ]}
    >
      <View style={[styles.marker, { backgroundColor: palette.color }]}>
        <Ionicons color={palette.iconColor} name={mapNodeIcon(pin)} size={17} />
      </View>
      <View style={[styles.markerTip, { backgroundColor: palette.color }]} />
    </View>
  );
}

export function MapNodeDetailModal({
  busy = false,
  currentUserId,
  onClose,
  onCancelTrip,
  onJoin,
  onLike,
  onOpenDriver,
  onRateMember,
  onRemoveMember,
  onRespondRequest,
  onSetRole,
  pin,
}: MapNodeDetailModalProps) {
  if (!pin) return null;
  const palette = getMapNodePalette(pin);
  const hostUserId = pin.hostUserId || pin.createdByUid || '';
  const capacity = Number(pin.capacity ?? 12);
  const approvedCount = Number(pin.approvedCount ?? 1);
  const minDriverScore = Number(pin.minDriverScore ?? 0);
  const canManage = ['host', 'manager'].includes(pin.viewerManagementRole ?? '');
  const isHost = pin.viewerManagementRole === 'host';
  const canRate = pin.lifecycleStatus === 'completed'
    && pin.viewerMembershipStatus === 'approved';

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Detayı kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <View style={[styles.detailIcon, { backgroundColor: palette.color }]}>
              <Ionicons color={palette.iconColor} name={mapNodeIcon(pin)} size={21} />
            </View>
            <View style={styles.titleCopy}>
              <Text numberOfLines={2} style={styles.title}>{pin.name}</Text>
              <Text style={[styles.type, { color: palette.color }]}>{mapNodeLabel(pin)}</Text>
            </View>
            <Pressable accessibilityLabel="Detayı kapat" onPress={onClose} style={styles.close}>
              <Ionicons color={colors.textMuted} name="close" size={21} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {pin.description || pin.route ? (
              <Text style={styles.description}>{pin.description || pin.route}</Text>
            ) : null}

            {pin.type === 'meet' ? (
              <>
                <View style={styles.metricGrid}>
                  <Metric
                    icon="time-outline"
                    label="Başlangıç"
                    value={pin.time || 'Belirtilmedi'}
                  />
                  <Metric
                    icon="people-outline"
                    label="Katılımcı"
                    value={`${approvedCount}/${capacity}`}
                  />
                  <Metric
                    icon="shield-checkmark-outline"
                    label="Güven sınırı"
                    value={`${minDriverScore}/100`}
                  />
                  <Metric
                    icon="map-outline"
                    label="Rota"
                    value={pin.eventMode === 'meetup'
                      ? 'Tek nokta'
                      : `${pin.routePath?.length ?? 0} durak`}
                  />
                  <Metric
                    icon="heart-outline"
                    label="Beğeni"
                    value={`${Number(pin.likes ?? 0)}`}
                  />
                  {pin.eventMode === 'convoy' ? (
                    <Metric
                      icon="navigate-circle-outline"
                      label="Sürüş durumu"
                      value={tripStatusLabel(pin.viewerTripStatus, pin.lifecycleStatus)}
                    />
                  ) : null}
                </View>

                {pin.backendCanViewDetails === false ? (
                  <View style={styles.locked}>
                    <Ionicons color={colors.amber} name="lock-closed" size={17} />
                    <Text style={styles.lockedText}>
                      Bu etkinliğin ayrıntıları güven puanı koşulu sağlandığında görünür.
                    </Text>
                  </View>
                ) : null}

                {canManage && pin.pendingRequests?.length ? (
                  <View style={styles.attendees}>
                    <Text style={styles.sectionLabel}>Bekleyen katılım istekleri</Text>
                    {pin.pendingRequests.map((driver) => (
                      <View key={driver.userId} style={styles.memberCard}>
                        <DriverHeader driver={driver} onOpenDriver={onOpenDriver} />
                        <View style={styles.actionRow}>
                          <SmallAction
                            disabled={busy}
                            icon="checkmark"
                            label="Kabul"
                            onPress={() => onRespondRequest?.(driver, 'approved')}
                            positive
                          />
                          <SmallAction
                            danger
                            disabled={busy}
                            icon="close"
                            label="Reddet"
                            onPress={() => onRespondRequest?.(driver, 'declined')}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {pin.attendees?.length ? (
                  <View style={styles.attendees}>
                    <Text style={styles.sectionLabel}>Katılımcılar</Text>
                    {pin.attendees.map((driver) => {
                      const isSelf = driver.userId === currentUserId;
                      const isTargetHost = driver.managementRole === 'host'
                        || driver.userId === pin.hostUserId;
                      const canRemove = canManage && !isSelf && !isTargetHost
                        && (isHost || driver.managementRole !== 'manager');
                      return (
                        <View key={driver.userId} style={styles.memberCard}>
                          <DriverHeader driver={driver} onOpenDriver={onOpenDriver} />
                          <View style={styles.memberStatusRow}>
                            <Text style={styles.tripBadge}>{tripStatusLabel(driver.tripStatus)}</Text>
                            <Text style={styles.roleBadge}>{roleLabel(driver.managementRole)}</Text>
                          </View>
                          {isHost && !isSelf && !isTargetHost ? (
                            <SmallAction
                              disabled={busy}
                              icon={driver.managementRole === 'manager' ? 'person-outline' : 'shield-outline'}
                              label={driver.managementRole === 'manager' ? 'Üye yap' : 'Yardımcı yap'}
                              onPress={() => onSetRole?.(
                                driver,
                                driver.managementRole === 'manager' ? 'member' : 'manager',
                              )}
                            />
                          ) : null}
                          {canRemove ? (
                            <SmallAction
                              danger
                              disabled={busy}
                              icon="person-remove-outline"
                              label="Konvoydan çıkar"
                              onPress={() => onRemoveMember?.(driver)}
                            />
                          ) : null}
                          {canRate && !isSelf ? (
                            <View style={styles.actionRow}>
                              <SmallAction
                                disabled={busy}
                                icon="thumbs-up-outline"
                                label="Uyumlu"
                                onPress={() => onRateMember?.(driver, 'harmony')}
                                positive
                              />
                              <SmallAction
                                danger
                                disabled={busy}
                                icon="warning-outline"
                                label="Sorunlu"
                                onPress={() => onRateMember?.(driver, 'alert')}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.metricGrid}>
                <Metric
                  icon={pin.type === 'spot' ? 'heart-outline' : 'star-outline'}
                  label={pin.type === 'spot' ? 'Beğeni' : 'Değerlendirme'}
                  value={pin.type === 'spot'
                    ? `${pin.likes ?? 0}`
                    : `${Number(pin.rating?.reviews ?? 0)} yorum`}
                />
                <Metric
                  icon={pin.type === 'spot' ? 'images-outline' : 'water-outline'}
                  label={pin.type === 'spot' ? 'Fotoğraf' : 'Su kalitesi'}
                  value={pin.type === 'spot'
                    ? `${pin.photoCount ?? 0}`
                    : `${Number(pin.rating?.water ?? 0).toFixed(1)}/5`}
                />
              </View>
            )}

            {hostUserId ? (
              <Pressable
                disabled={!onOpenDriver}
                onPress={() => onOpenDriver?.({
                  userId: hostUserId,
                  fullName: pin.createdByName,
                  plate: pin.createdByPlate,
                })}
                style={({ pressed }) => [styles.host, pressed && styles.pressed]}
              >
                <Ionicons color={colors.limeBright} name="person-outline" size={18} />
                <View style={styles.driverCopy}>
                  <Text style={styles.sectionLabel}>Oluşturan</Text>
                  <Text numberOfLines={1} style={styles.hostName}>
                    {pin.createdByName || pin.createdByPlate || 'TrackSnap sürücüsü'}
                  </Text>
                </View>
                <Ionicons color={colors.textFaint} name="chevron-forward" size={15} />
              </Pressable>
            ) : null}

            {(pin.type === 'meet' || pin.type === 'spot') && onLike ? (
              <Pressable
                disabled={busy}
                onPress={onLike}
                style={({ pressed }) => [
                  styles.like,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Ionicons color={colors.limeBright} name="heart-outline" size={18} />
                <Text style={styles.likeText}>Beğen {Number(pin.likes ?? 0)}</Text>
              </Pressable>
            ) : null}

            {pin.type === 'meet' && pin.backendCanJoin && onJoin ? (
              <Pressable
                disabled={busy}
                onPress={onJoin}
                style={({ pressed }) => [
                  styles.join,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Ionicons color={colors.black} name="person-add" size={18} />
                <Text style={styles.joinText}>{busy ? 'İşleniyor' : 'Etkinliğe Katıl'}</Text>
              </Pressable>
            ) : null}

            {pin.type === 'meet' && !pin.backendCanJoin && pin.backendAccessReason ? (
              <Text style={styles.accessMessage}>{friendlyAccessReason(pin)}</Text>
            ) : null}

            {pin.type === 'meet'
            && pin.eventMode === 'convoy'
            && pin.viewerMembershipStatus === 'approved'
            && !['completed', 'cancelled'].includes(pin.lifecycleStatus ?? '')
            && pin.viewerTripStatus !== 'cancelled'
            && onCancelTrip ? (
              <Pressable
                disabled={busy}
                onPress={onCancelTrip}
                style={({ pressed }) => [styles.cancelTrip, pressed && styles.pressed]}
              >
                <Ionicons color={colors.rose} name="exit-outline" size={17} />
                <Text style={styles.cancelTripText}>Konvoy sürüşünden ayrıl</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DriverHeader({
  driver,
  onOpenDriver,
}: {
  driver: DriverSummary;
  onOpenDriver?: (driver: DriverSummary) => void;
}) {
  return (
    <Pressable
      disabled={!driver.userId || !onOpenDriver}
      onPress={() => onOpenDriver?.(driver)}
      style={({ pressed }) => [styles.driver, pressed && styles.pressed]}
    >
      <Ionicons color={colors.limeBright} name="person-circle-outline" size={24} />
      <View style={styles.driverCopy}>
        <Text numberOfLines={1} style={styles.driverName}>
          {driver.fullName || driver.plate || 'Sürücü'}
        </Text>
        <Text numberOfLines={1} style={styles.driverMeta}>
          {driver.model || 'Katılımcı'}
        </Text>
      </View>
      <Ionicons color={colors.textFaint} name="chevron-forward" size={15} />
    </Pressable>
  );
}

function SmallAction({
  danger = false,
  disabled = false,
  icon,
  label,
  onPress,
  positive = false,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  positive?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallAction,
        positive && styles.smallActionPositive,
        danger && styles.smallActionDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        color={danger ? colors.rose : positive ? colors.limeBright : colors.textMuted}
        name={icon}
        size={15}
      />
      <Text style={[styles.smallActionText, danger && styles.smallActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function tripStatusLabel(tripStatus?: string, lifecycleStatus?: string) {
  if (lifecycleStatus === 'completed') return 'Tamamlandı';
  if (lifecycleStatus === 'cancelled' || tripStatus === 'cancelled') return 'İptal';
  if (tripStatus === 'arrived') return 'Ulaştı';
  if (tripStatus === 'enroute') return 'Yolda';
  return 'Hazır';
}

function roleLabel(role?: string) {
  if (role === 'host') return 'Kurucu';
  if (role === 'manager') return 'Yardımcı';
  return 'Katılımcı';
}

export function mapNodeIcon(pin: MapPin): keyof typeof Ionicons.glyphMap {
  if (pin.type === 'spot') return 'camera';
  if (pin.type === 'wash') return 'water';
  return pin.eventMode === 'meetup' ? 'people' : 'navigate';
}

export function mapNodeLabel(pin: MapPin) {
  if (pin.type === 'spot') return 'Fotoğraf noktası';
  if (pin.type === 'wash') return 'Yıkama istasyonu';
  return pin.eventMode === 'meetup' ? 'Buluşma' : 'Konvoy';
}

export function getMapNodePalette(pin: MapPin) {
  if (pin.type === 'wash') return { color: '#38bdf8', iconColor: colors.black };
  if (pin.type === 'meet' && pin.eventMode === 'meetup') {
    return { color: colors.amber, iconColor: colors.black };
  }
  if (pin.type === 'meet') return { color: colors.rose, iconColor: colors.white };
  return { color: colors.lime, iconColor: colors.black };
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons color={colors.textFaint} name={icon} size={16} />
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function friendlyAccessReason(pin: MapPin) {
  const reason = String(pin.backendAccessReason || '').toLowerCase();
  if (reason.includes('trust') || reason.includes('score')) {
    return `Katılım için en az ${Number(pin.minDriverScore ?? 0)}/100 güven puanı gerekir.`;
  }
  if (reason.includes('pending')) return 'Katılım isteğiniz onay bekliyor.';
  if (reason.includes('full')) return 'Etkinlik kontenjanı dolu.';
  if (reason.includes('joined')) return 'Bu etkinliğe zaten katıldınız.';
  return 'Bu etkinlik şu anda yeni katılımcı kabul etmiyor.';
}

const styles = createThemedStyles(() => ({
  markerHalo: {
    width: 44,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  markerHaloSelected: {
    transform: [{ scale: 1.12 }],
    borderWidth: 2,
  },
  marker: {
    width: 33,
    height: 33,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTip: {
    position: 'absolute',
    bottom: -3,
    width: 9,
    height: 9,
    transform: [{ rotate: '45deg' }],
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    maxHeight: '72%',
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundRaised,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: { flex: 1 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 21 },
  type: {
    marginTop: 2,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingTop: 15, paddingBottom: 12 },
  description: {
    marginBottom: 13,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    width: '48.5%',
    minHeight: 66,
    padding: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metricCopy: { flex: 1 },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 4,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
  },
  locked: {
    marginTop: 12,
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
    backgroundColor: 'rgba(251,191,36,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  lockedText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },
  attendees: { marginTop: 14, gap: 7 },
  memberCard: {
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    gap: 7,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  driver: {
    minHeight: 50,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  driverCopy: { flex: 1 },
  driverName: { color: colors.text, fontFamily: fonts.bold, fontSize: 10 },
  driverMeta: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  memberStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tripBadge: {
    color: colors.limeBright,
    fontFamily: fonts.bold,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  roleBadge: {
    color: colors.textFaint,
    fontFamily: fonts.semibold,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  actionRow: { flexDirection: 'row', gap: 7 },
  smallAction: {
    minHeight: 40,
    flex: 1,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  smallActionPositive: { borderColor: 'rgba(163,230,53,0.3)' },
  smallActionDanger: { borderColor: 'rgba(244,63,94,0.3)' },
  smallActionText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9 },
  smallActionTextDanger: { color: colors.rose },
  host: {
    minHeight: 58,
    marginTop: 13,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostName: { marginTop: 3, color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  like: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(163,230,53,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  likeText: { color: colors.limeBright, fontFamily: fonts.bold, fontSize: 12 },
  join: {
    minHeight: 52,
    marginTop: 14,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  joinText: { color: colors.black, fontFamily: fonts.bold, fontSize: 13 },
  accessMessage: {
    marginTop: 12,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  cancelTrip: {
    minHeight: 46,
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  cancelTripText: { color: colors.rose, fontFamily: fonts.bold, fontSize: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
}));
