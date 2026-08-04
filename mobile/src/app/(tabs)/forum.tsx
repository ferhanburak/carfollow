import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
} from 'react-native';

import { LocalizedPressable as Pressable, LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';
import { ScreenShell } from '@/components/screen-shell';
import { ForumThreadDetail } from '@/components/forum-thread-detail';
import {
  ForumEventCard,
  ForumMentionRow,
  ForumPollCard,
} from '@/components/forum-rich-content';
import {
  createForumThread,
  toggleForumLike,
  voteForumPoll,
  type ForumThread,
  useForumFeed,
} from '@/hooks/use-forum-feed';
import { useAuth } from '@/providers/auth-provider';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary } from '@/types/cruiser';

type Filter = 'all' | ForumThread['category'];
type ComposerPanel = 'poll' | 'mentions' | 'event' | '';
type PollDuration = 24 | 72 | 168;

const categories: { key: Filter; label: string; composerLabel: string }[] = [
  { key: 'all', label: 'Tümü', composerLabel: 'Kategori seç' },
  { key: 'places', label: 'Rota & Mekan', composerLabel: 'Rota & Mekan' },
  { key: 'builds', label: 'Modifiye', composerLabel: 'Modifiye' },
  { key: 'technical', label: 'Teknik', composerLabel: 'Teknik' },
  { key: 'roadlife', label: 'Yol Hayatı', composerLabel: 'Yol Hayatı' },
];

const categoryLabels = Object.fromEntries(
  categories.filter((category) => category.key !== 'all').map((category) => [
    category.key,
    category.label,
  ]),
) as Record<ForumThread['category'], string>;

