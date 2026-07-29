import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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

import { ScreenShell, Surface } from '@/components/screen-shell';
import { useMapWorld } from '@/hooks/use-map-world';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { colors, fonts } from '@/theme/colors';
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
type Point = { latitude: number; longitude: number };

const nodeOptions: { value: EditorType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'meetup', label: 'Buluşma', icon: 'people' },
  { value: 'convoy', label: 'Konvoy', icon: 'navigate' },
  { value: 'spot', label: 'Fotoğraf', icon: 'camera' },
  { value: 'wash', label: 'Yıkama', icon: 'water' },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { mapWorld: world, openDriverProfile } = useDriverProfile();
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState<EditorType>('meetup');
  const [points, setPoints] = useState<Point[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current?.animateToRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.09,
      }, 500);
    });
  }, []);

  const selectMapPoint = (event: MapPressEvent) => {
    if (!editorOpen) {
      setSelected(null);
      return;
    }
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
    setFormError('');
    setEditorOpen(true);
  };

  const saveNode = async () => {
    const minimumPoints = editorType === 'convoy' ? 2 : 1;
    if (!name.trim() || points.length < minimumPoints) {
      setFormError(editorType === 'convoy'
        ? 'Adı doldurun ve haritadan en az iki rota noktası seçin.'
        : 'Adı doldurun ve haritadan bir konum seçin.');
      return;
    }
    const first = points[0];
    try {
      if (editorType === 'spot' || editorType === 'wash') {
        await world.createNode({
          type: editorType,
          name: name.trim(),
          description: description.trim(),
          tags: editorType === 'spot' ? ['#CRUISER'] : [],
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
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
      setNotice('Nokta haritaya eklendi.');
      setTimeout(() => setNotice(''), 2500);
    } catch {
      setFormError(world.error || 'Nokta eklenemedi.');
    }
  };

  const goToLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setNotice('Konum izni verilmedi.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    mapRef.current?.animateToRegion({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.03,
    }, 500);
  };

  return (
    <ScreenShell scrollProps={{ contentContainerStyle: styles.screenContent }}>
      <View style={styles.mapCard}>
        <View style={styles.mapLabel}>
          <Text style={styles.mapTitle}>Etkinlik Haritası</Text>
          <Text style={styles.mapCount}>{world.pins.length} nokta</Text>
        </View>
        <MapView
          initialRegion={ANKARA}
          mapType="standard"
          onPress={selectMapPoint}
          provider={mapProvider}
          ref={mapRef}
          showsCompass
          showsMyLocationButton={false}
          showsUserLocation
          style={styles.map}
          toolbarEnabled={false}
          userInterfaceStyle="dark"
        >
          {world.pins.map((pin) => (
            <Marker
              coordinate={{ latitude: Number(pin.lat), longitude: Number(pin.lng) }}
              key={pin.id}
              onPress={() => setSelected(pin)}
              tracksViewChanges={false}
            >
              <View style={[styles.marker, markerStyle(pin.type)]}>
                <Ionicons
                  color={pin.type === 'meet' ? colors.white : colors.black}
                  name={markerIcon(pin)}
                  size={17}
                />
              </View>
            </Marker>
          ))}
          {points.map((point, index) => (
            <Marker coordinate={point} key={`draft-${index}`}>
              <View style={styles.draftMarker}>
                <Text style={styles.draftMarkerText}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
          {points.length > 1 ? (
            <Polyline coordinates={points} strokeColor={colors.lime} strokeWidth={4} />
          ) : null}
        </MapView>
        <Pressable
          onPress={() => void goToLocation()}
          style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
        >
          <Ionicons name="locate" size={19} color={colors.text} />
        </Pressable>
      </View>

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
          photos={world.photos.filter((photo) => photo.pinId === selected.id)}
          pin={selected}
          reviews={world.reviews.filter((review) => review.pinId === selected.id)}
        />
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable
        onPress={openEditor}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Ionicons name="add" color={colors.black} size={22} />
        <Text style={styles.addButtonText}>Etkinlik Ekle</Text>
      </Pressable>

      <Modal animationType="slide" transparent visible={editorOpen} onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <View>
                <Text style={styles.editorTitle}>Haritaya Ekle</Text>
                <Text style={styles.editorSubtitle}>Türü seçin, ardından haritaya dokunun.</Text>
              </View>
              <Pressable onPress={() => setEditorOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

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

            <View style={styles.editorMapWrap}>
              <MapView
                initialRegion={ANKARA}
                onPress={selectMapPoint}
                provider={mapProvider}
                showsUserLocation
                style={styles.editorMap}
                userInterfaceStyle="dark"
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
                  <Text style={styles.saveButtonText}>Haritaya Ekle</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function SelectedNode({
  busy,
  onClose,
  onJoin,
  onLike,
  onOpenDriver,
  onPhoto,
  onReview,
  photos,
  pin,
  reviews,
}: {
  busy: string;
  onClose: () => void;
  onJoin: () => void;
  onLike: () => void;
  onOpenDriver: (driver: DriverSummary) => void;
  onPhoto: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
  onReview: (review: {
    foam: number;
    water: number;
    allowsBuckets: boolean;
    shadowDrying: boolean;
    note: string;
  }) => Promise<void>;
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
          <Ionicons name={markerIcon(pin)} size={20} color={colors.black} />
        </View>
        <View style={styles.selectedCopy}>
          <Text style={styles.selectedName}>{pin.name}</Text>
          <Text style={styles.selectedType}>{typeLabel(pin)}</Text>
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
        {pin.type !== 'meet' ? (
          <Pressable disabled={Boolean(busy)} onPress={onLike} style={styles.secondarySmall}>
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
          {driver.fullName || driver.plate || 'CRUISER sürücüsü'}
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

function markerIcon(pin: MapPin): keyof typeof Ionicons.glyphMap {
  if (pin.type === 'spot') return 'camera';
  if (pin.type === 'wash') return 'water';
  return pin.eventMode === 'meetup' ? 'people' : 'navigate';
}

function markerStyle(type: MapPin['type']) {
  if (type === 'wash') return styles.markerBlue;
  if (type === 'meet') return styles.markerRose;
  return styles.markerLime;
}

function typeLabel(pin: MapPin) {
  if (pin.type === 'spot') return 'Fotoğraf noktası';
  if (pin.type === 'wash') return 'Yıkama istasyonu';
  return pin.eventMode === 'meetup' ? 'Buluşma' : 'Konvoy';
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 14, paddingBottom: 116, gap: 12 },
  mapCard: {
    height: 570,
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  map: { flex: 1 },
  mapLabel: {
    position: 'absolute',
    zIndex: 3,
    left: 12,
    top: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: 'rgba(5,6,5,0.88)',
  },
  mapTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 13 },
  mapCount: { marginTop: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  locationButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(5,6,5,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLime: { backgroundColor: colors.lime },
  markerBlue: { backgroundColor: '#38bdf8' },
  markerRose: { backgroundColor: colors.rose },
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
    backgroundColor: colors.black,
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
    backgroundColor: colors.black,
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
    backgroundColor: 'rgba(4,6,4,0.38)',
  },
  reviewAuthor: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9 },
  reviewText: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  photoGrid: { marginTop: 12, flexDirection: 'row', gap: 7 },
  spotPhoto: { flex: 1, height: 92, borderRadius: 14, backgroundColor: colors.black },
  detailRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  detailText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10 },
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
  reviewForm: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.black,
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
  editorMapWrap: { height: 230, overflow: 'hidden', borderRadius: 19 },
  editorMap: { flex: 1 },
  selectionHint: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    padding: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(5,6,5,0.86)',
  },
  selectionHintText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 10, textAlign: 'center' },
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
});
