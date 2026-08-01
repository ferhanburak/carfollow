import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';

import {
  mapNodeIcon,
  mapNodeLabel,
} from '@/components/map-node-ui';
import { ScreenShell, Surface } from '@/components/screen-shell';
import { useMapWorld } from '@/hooks/use-map-world';
import { useAuth } from '@/providers/auth-provider';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary, MapPin } from '@/types/cruiser';

const ANKARA: Region = {
  latitude: 39.9334,
  longitude: 32.8597,
  latitudeDelta: 0.24,
  longitudeDelta: 0.18,
};

const mapProvider =
  Platform.OS === 'android' || process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY
    ? PROVIDER_GOOGLE
    : undefined;

type EditorType = 'spot' | 'wash' | 'meetup' | 'convoy';
type EventFilter = 'all' | EditorType;
type Point = { latitude: number; longitude: number };

const nodeOptions: { value: EditorType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'meetup', label: 'Buluşma', icon: 'people' },
  { value: 'convoy', label: 'Konvoy', icon: 'navigate' },
  { value: 'spot', label: 'Fotoğraf', icon: 'camera' },
  { value: 'wash', label: 'Yıkama', icon: 'water' },
];

const eventFilters: { value: EventFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  ...nodeOptions.map(({ value, label }) => ({ value, label })),
];