export default function ForumScreen() {
  const params = useLocalSearchParams<{ threadId?: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { mapWorld, openDriverProfile, social } = useDriverProfile();
  const { error, loading, threads } = useForumFeed();
  const [filter, setFilter] = useState<Filter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [category, setCategory] = useState<ForumThread['category']>('roadlife');
  const [body, setBody] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<ForumThread['location']>(null);
  const [composerPanel, setComposerPanel] = useState<ComposerPanel>('');
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDurationHours, setPollDurationHours] = useState<PollDuration>(72);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [pendingLikeId, setPendingLikeId] = useState('');
  const [pendingPollThreadId, setPendingPollThreadId] = useState('');

  const mentionCandidates = useMemo(() => {
    const unique = new Map<string, DriverSummary>();
    [...social.friends, ...social.members].forEach((driver) => {
      if (driver.userId && driver.userId !== social.currentUserId) unique.set(driver.userId, driver);
    });
    return [...unique.values()].sort((left, right) =>
      (left.fullName || '').localeCompare(right.fullName || '', 'tr-TR'));
  }, [social.currentUserId, social.friends, social.members]);
  const publicEvents = useMemo(() => mapWorld.activePins
    .filter((pin) => (
      pin.type === 'meet' &&
      pin.visibility === 'public' &&
      !['completed', 'cancelled', 'deleted'].includes(String(pin.lifecycleStatus ?? ''))
    ))
    .sort((left, right) => Number(left.scheduledStartAtMs ?? 0) - Number(right.scheduledStartAtMs ?? 0)),
  [mapWorld.activePins]);

  const visibleThreads = useMemo(
    () => threads.filter((thread) => filter === 'all' || thread.category === filter),
    [filter, threads],
  );
  const routeThreadId = String(params.threadId ?? '');
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === (selectedThreadId || routeThreadId)) ?? null,
    [routeThreadId, selectedThreadId, threads],
  );

  const likeThread = async (thread: ForumThread) => {
    if (pendingLikeId) return;
    setPendingLikeId(thread.id);
    try {
      await toggleForumLike(thread.id);
      void Haptics.selectionAsync();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Beğeni işlemi tamamlanamadı.');
    } finally {
      setPendingLikeId('');
    }
  };

  const resetComposer = () => {
    setBody('');
    setSelectedImage(null);
    setSelectedLocation(null);
    setComposerPanel('');
    setPollEnabled(false);
    setPollOptions(['', '']);
    setPollDurationHours(72);
    setSelectedMentionIds([]);
    setSelectedEventId('');
  };

  const votePoll = async (threadId: string, optionId: string) => {
    if (pendingPollThreadId) return;
    setPendingPollThreadId(threadId);
    try {
      await voteForumPoll(threadId, optionId);
      void Haptics.selectionAsync();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Anket oyu kaydedilemedi.');
    } finally {
      setPendingPollThreadId('');
    }
  };

  const publish = async () => {
    if (body.trim().length < 8) {
      setFeedback('Paylaşım en az 8 karakter olmalıdır.');
      return;
    }
    const normalizedPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
    const normalizedPollKeys = new Set(normalizedPollOptions.map((option) => option.toLocaleLowerCase('tr-TR')));
    if (pollEnabled && (
      normalizedPollOptions.length < 2 ||
      normalizedPollOptions.length > 4 ||
      normalizedPollKeys.size !== normalizedPollOptions.length
    )) {
      setFeedback('Anket için 2-4 benzersiz seçenek girin.');
      return;
    }
    setSubmitting(true);
    setFeedback('');
    try {
      await createForumThread(category, body, {
        image: selectedImage,
        location: selectedLocation,
        poll: pollEnabled
          ? { options: normalizedPollOptions, durationHours: pollDurationHours }
          : null,
        mentionUserIds: selectedMentionIds,
        eventId: selectedEventId,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetComposer();
      setComposerOpen(false);
      setFeedback('Paylaşım yayınlandı.');
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback(error instanceof Error
        ? error.message
        : 'Paylaşım gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMention = (userId: string) => {
    setSelectedMentionIds((current) => {
      if (current.includes(userId)) return current.filter((id) => id !== userId);
      if (current.length >= 5) {
        setFeedback('En fazla 5 kullanıcı etiketleyebilirsiniz.');
        return current;
      }
      return [...current, userId];
    });
  };

  const chooseImage = async () => {
    setFeedback('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFeedback('Görsel seçmek için fotoğraf erişimine izin vermelisin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      exif: false,
      mediaTypes: ['images'],
      quality: 0.86,
      selectionLimit: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (Number(asset.fileSize ?? 0) > 10 * 1024 * 1024) {
      setFeedback('Görsel en fazla 10 MB olabilir.');
      return;
    }
    setSelectedImage(asset);
    void Haptics.selectionAsync();
  };

  const chooseLocation = async () => {
    setFeedback('');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setFeedback('Konum eklemek için konum erişimine izin vermelisiniz.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const addresses = await Location.reverseGeocodeAsync({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    }).catch(() => []);
    const address = addresses[0];
    const label = [address?.district || address?.subregion, address?.city || address?.region]
      .filter(Boolean)
      .join(' / ');
    setSelectedLocation({
      lat: current.coords.latitude,
      lng: current.coords.longitude,
      accuracy: current.coords.accuracy ?? undefined,
      label: label || 'Paylaşılan konum',
    });
    void Haptics.selectionAsync();
  };

  return (
    <ScreenShell
      scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
    >
      <ScrollView
        contentContainerStyle={styles.categoryContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categories}
      >
        {categories.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              void Haptics.selectionAsync();
              setFilter(item.key);
            }}
            style={({ pressed }) => [
              styles.category,
              filter === item.key && styles.categoryActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[
              styles.categoryText,
              filter === item.key && styles.categoryTextActive,
            ]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.avatar}>
          {profile?.avatar ? (
            <Image contentFit="cover" source={{ uri: profile.avatar }} style={styles.avatarImage} />
          ) : (
            <Ionicons color={colors.lime} name="person" size={21} />
          )}
        </View>
        {!composerOpen ? (
          <Pressable
            onPress={() => setComposerOpen(true)}
            style={({ pressed }) => [styles.composerPrompt, pressed && styles.pressed]}
          >
            <Text style={styles.promptText}>Ne paylaşmak istersin?</Text>
          </Pressable>
        ) : (
          <View style={styles.composerBody}>
            <View style={styles.composerTop}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.composerCategories}
              >
                {categories.slice(1).map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setCategory(item.key as ForumThread['category'])}
                    style={[
                      styles.composerCategory,
                      category === item.key && styles.composerCategoryActive,
                    ]}
                  >
                    <Text style={[
                      styles.composerCategoryText,
                      category === item.key && styles.composerCategoryTextActive,
                    ]}>
                      {item.composerLabel}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                accessibilityLabel="Paylaşımı kapat"
                onPress={() => {
                  setComposerOpen(false);
                  resetComposer();
                  setFeedback('');
                }}
                style={styles.closeButton}
              >
                <Ionicons color={colors.textMuted} name="close" size={20} />
              </Pressable>
            </View>
            <TextInput
              multiline
              onChangeText={setBody}
              placeholder="Yoldan, garajdan veya topluluktan bir şey anlat..."
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.lime}
              style={styles.composerInput}
              textAlignVertical="top"
              value={body}
            />
            {selectedImage ? (
              <View style={styles.selectedImage}>
                <Image
                  contentFit="cover"
                  source={{ uri: selectedImage.uri }}
                  style={styles.selectedImagePreview}
                />
                <Pressable
                  accessibilityLabel="Seçilen görseli kaldır"
                  onPress={() => setSelectedImage(null)}
                  style={styles.removeImage}
                >
                  <Ionicons color={colors.white} name="close" size={17} />
                </Pressable>
                <View style={styles.imageReady}>
                  <Ionicons color={colors.lime} name="checkmark-circle" size={15} />
                  <Text style={styles.imageReadyText}>Görsel hazır</Text>
                </View>
              </View>
            ) : null}
            {selectedLocation ? (
              <View style={styles.locationChip}>
                <Ionicons color={colors.lime} name="location" size={16} />
                <Text numberOfLines={1} style={styles.locationChipText}>
                  {selectedLocation.label}
                </Text>
                <Pressable onPress={() => setSelectedLocation(null)}>
                  <Ionicons color={colors.textMuted} name="close" size={17} />
                </Pressable>
              </View>
            ) : null}
            {pollEnabled ? (
              <View style={styles.richEditor}>
                <View style={styles.richEditorHeader}>
                  <View style={styles.richEditorTitleRow}>
                    <Ionicons color={colors.lime} name="stats-chart" size={17} />
                    <Text style={styles.richEditorTitle}>Anket</Text>
                  </View>
                  <Pressable onPress={() => {
                    setPollEnabled(false);
                    setPollOptions(['', '']);
                    if (composerPanel === 'poll') setComposerPanel('');
                  }} style={styles.miniClose}>
                    <Ionicons color={colors.textMuted} name="close" size={17} />
                  </Pressable>
                </View>
                {pollOptions.map((option, index) => (
                  <View key={`poll-${index}`} style={styles.pollInputRow}>
                    <TextInput
                      maxLength={80}
                      onChangeText={(value) => setPollOptions((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? value : item))}
                      placeholder={`Seçenek ${index + 1}`}
                      placeholderTextColor={colors.textFaint}
                      selectionColor={colors.lime}
                      style={styles.pollInput}
                      value={option}
                    />
                    {pollOptions.length > 2 ? (
                      <Pressable onPress={() => setPollOptions((current) => current.filter((_item, itemIndex) => itemIndex !== index))} style={styles.miniClose}>
                        <Ionicons color={colors.rose} name="remove-circle-outline" size={19} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <View style={styles.pollFooterRow}>
                  {pollOptions.length < 4 ? (
                    <Pressable onPress={() => setPollOptions((current) => [...current, ''])} style={styles.addOptionButton}>
                      <Ionicons color={colors.lime} name="add" size={17} />
                      <Text style={styles.addOptionText}>Seçenek ekle</Text>
                    </Pressable>
                  ) : <View />}
                  <View style={styles.durationRow}>
                    {([24, 72, 168] as PollDuration[]).map((duration) => (
                      <Pressable
                        key={duration}
                        onPress={() => setPollDurationHours(duration)}
                        style={[styles.durationChip, pollDurationHours === duration && styles.durationChipActive]}
                      >
                        <Text style={[styles.durationText, pollDurationHours === duration && styles.durationTextActive]}>
                          {duration === 24 ? '1G' : duration === 72 ? '3G' : '7G'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
            {composerPanel === 'mentions' ? (
              <View style={styles.richEditor}>
                <View style={styles.richEditorHeader}>
                  <Text style={styles.richEditorTitle}>Kullanıcı etiketle · {selectedMentionIds.length}/5</Text>
                  <Pressable onPress={() => setComposerPanel('')} style={styles.miniClose}>
                    <Ionicons color={colors.textMuted} name="close" size={17} />
                  </Pressable>
                </View>
                {mentionCandidates.length ? mentionCandidates.map((driver) => {
                  const selectedMention = selectedMentionIds.includes(driver.userId);
                  return (
                    <Pressable key={driver.userId} onPress={() => toggleMention(driver.userId)} style={styles.selectionRow}>
                      <View style={styles.selectionCopy}>
                        <Text style={styles.selectionTitle}>{driver.fullName || 'TrackSnap sürücüsü'}</Text>
                        <Text style={styles.selectionMeta}>{driver.model || 'Araç bilgisi yok'}</Text>
                      </View>
                      <Ionicons color={selectedMention ? colors.lime : colors.textFaint} name={selectedMention ? 'checkmark-circle' : 'ellipse-outline'} size={21} />
                    </Pressable>
                  );
                }) : <Text style={styles.richEmpty}>Etiketleyebileceğiniz arkadaş veya klan üyesi yok.</Text>}
              </View>
            ) : null}
            {composerPanel === 'event' ? (
              <View style={styles.richEditor}>
                <View style={styles.richEditorHeader}>
                  <Text style={styles.richEditorTitle}>Etkinlikten bahset</Text>
                  <Pressable onPress={() => setComposerPanel('')} style={styles.miniClose}>
                    <Ionicons color={colors.textMuted} name="close" size={17} />
                  </Pressable>
                </View>
                {publicEvents.length ? publicEvents.map((event) => (
                  <Pressable key={event.id} onPress={() => setSelectedEventId((current) => current === event.id ? '' : event.id)} style={styles.selectionRow}>
                    <View style={styles.selectionCopy}>
                      <Text style={styles.selectionTitle}>{event.name}</Text>
                      <Text style={styles.selectionMeta}>{event.eventMode === 'convoy' ? 'Konvoy' : 'Buluşma'}</Text>
                    </View>
                    <Ionicons color={selectedEventId === event.id ? colors.lime : colors.textFaint} name={selectedEventId === event.id ? 'checkmark-circle' : 'ellipse-outline'} size={21} />
                  </Pressable>
                )) : <Text style={styles.richEmpty}>Bahsedilebilecek aktif ve herkese açık etkinlik yok.</Text>}
              </View>
            ) : null}
            <View style={styles.composerActions}>
              <View style={styles.futureActions}>
                <Pressable
                  accessibilityLabel="Görsel seç"
                  onPress={() => void chooseImage()}
                  style={({ pressed }) => [styles.mediaAction, pressed && styles.pressed]}
                >
                  <Ionicons
                    color={selectedImage ? colors.lime : colors.textFaint}
                    name="image-outline"
                    size={21}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Konum ekle"
                  onPress={() => void chooseLocation()}
                  style={({ pressed }) => [styles.mediaAction, pressed && styles.pressed]}
                >
                  <Ionicons
                    color={selectedLocation ? colors.lime : colors.textFaint}
                    name="location-outline"
                    size={20}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Anket ekle"
                  onPress={() => {
                    setPollEnabled(true);
                    setComposerPanel('poll');
                  }}
                  style={({ pressed }) => [styles.mediaAction, pressed && styles.pressed]}
                >
                  <Ionicons color={pollEnabled ? colors.lime : colors.textFaint} name="stats-chart-outline" size={20} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Kullanıcı etiketle"
                  onPress={() => setComposerPanel((current) => current === 'mentions' ? '' : 'mentions')}
                  style={({ pressed }) => [styles.mediaAction, pressed && styles.pressed]}
                >
                  <Ionicons color={selectedMentionIds.length ? colors.lime : colors.textFaint} name="at-outline" size={21} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Etkinlikten bahset"
                  onPress={() => setComposerPanel((current) => current === 'event' ? '' : 'event')}
                  style={({ pressed }) => [styles.mediaAction, pressed && styles.pressed]}
                >
                  <Ionicons color={selectedEventId ? colors.lime : colors.textFaint} name="calendar-outline" size={20} />
                </Pressable>
              </View>
              <Pressable
                accessibilityLabel="Paylaş"
                disabled={submitting}
                onPress={() => void publish()}
                style={({ pressed }) => [
                  styles.publish,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.black} size="small" />
                ) : (
                  <Ionicons color={colors.black} name="paper-plane" size={19} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {feedback ? (
        <Text style={[
          styles.feedback,
          feedback.includes('yayınlandı') && styles.feedbackSuccess,
        ]}>
          {feedback}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.lime} />
        </View>
      ) : null}
      {!loading && error ? (
        <View style={styles.state}>
          <Ionicons color={colors.rose} name="cloud-offline-outline" size={22} />
          <Text style={styles.stateText}>Akış şu anda yüklenemiyor.</Text>
        </View>
      ) : null}
      {!loading && !error && visibleThreads.length === 0 ? (
        <View style={styles.state}>
          <Ionicons color={colors.textFaint} name="chatbubble-ellipses-outline" size={26} />
          <Text style={styles.stateTitle}>Henüz paylaşım yok</Text>
          <Text style={styles.stateText}>Bu kategoride ilk paylaşımı sen yap.</Text>
        </View>
      ) : null}

      {visibleThreads.map((thread) => (
        <ThreadCard
          key={thread.id}
          likePending={pendingLikeId === thread.id}
          pollPending={pendingPollThreadId === thread.id}
          onOpen={() => setSelectedThreadId(thread.id)}
          onOpenDriver={(driver) => void openDriverProfile(driver)}
          onOpenEvent={(eventId) => router.push({ pathname: '/(tabs)/map', params: { pinId: eventId } })}
          onToggleLike={() => void likeThread(thread)}
          onVotePoll={(optionId) => void votePoll(thread.id, optionId)}
          thread={thread}
        />
      ))}

      <ForumThreadDetail
        currentUserId={profile?.firebaseUid}
        onClose={() => {
          setSelectedThreadId('');
          if (params.threadId) router.replace('/(tabs)/forum');
        }}
        onOpenDriver={(driver) => void openDriverProfile(driver)}
        thread={selectedThread}
      />
    </ScreenShell>
  );
}

function ThreadCard({
  likePending,
  pollPending,
  onOpen,
  onOpenDriver,
  onOpenEvent,
  onToggleLike,
  onVotePoll,
  thread,
}: {
  likePending: boolean;
  pollPending: boolean;
  onOpen: () => void;
  onOpenDriver: (driver: DriverSummary) => void;
  onOpenEvent: (eventId: string) => void;
  onToggleLike: () => void;
  onVotePoll: (optionId: string) => void;
  thread: ForumThread;
}) {
  return (
    <View style={styles.thread}>
      <Pressable
        accessibilityLabel={`${thread.authorName} sürücü profilini aç`}
        disabled={!thread.authorUserId}
        onPress={() => onOpenDriver({
          userId: thread.authorUserId,
          fullName: thread.authorName,
          plate: thread.authorPlate,
          model: thread.authorModel,
        })}
        style={({ pressed }) => [styles.threadHeader, pressed && styles.authorPressed]}
      >
        <View style={styles.threadAvatar}>
          <Text style={styles.threadInitial}>
            {(thread.authorName || 'C').trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.threadIdentity}>
          <Text numberOfLines={1} style={styles.threadName}>{thread.authorName}</Text>
          <Text numberOfLines={1} style={styles.threadModel}>{thread.authorModel}</Text>
        </View>
        <Text style={styles.threadCategory}>{categoryLabels[thread.category]}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </Pressable>
      <Pressable onPress={onOpen} style={({ pressed }) => pressed && styles.authorPressed}>
        <Text style={styles.threadBody}>{thread.body}</Text>
          {thread.imageUrl ? (
        <Image
          contentFit="cover"
          source={{ uri: thread.imageUrl }}
          style={styles.threadImage}
          transition={180}
        />
          ) : null}
          {thread.location?.label ? (
            <View style={styles.threadLocation}>
              <Ionicons color={colors.lime} name="location-outline" size={14} />
              <Text style={styles.threadLocationText}>{thread.location.label}</Text>
            </View>
          ) : null}
      </Pressable>
      {thread.mentions?.length ? (
        <ForumMentionRow
          mentions={thread.mentions}
          onOpenDriver={(mention) => onOpenDriver({
            userId: mention.userId,
            fullName: mention.fullName,
            model: mention.model,
          })}
        />
      ) : null}
      {thread.eventReference ? (
        <ForumEventCard
          event={thread.eventReference}
          onOpen={() => onOpenEvent(thread.eventReference!.eventId)}
        />
      ) : null}
      {thread.poll ? (
        <ForumPollCard
          busy={pollPending}
          onVote={onVotePoll}
          poll={thread.poll}
          selectedOptionId={thread.viewerPollOptionId}
        />
      ) : null}
      <View style={styles.threadActions}>
        <Pressable
          accessibilityLabel={thread.likedByViewer ? 'Beğeniyi kaldır' : 'Gönderiyi beğen'}
          disabled={likePending}
          onPress={onToggleLike}
          style={styles.threadAction}
        >
          {likePending ? (
            <ActivityIndicator color={colors.rose} size="small" />
          ) : (
            <Ionicons
              color={thread.likedByViewer ? colors.rose : colors.textMuted}
              name={thread.likedByViewer ? 'heart' : 'heart-outline'}
              size={19}
            />
          )}
          <Text style={styles.actionCount}>{thread.likeCount || 0}</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.threadAction}>
          <Ionicons color={colors.textMuted} name="chatbubble-outline" size={18} />
          <Text style={styles.actionCount}>{thread.replyCount || 0}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Gönderi detayını aç" onPress={onOpen} style={styles.openThread}>
          <Text style={styles.openThreadText}>Konuşmayı gör</Text>
          <Ionicons color={colors.textFaint} name="chevron-forward" size={15} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = createThemedStyles(() => ({
  categories: { marginHorizontal: -14, marginTop: -8 },
  categoryContent: { paddingHorizontal: 14, gap: 8 },
  category: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryActive: { borderColor: colors.lime, backgroundColor: colors.limeMuted },
  categoryText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 12 },
  categoryTextActive: { color: colors.limeBright },
  composer: {
    minHeight: 72,
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  avatar: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  composerPrompt: { flex: 1, minHeight: 44, justifyContent: 'center' },
  promptText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  composerBody: { flex: 1, gap: 10 },
  composerTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerCategories: { flex: 1 },
  composerCategory: {
    minHeight: 34,
    marginRight: 6,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: colors.backgroundRaised,
    justifyContent: 'center',
  },
  composerCategoryActive: { backgroundColor: colors.limeMuted },
  composerCategoryText: { color: colors.textFaint, fontFamily: fonts.semibold, fontSize: 10 },
  composerCategoryTextActive: { color: colors.limeBright },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    minHeight: 108,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedImage: {
    height: 176,
    overflow: 'hidden',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
  },
  selectedImagePreview: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageReady: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imageReadyText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  locationChip: {
    minHeight: 42,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  locationChipText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  richEditor: {
    padding: 11,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundRaised,
    gap: 8,
  },
  richEditorHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  richEditorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  richEditorTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  miniClose: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pollInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pollInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  pollFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  addOptionButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addOptionText: { color: colors.limeBright, fontFamily: fonts.bold, fontSize: 9 },
  durationRow: { flexDirection: 'row', gap: 5 },
  durationChip: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipActive: { borderColor: colors.lime, backgroundColor: colors.limeMuted },
  durationText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9 },
  durationTextActive: { color: colors.limeBright },
  selectionRow: {
    minHeight: 52,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionCopy: { flex: 1 },
  selectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  selectionMeta: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  richEmpty: { paddingVertical: 14, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center' },
  futureActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 1 },
  mediaAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publish: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: {
    marginTop: -4,
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  feedbackSuccess: { color: colors.limeBright },
  state: {
    minHeight: 150,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    marginTop: 12,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  stateText: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  thread: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  threadHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorPressed: { opacity: 0.72, transform: [{ scale: 0.988 }] },
  threadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadInitial: { color: colors.lime, fontFamily: fonts.extraBold, fontSize: 16 },
  threadIdentity: { flex: 1 },
  threadName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  threadModel: { marginTop: 2, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 10 },
  threadCategory: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  threadBody: {
    marginTop: 14,
    color: '#d9ddd5',
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  threadImage: {
    width: '100%',
    aspectRatio: 1.45,
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: colors.backgroundRaised,
  },
  threadLocation: {
    alignSelf: 'flex-start',
    minHeight: 34,
    marginTop: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  threadLocationText: {
    color: colors.limeBright,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  threadActions: {
    minHeight: 42,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  threadAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openThread: { marginLeft: 'auto', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 3 },
  openThreadText: { color: colors.textFaint, fontFamily: fonts.semibold, fontSize: 10 },
  actionCount: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
}));