export default function MapScreen() {
  const { resolvedTheme } = useAppTheme();
  const { profile } = useAuth();
  const { mapWorld: world, openDriverProfile } = useDriverProfile();
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState<EditorType>('meetup');
  const [points, setPoints] = useState<Point[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minDriverScore, setMinDriverScore] = useState('70');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const selectMapPoint = (event: MapPressEvent) => {
    if (!editorOpen) return;
    const next = event.nativeEvent.coordinate;
    setPoints((current) => {
      if (editorType === 'convoy') return [...current, next].slice(-8);
      return [next];
    });
    setFormError('');
  };

  const openEditor = () => {
    setSelected(null);
    setPoints([]);
    setName('');
    setDescription('');
    setMinDriverScore('70');
    setFormError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setPoints([]);
    setFormError('');
  };

  const saveNode = async () => {
    const minimumPoints = editorType === 'convoy' ? 2 : 1;
    const trustScore = Number(minDriverScore);
    if (!name.trim() || points.length < minimumPoints) {
      setFormError(editorType === 'convoy'
        ? 'Adı doldurun ve haritadan en az iki rota noktası seçin.'
        : 'Adı doldurun ve haritadan bir konum seçin.');
      return;
    }
    if (
      (editorType === 'meetup' || editorType === 'convoy') &&
      (!Number.isFinite(trustScore) || trustScore < 0 || trustScore > 100)
    ) {
      setFormError('Güven puanı 0 ile 100 arasında olmalıdır.');
      return;
    }
    const first = points[0];
    try {
      if (editorType === 'spot' || editorType === 'wash') {
        await world.createNode({
          type: editorType,
          name: name.trim(),
          description: description.trim(),
          tags: editorType === 'spot' ? ['#TrackSnap'] : [],
          lat: first.latitude,
          lng: first.longitude,
        });
      } else {
        const startAt = Date.now() + 60 * 60 * 1000;
        await world.createConvoy({
          type: 'meet',
          eventMode: editorType,
          name: name.trim(),
          route: description.trim() || (editorType === 'meetup' ? 'Tek nokta buluşması' : 'Harita rotası'),
          time: new Date(startAt).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          scheduledStartAtMs: startAt,
          lat: first.latitude,
          lng: first.longitude,
          routePath: points.map((point) => ({ lat: point.latitude, lng: point.longitude })),
          capacity: 12,
          visibility: 'public',
          accessPolicy: 'request',
          detailVisibility: 'trusted',
          minDriverScore: trustScore,
          minHarmonyVotes: 0,
          maxAlertVotes: 999,
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEditor();
      setNotice('Yeni kayıt oluşturuldu.');
      setTimeout(() => setNotice(''), 2500);
    } catch {
      setFormError(world.error || 'Nokta eklenemedi.');
    }
  };

  const filteredPins = useMemo(() => world.activePins
    .filter((pin) => filter === 'all' || eventFilterForPin(pin) === filter)
    .sort(sortEventPins), [filter, world.activePins]);
  const popularPins = useMemo(() => [...world.activePins]
    .sort((left, right) => eventPopularity(right) - eventPopularity(left))
    .slice(0, 4), [world.activePins]);

  return (
    <ScreenShell scrollProps={{ contentContainerStyle: styles.screenContent }}>
      <View style={styles.eventHero}>
        <View style={styles.eventHeroCopy}>
          <Text style={styles.eventEyebrow}>YOL TOPLULUĞU</Text>
          <Text style={styles.eventTitle}>Etkinlikler</Text>
          <Text style={styles.eventSubtitle}>Buluşmaları keşfet, rotalara katıl ve yeni bir nokta oluştur.</Text>
        </View>
        <Pressable
          accessibilityLabel="Yeni etkinlik veya nokta oluştur"
          onPress={openEditor}
          style={({ pressed }) => [styles.heroAddButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" color={colors.black} size={24} />
        </Pressable>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.filterContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {eventFilters.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {world.loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.lime} />
          <Text style={styles.loadingText}>Etkinlikler yükleniyor</Text>
        </View>
      ) : null}

      {!world.loading && popularPins.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Öne Çıkanlar</Text>
              <Text style={styles.sectionSubtitle}>Topluluğun en çok etkileşim alan noktaları</Text>
            </View>
            <Ionicons name="sparkles" size={18} color={colors.lime} />
          </View>
          <ScrollView
            contentContainerStyle={styles.popularContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {popularPins.map((pin) => (
              <EventCard compact key={`popular-${pin.id}`} onPress={() => setSelected(pin)} pin={pin} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Tüm Etkinlikler</Text>
            <Text style={styles.sectionSubtitle}>{filteredPins.length} sonuç</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>CANLI</Text>
          </View>
        </View>
        {filteredPins.length ? filteredPins.map((pin) => (
          <EventCard key={pin.id} onPress={() => setSelected(pin)} pin={pin} />
        )) : !world.loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={25} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Bu kategoride etkinlik yok</Text>
            <Text style={styles.emptyText}>İlk etkinliği oluşturmak için üstteki + düğmesini kullanın.</Text>
          </View>
        ) : null}
      </View>

      <Modal animationType="slide" transparent visible={Boolean(selected)} onRequestClose={() => setSelected(null)}>
        <View style={styles.detailBackdrop}>
          <Pressable onPress={() => setSelected(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.detailSheet}>
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              {selected ? (
                <SelectedNode
                  busy={world.busy}
                  onClose={() => setSelected(null)}
                  onJoin={async () => {
                    try {
                      await world.joinConvoy(selected.id);
                      setNotice('Katılım isteğiniz gönderildi.');
                    } catch {
                      setNotice(world.error || 'Katılım isteği gönderilemedi.');
                    }
                  }}
                  onLike={async () => {
                    try {
                      await world.likePin(selected.id);
                      setNotice('Beğeni güncellendi.');
                    } catch {
                      setNotice(world.error || 'Beğeni güncellenemedi.');
                    }
                  }}
                  onHelpfulReview={async (reviewId) => {
                    try {
                      await world.helpfulReview(reviewId);
                      setNotice('Faydalı oyu güncellendi.');
                    } catch {
                      setNotice(world.error || 'Faydalı oyu güncellenemedi.');
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await world.deleteConvoy(selected.id);
                      setSelected(null);
                      setNotice('Etkinlik kaldırıldı.');
                    } catch {
                      setNotice(world.error || 'Etkinlik kaldırılamadı.');
                    }
                  }}
                  onOpenDriver={(driver) => void openDriverProfile(driver, { convoyId: selected.id })}
                  onPhoto={async (asset) => {
                    try {
                      await world.addSpotPhoto(selected.id, asset);
                      setNotice('Fotoğraf noktaya eklendi.');
                    } catch (photoError) {
                      setNotice(photoError instanceof Error ? photoError.message : 'Fotoğraf eklenemedi.');
                    }
                  }}
                  onReview={async (review) => {
                    try {
                      await world.reviewWash(selected.id, review);
                      setNotice('Yıkama değerlendirmeniz kaydedildi.');
                    } catch {
                      setNotice(world.error || 'Değerlendirme kaydedilemedi.');
                    }
                  }}
                  onUpdate={async (details) => {
                    try {
                      await world.updateConvoy(selected.id, details);
                      setSelected(null);
                      setNotice('Etkinlik bilgileri güncellendi.');
                    } catch {
                      setNotice(world.error || 'Etkinlik güncellenemedi.');
                      throw new Error(world.error || 'Etkinlik güncellenemedi.');
                    }
                  }}
                  photos={world.photos.filter((photo) => photo.pinId === selected.id)}
                  pin={selected}
                  reviews={world.reviews.filter((review) => review.pinId === selected.id)}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={editorOpen} onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <View>
                <Text style={styles.editorTitle}>Yeni Etkinlik</Text>
                <Text style={styles.editorSubtitle}>Türü seçin ve konumu mini haritadan belirleyin.</Text>
              </View>
              <Pressable onPress={closeEditor} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.editorContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.optionGrid}>
              {nodeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setEditorType(option.value);
                    setPoints([]);
                  }}
                  style={[
                    styles.option,
                    editorType === option.value && styles.optionActive,
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={editorType === option.value ? colors.black : colors.textMuted}
                  />
                  <Text style={[
                    styles.optionText,
                    editorType === option.value && styles.optionTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              maxLength={100}
              onChangeText={setName}
              placeholder="Etkinlik veya nokta adı *"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              value={name}
            />
            <TextInput
              maxLength={500}
              multiline
              onChangeText={setDescription}
              placeholder={editorType === 'convoy' ? 'Rota açıklaması' : 'Açıklama'}
              placeholderTextColor={colors.textFaint}
              style={[styles.input, styles.textArea]}
              value={description}
            />

            {editorType === 'meetup' || editorType === 'convoy' ? (
              <View style={styles.trustField}>
                <View style={styles.trustCopy}>
                  <Text style={styles.trustLabel}>Minimum güven puanı</Text>
                  <Text style={styles.trustHint}>
                    Sizin puanınız {Math.round(Number(profile?.driverScore ?? 0))}/100
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel="Minimum güven puanı"
                  keyboardType="number-pad"
                  maxLength={3}
                  onChangeText={(value) => {
                    setMinDriverScore(value.replace(/\D/g, '').slice(0, 3));
                    setFormError('');
                  }}
                  selectTextOnFocus
                  style={styles.trustInput}
                  value={minDriverScore}
                />
              </View>
            ) : null}

            <View style={styles.editorMapWrap}>
              <MapView
                initialRegion={ANKARA}
                onPress={selectMapPoint}
                provider={mapProvider}
                showsUserLocation
                style={styles.editorMap}
                userInterfaceStyle={resolvedTheme}
              >
                {points.map((point, index) => (
                  <Marker coordinate={point} key={`editor-${index}`}>
                    <View style={styles.draftMarker}>
                      <Text style={styles.draftMarkerText}>{index + 1}</Text>
                    </View>
                  </Marker>
                ))}
                {points.length > 1 ? (
                  <Polyline coordinates={points} strokeColor={colors.lime} strokeWidth={4} />
                ) : null}
              </MapView>
              <View style={styles.selectionHint}>
                <Text style={styles.selectionHintText}>
                  {editorType === 'convoy'
                    ? `${points.length} rota noktası seçildi`
                    : points.length ? 'Konum seçildi' : 'Konum seçmek için haritaya dokunun'}
                </Text>
              </View>
            </View>

            {editorType === 'convoy' ? (
              <View style={styles.routeActions}>
                <Pressable
                  disabled={!points.length}
                  onPress={() => setPoints((current) => current.slice(0, -1))}
                  style={({ pressed }) => [
                    styles.routeAction,
                    !points.length && styles.routeActionDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="arrow-undo" size={17} color={colors.text} />
                  <Text style={styles.routeActionText}>Son Noktayı Geri Al</Text>
                </Pressable>
                <Pressable
                  disabled={!points.length}
                  onPress={() => setPoints([])}
                  style={({ pressed }) => [
                    styles.routeAction,
                    styles.routeClear,
                    !points.length && styles.routeActionDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={17} color="#fda4af" />
                  <Text style={styles.routeClearText}>Rotayı Temizle</Text>
                </Pressable>
              </View>
            ) : null}

            {formError || world.error ? (
              <Text style={styles.error}>{formError || world.error}</Text>
            ) : null}
            <Pressable
              disabled={Boolean(world.busy)}
              onPress={() => void saveNode()}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            >
              {world.busy ? <ActivityIndicator color={colors.black} /> : (
                <>
                  <Ionicons name="checkmark" size={20} color={colors.black} />
                  <Text style={styles.saveButtonText}>Oluştur</Text>
                </>
              )}
            </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function EventCard({
  compact = false,
  onPress,
  pin,
}: {
  compact?: boolean;
  onPress: () => void;
  pin: MapPin;
}) {
  const joined = pin.type === 'meet' && Boolean(pin.attendees?.some((driver) => driver.relation === 'self'));
  const meta = pin.type === 'meet'
    ? pin.time || (pin.eventMode === 'convoy' ? 'Konvoy rotası' : 'Buluşma noktası')
    : pin.type === 'wash'
      ? `${Number(pin.rating?.reviews ?? 0)} değerlendirme`
      : `${Number(pin.photoCount ?? 0)} fotoğraf`;

  return (
    <Pressable
      accessibilityLabel={`${pin.name} detaylarını aç`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCard,
        compact && styles.eventCardCompact,
        pressed && styles.eventCardPressed,
      ]}
    >
      <View style={styles.eventCardTop}>
        <View style={[styles.eventIcon, pin.type === 'meet' && styles.eventIconMeet]}>
          <Ionicons name={mapNodeIcon(pin)} size={20} color={pin.type === 'meet' ? colors.black : colors.limeBright} />
        </View>
        <View style={styles.eventCardCopy}>
          <Text numberOfLines={1} style={styles.eventCardName}>{pin.name}</Text>
          <Text numberOfLines={1} style={styles.eventCardType}>{mapNodeLabel(pin)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>
      <Text numberOfLines={compact ? 2 : 1} style={styles.eventCardMeta}>{meta}</Text>
      <View style={styles.eventCardFooter}>
        <View style={styles.eventStat}>
          <Ionicons name="heart-outline" size={14} color={colors.rose} />
          <Text style={styles.eventStatText}>{Number(pin.likes ?? 0)}</Text>
        </View>
        {pin.type === 'meet' ? (
          <View style={styles.eventStat}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={styles.eventStatText}>{Number(pin.approvedCount ?? 1)}/{Number(pin.capacity ?? 12)}</Text>
          </View>
        ) : null}
        {joined ? (
          <View style={styles.joinedBadge}>
            <Ionicons name="checkmark" size={12} color={colors.black} />
            <Text style={styles.joinedBadgeText}>KATILDIN</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function eventFilterForPin(pin: MapPin): EditorType {
  if (pin.type === 'spot' || pin.type === 'wash') return pin.type;
  return pin.eventMode === 'convoy' ? 'convoy' : 'meetup';
}

function eventPopularity(pin: MapPin) {
  const likes = Number(pin.likes ?? 0);
  const participation = pin.type === 'meet' ? Number(pin.approvedCount ?? 0) * 2 : 0;
  const contribution = pin.type === 'spot'
    ? Number(pin.photoCount ?? 0)
    : pin.type === 'wash'
      ? Number(pin.rating?.reviews ?? 0)
      : 0;
  return likes + participation + contribution;
}

function sortEventPins(left: MapPin, right: MapPin) {
  const leftDate = Number(left.scheduledStartAtMs ?? Number.MAX_SAFE_INTEGER);
  const rightDate = Number(right.scheduledStartAtMs ?? Number.MAX_SAFE_INTEGER);
  if (leftDate !== rightDate) return leftDate - rightDate;
  return eventPopularity(right) - eventPopularity(left);
}

function SelectedNode({
  busy,
  onClose,
  onJoin,
  onLike,
  onDelete,
  onHelpfulReview,
  onOpenDriver,
  onPhoto,
  onReview,
  onUpdate,
  photos,
  pin,
  reviews,
}: {
  busy: string;
  onClose: () => void;
  onJoin: () => void;
  onLike: () => void;
  onDelete: () => Promise<void>;
  onHelpfulReview: (reviewId: string) => Promise<void>;
  onOpenDriver: (driver: DriverSummary) => void;
  onPhoto: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
  onReview: (review: {
    foam: number;
    water: number;
    allowsBuckets: boolean;
    shadowDrying: boolean;
    note: string;
  }) => Promise<void>;
  onUpdate: (details: Record<string, unknown>) => Promise<void>;
  photos: ReturnType<typeof useMapWorld>['photos'];
  pin: MapPin;
  reviews: ReturnType<typeof useMapWorld>['reviews'];
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [foam, setFoam] = useState(5);
  const [water, setWater] = useState(5);
  const [allowsBuckets, setAllowsBuckets] = useState(false);
  const [shadowDrying, setShadowDrying] = useState(false);
  const [note, setNote] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(pin.name);
  const [editRoute, setEditRoute] = useState(pin.route || 'Tek nokta buluşması');
  const [editCapacity, setEditCapacity] = useState(String(pin.capacity ?? 12));
  const [editScore, setEditScore] = useState(String(pin.minDriverScore ?? 0));
  const [editError, setEditError] = useState('');
  const isHost = pin.type === 'meet' && pin.viewerManagementRole === 'host';
  const editable = isHost && ['planning', 'delayed'].includes(pin.lifecycleStatus ?? 'planning');

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.84,
      selectionLimit: 1,
    });
    if (!result.canceled) await onPhoto(result.assets[0]);
  };

  return (
    <Surface accent>
      <View style={styles.selectedHeader}>
        <View style={styles.selectedIcon}>
          <Ionicons name={mapNodeIcon(pin)} size={20} color={colors.black} />
        </View>
        <View style={styles.selectedCopy}>
          <Text style={styles.selectedName}>{pin.name}</Text>
          <Text style={styles.selectedType}>{mapNodeLabel(pin)}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {pin.description || pin.route ? (
        <Text style={styles.selectedDescription}>{pin.description || pin.route}</Text>
      ) : null}
      {pin.hostUserId || pin.createdByUid ? (
        <DriverIdentity
          driver={{
            userId: pin.hostUserId || pin.createdByUid || '',
            fullName: pin.createdByName,
            plate: pin.createdByPlate,
          }}
          label="Etkinlik sahibi"
          onOpen={onOpenDriver}
        />
      ) : null}
      {pin.type === 'wash' ? (
        <>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>Köpük {Number(pin.rating?.foam ?? 0).toFixed(1)}</Text>
            <Text style={styles.rating}>Su {Number(pin.rating?.water ?? 0).toFixed(1)}</Text>
            <Text style={styles.rating}>{pin.rating?.reviews ?? 0} yorum</Text>
          </View>
          {reviews.slice(0, 3).map((review) => (
            <View key={review.id} style={styles.reviewRow}>
              <Text style={styles.reviewAuthor}>{review.author || 'Sürücü'}</Text>
              <Text numberOfLines={2} style={styles.reviewText}>
                Köpük {review.foam}/5 · Su {review.water}/5
                {review.note ? ` · ${review.note}` : ''}
              </Text>
              <Pressable
                disabled={Boolean(busy)}
                onPress={() => void onHelpfulReview(review.id)}
                style={({ pressed }) => [styles.helpfulButton, pressed && styles.pressed]}
              >
                <Ionicons name="thumbs-up-outline" size={14} color={colors.lime} />
                <Text style={styles.helpfulText}>Faydalı {Number(review.helpfulCount ?? 0)}</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
      {pin.type === 'spot' && photos.length ? (
        <View style={styles.photoGrid}>
          {photos.slice(0, 3).map((photo) => (
            <Image
              contentFit="cover"
              key={photo.id}
              source={{ uri: photo.imageUrl }}
              style={styles.spotPhoto}
            />
          ))}
        </View>
      ) : null}
      {pin.type === 'meet' ? (
        <>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>{pin.time || 'Saat belirtilmedi'}</Text>
            <Text style={styles.detailText}>
              {pin.approvedCount ?? 1}/{pin.capacity ?? 12} sürücü
            </Text>
          </View>
          <View style={styles.trustRequirement}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.lime} />
            <Text style={styles.trustRequirementText}>
              Minimum güven puanı: {Number(pin.minDriverScore ?? 0)}/100
            </Text>
          </View>
          {pin.attendees?.length ? (
            <View style={styles.attendeeList}>
              <Text style={styles.attendeeTitle}>Katılımcılar</Text>
              {pin.attendees.map((driver) => (
                <DriverIdentity
                  driver={driver}
                  key={driver.userId}
                  label={driver.relation === 'self' ? 'Siz' : 'Katılımcı'}
                  onOpen={onOpenDriver}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <View style={styles.nodeActions}>
        {pin.type === 'meet' && pin.backendCanJoin ? (
          <Pressable disabled={Boolean(busy)} onPress={onJoin} style={styles.primarySmall}>
            <Ionicons name="person-add" size={17} color={colors.black} />
            <Text style={styles.primarySmallText}>Katıl</Text>
          </Pressable>
        ) : null}
        {pin.type === 'meet' || pin.type === 'spot' ? (
          <Pressable
            disabled={Boolean(busy) || (pin.type === 'meet' && !pin.backendCanLike)}
            onPress={onLike}
            style={[
              styles.secondarySmall,
              pin.type === 'meet' && !pin.backendCanLike && styles.actionDisabled,
            ]}
          >
            <Ionicons name="heart-outline" size={17} color={colors.lime} />
            <Text style={styles.secondarySmallText}>{pin.likes ?? 0}</Text>
          </Pressable>
        ) : null}
        {pin.type === 'spot' ? (
          <Pressable
            disabled={Boolean(busy)}
            onPress={() => void choosePhoto()}
            style={styles.primarySmall}
          >
            <Ionicons name="image" size={17} color={colors.black} />
            <Text style={styles.primarySmallText}>Fotoğraf Ekle</Text>
          </Pressable>
        ) : null}
        {pin.type === 'wash' ? (
          <Pressable
            disabled={Boolean(busy)}
            onPress={() => setReviewOpen((current) => !current)}
            style={styles.primarySmall}
          >
            <Ionicons name="star" size={17} color={colors.black} />
            <Text style={styles.primarySmallText}>Puanla</Text>
          </Pressable>
        ) : null}
      </View>
      {pin.type === 'meet' && !pin.backendCanLike ? (
        <Text style={styles.likeHint}>Buluşma ve konvoy beğenileri yalnızca onaylı katılımcılara açıktır.</Text>
      ) : null}
      {isHost ? (
        <View style={styles.managementActions}>
          {editable ? (
            <Pressable onPress={() => setEditOpen((current) => !current)} style={styles.manageButton}>
              <Ionicons name="create-outline" size={17} color={colors.limeBright} />
              <Text style={styles.manageButtonText}>Düzenle</Text>
            </Pressable>
          ) : null}
          {(editable || ['completed', 'cancelled'].includes(pin.lifecycleStatus ?? 'planning')) ? (
            <Pressable
              onPress={() => Alert.alert(
                'Etkinliği kaldır',
                'Bu etkinlik ve katılımcı kayıtları kalıcı olarak silinecek.',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  { text: 'Sil', style: 'destructive', onPress: () => void onDelete() },
                ],
              )}
              style={[styles.manageButton, styles.deleteButton]}
            >
              <Ionicons name="trash-outline" size={17} color={colors.rose} />
              <Text style={styles.deleteButtonText}>Kaldır</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {editOpen && editable ? (
        <View style={styles.eventEditForm}>
          <TextInput
            maxLength={100}
            onChangeText={setEditName}
            placeholder="Etkinlik adı"
            placeholderTextColor={colors.textFaint}
            style={styles.reviewInput}
            value={editName}
          />
          <TextInput
            maxLength={240}
            onChangeText={setEditRoute}
            placeholder="Buluşma veya rota açıklaması"
            placeholderTextColor={colors.textFaint}
            style={styles.reviewInput}
            value={editRoute}
          />
          <View style={styles.editNumberRow}>
            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={setEditCapacity}
              placeholder="Kapasite"
              placeholderTextColor={colors.textFaint}
              style={[styles.reviewInput, styles.editNumberInput]}
              value={editCapacity}
            />
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setEditScore}
              placeholder="Güven puanı"
              placeholderTextColor={colors.textFaint}
              style={[styles.reviewInput, styles.editNumberInput]}
              value={editScore}
            />
          </View>
          {editError ? <Text style={styles.editError}>{editError}</Text> : null}
          <Pressable
            disabled={Boolean(busy)}
            onPress={async () => {
              const capacity = Number(editCapacity);
              const minDriverScore = Number(editScore);
              if (!editName.trim() || !editRoute.trim() || !Number.isInteger(capacity) || capacity < 2 || capacity > 50 || !Number.isFinite(minDriverScore) || minDriverScore < 0 || minDriverScore > 100) {
                setEditError('Ad, açıklama, 2-50 kapasite ve 0-100 güven puanı geçerli olmalıdır.');
                return;
              }
              setEditError('');
              await onUpdate({ name: editName.trim(), route: editRoute.trim(), capacity, minDriverScore });
              setEditOpen(false);
            }}
            style={styles.reviewSubmit}
          >
            {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.primarySmallText}>Değişiklikleri Kaydet</Text>}
          </Pressable>
        </View>
      ) : null}
      {reviewOpen && pin.type === 'wash' ? (
        <View style={styles.reviewForm}>
          <ScorePicker label="Köpük kalitesi" onChange={setFoam} value={foam} />
          <ScorePicker label="Su kalitesi" onChange={setWater} value={water} />
          <View style={styles.flagRow}>
            <FlagButton
              active={allowsBuckets}
              label="Kova serbest"
              onPress={() => setAllowsBuckets((current) => !current)}
            />
            <FlagButton
              active={shadowDrying}
              label="Gölge alan"
              onPress={() => setShadowDrying((current) => !current)}
            />
          </View>
          <TextInput
            maxLength={280}
            onChangeText={setNote}
            placeholder="Kısa yorum"
            placeholderTextColor={colors.textFaint}
            style={styles.reviewInput}
            value={note}
          />
          <Pressable
            disabled={Boolean(busy)}
            onPress={async () => {
              await onReview({ foam, water, allowsBuckets, shadowDrying, note });
              setReviewOpen(false);
              setNote('');
            }}
            style={styles.reviewSubmit}
          >
            {busy ? <ActivityIndicator color={colors.black} /> : (
              <Text style={styles.primarySmallText}>Değerlendirmeyi Gönder</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </Surface>
  );
}

function DriverIdentity({
  driver,
  label,
  onOpen,
}: {
  driver: DriverSummary;
  label: string;
  onOpen: (driver: DriverSummary) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${driver.fullName || driver.plate || 'Sürücü'} profilini aç`}
      disabled={!driver.userId}
      onPress={() => onOpen(driver)}
      style={({ pressed }) => [styles.driverIdentity, pressed && styles.driverIdentityPressed]}
    >
      <View style={styles.driverIdentityIcon}>
        <Ionicons name="person" size={16} color={colors.limeBright} />
      </View>
      <View style={styles.selectedCopy}>
        <Text numberOfLines={1} style={styles.driverIdentityName}>
          {driver.fullName || driver.plate || 'TrackSnap sürücüsü'}
        </Text>
        <Text numberOfLines={1} style={styles.driverIdentityMeta}>
          {driver.model || label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

function ScorePicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreStars}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable key={score} onPress={() => onChange(score)} style={styles.starButton}>
            <Ionicons
              color={score <= value ? colors.lime : colors.textFaint}
              name={score <= value ? 'star' : 'star-outline'}
              size={20}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FlagButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.flagButton, active && styles.flagButtonActive]}>
      <Ionicons
        color={active ? colors.black : colors.textMuted}
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
      />
      <Text style={[styles.flagText, active && styles.flagTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = createThemedStyles(() => ({
  screenContent: { paddingTop: 14, paddingBottom: 116, gap: 12 },
  eventHero: {
    minHeight: 132,
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  eventHeroCopy: { flex: 1 },
  eventEyebrow: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 2.2,
  },
  eventTitle: { marginTop: 5, color: colors.text, fontFamily: fonts.extraBold, fontSize: 25 },
  eventSubtitle: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  heroAddButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 7,
  },
  filterContent: { gap: 7, paddingRight: 18 },
  filterChip: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  filterText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  filterTextActive: { color: colors.black, fontFamily: fonts.bold },
  loadingState: {
    minHeight: 110,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10 },
  section: {
    padding: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  sectionHeader: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  sectionSubtitle: { marginTop: 2, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 9 },
  popularContent: { gap: 9, paddingRight: 12 },
  eventCard: {
    minHeight: 132,
    padding: 13,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
  },
  eventCardCompact: { width: 248 },
  eventCardPressed: {
    borderColor: colors.lime,
    backgroundColor: colors.limeMuted,
    transform: [{ scale: 0.985 }],
  },
  eventCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIconMeet: { borderColor: colors.lime, backgroundColor: colors.lime },
  eventCardCopy: { flex: 1 },
  eventCardName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  eventCardType: { marginTop: 2, color: colors.lime, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.8 },
  eventCardMeta: { marginTop: 12, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 15 },
  eventCardFooter: { marginTop: 'auto', paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  eventStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventStatText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  joinedBadge: {
    marginLeft: 'auto',
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  joinedBadgeText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 7, letterSpacing: 0.7 },
  liveBadge: {
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime },
  liveBadgeText: { color: colors.lime, fontFamily: fonts.bold, fontSize: 7, letterSpacing: 1.1 },
  emptyState: {
    minHeight: 145,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 8, color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  emptyText: { marginTop: 4, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9, textAlign: 'center' },
  detailBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  detailSheet: {
    maxHeight: '88%',
    paddingTop: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.backgroundRaised,
  },
  detailContent: { padding: 14, paddingBottom: 34 },
  draftMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftMarkerText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 12 },
  addButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: { color: colors.black, fontFamily: fonts.bold, fontSize: 14 },
  notice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    color: colors.limeBright,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  selectedIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCopy: { flex: 1 },
  selectedName: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  selectedType: { marginTop: 2, color: colors.lime, fontFamily: fonts.bold, fontSize: 9 },
  selectedDescription: {
    marginTop: 13,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  driverIdentity: {
    minHeight: 58,
    marginTop: 11,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverIdentityPressed: {
    borderColor: colors.lime,
    backgroundColor: colors.limeMuted,
    transform: [{ scale: 0.988 }],
  },
  driverIdentityIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverIdentityName: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  driverIdentityMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 9,
  },
  ratingRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  rating: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: colors.backgroundRaised,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  reviewRow: {
    marginTop: 8,
    padding: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
  },
  reviewAuthor: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9 },
  reviewText: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  helpfulButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    marginTop: 8,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpfulText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  photoGrid: { marginTop: 12, flexDirection: 'row', gap: 7 },
  spotPhoto: { flex: 1, height: 92, borderRadius: 14, backgroundColor: colors.backgroundRaised },
  detailRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  detailText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10 },
  trustRequirement: {
    minHeight: 42,
    marginTop: 9,
    paddingHorizontal: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustRequirementText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  attendeeList: { marginTop: 12 },
  attendeeTitle: {
    marginBottom: 2,
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  nodeActions: { marginTop: 13, flexDirection: 'row', gap: 8 },
  primarySmall: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primarySmallText: { color: colors.black, fontFamily: fonts.bold, fontSize: 12 },
  secondarySmall: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  secondarySmallText: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  actionDisabled: { opacity: 0.38 },
  likeHint: { marginTop: 7, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 9, lineHeight: 13 },
  managementActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  manageButton: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.limeMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  manageButtonText: { color: colors.limeBright, fontFamily: fonts.bold, fontSize: 11 },
  deleteButton: { borderColor: 'rgba(244,63,94,0.28)', backgroundColor: 'rgba(244,63,94,0.08)' },
  deleteButtonText: { color: colors.rose, fontFamily: fonts.bold, fontSize: 11 },
  eventEditForm: { marginTop: 11, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.backgroundRaised, gap: 9 },
  editNumberRow: { flexDirection: 'row', gap: 8 },
  editNumberInput: { flex: 1 },
  editError: { color: colors.rose, fontFamily: fonts.semibold, fontSize: 9, lineHeight: 13 },
  reviewForm: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundRaised,
    gap: 10,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 11 },
  scoreStars: { flexDirection: 'row' },
  starButton: { width: 31, height: 34, alignItems: 'center', justifyContent: 'center' },
  flagRow: { flexDirection: 'row', gap: 7 },
  flagButton: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  flagButtonActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  flagText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  flagTextActive: { color: colors.black },
  reviewInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  reviewSubmit: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.74)' },
  editor: {
    maxHeight: '92%',
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.backgroundRaised,
  },
  editorContent: { paddingBottom: 6 },
  editorHeader: {
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  editorTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 21 },
  editorSubtitle: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionGrid: { marginBottom: 12, flexDirection: 'row', gap: 7 },
  option: {
    flex: 1,
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  optionActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  optionText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9 },
  optionTextActive: { color: colors.black },
  input: {
    minHeight: 52,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  textArea: { minHeight: 72, paddingTop: 13, textAlignVertical: 'top' },
  trustField: {
    minHeight: 58,
    marginBottom: 10,
    paddingLeft: 13,
    paddingRight: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trustCopy: { flex: 1 },
  trustLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  trustHint: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  trustInput: {
    width: 62,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.lime,
    backgroundColor: colors.backgroundRaised,
    color: colors.limeBright,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    textAlign: 'center',
  },
  editorMapWrap: { height: 230, overflow: 'hidden', borderRadius: 19 },
  editorMap: { flex: 1 },
  selectionHint: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    padding: 9,
    borderRadius: 12,
    backgroundColor: colors.backgroundRaised,
  },
  selectionHintText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 10, textAlign: 'center' },
  routeActions: { marginTop: 9, flexDirection: 'row', gap: 8 },
  routeAction: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  routeClear: {
    borderColor: 'rgba(244,63,94,0.3)',
    backgroundColor: 'rgba(244,63,94,0.06)',
  },
  routeActionDisabled: { opacity: 0.35 },
  routeActionText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 9,
    textAlign: 'center',
  },
  routeClearText: {
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 9,
    textAlign: 'center',
  },
  error: { marginTop: 9, color: '#fda4af', fontFamily: fonts.semibold, fontSize: 11 },
  saveButton: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: { color: colors.black, fontFamily: fonts.bold, fontSize: 13 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
}));
