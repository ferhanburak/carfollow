import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addForumReply,
  pinForumSolution,
  toggleForumLike,
  type ForumReply,
  type ForumThread,
} from '@/hooks/use-forum-feed';
import { useSocialWorld } from '@/hooks/use-social-world';
import { useAppData } from '@/providers/app-data-provider';
import { colors, fonts } from '@/theme/colors';
import type { DriverSummary } from '@/types/cruiser';

const categoryLabels: Record<ForumThread['category'], string> = {
  places: 'Rota & Mekan',
  builds: 'Modifiye',
  technical: 'Teknik',
  roadlife: 'Yol Hayatı',
};

type Props = {
  currentUserId?: string;
  onClose: () => void;
  onOpenDriver: (driver: DriverSummary) => void;
  thread: ForumThread | null;
};

export function ForumThreadDetail({ currentUserId, onClose, onOpenDriver, thread }: Props) {
  const appData = useAppData();
  const social = useSocialWorld();
  const [replyBody, setReplyBody] = useState('');
  const [pendingKey, setPendingKey] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  if (!thread) return null;

  const closeDetail = () => {
    setReplyBody('');
    setFeedback('');
    setPendingKey('');
    setShareOpen(false);
    setSelectedFriendIds([]);
    onClose();
  };

  const openShare = () => {
    setFeedback('');
    setShareOpen(true);
  };

  const canPinSolution = (
    thread.authorUserId === currentUserId &&
    (thread.category === 'technical' || thread.category === 'builds')
  );

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    if (pendingKey) return;
    setPendingKey(key);
    setFeedback('');
    try {
      await action();
      void Haptics.selectionAsync();
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    } finally {
      setPendingKey('');
    }
  };

  const submitReply = () => {
    if (replyBody.trim().length < 2) {
      setFeedback('Yanıt en az 2 karakter olmalıdır.');
      return;
    }
    void runAction('reply', async () => {
      await addForumReply(thread.id, replyBody);
      setReplyBody('');
    });
  };

  const openDriver = (reply?: ForumReply) => {
    const source = reply ?? thread;
    onOpenDriver({
      userId: source.authorUserId,
      fullName: source.authorName,
      plate: source.authorPlate,
      model: source.authorModel,
    });
  };

  const sendToFriends = () => {
    if (!selectedFriendIds.length) return;
    void runAction('share', async () => {
      await Promise.all(selectedFriendIds.map((targetUserId) => appData.sendMessage(
        targetUserId,
        'Bir forum gönderisi paylaştı.',
        {
          type: 'forum',
          targetId: thread.id,
          title: categoryLabels[thread.category],
          preview: thread.body.slice(0, 280),
          imageUrl: thread.imageUrl || '',
        },
      )));
      setShareOpen(false);
      setSelectedFriendIds([]);
      setFeedback('Gönderi mesaj olarak iletildi.');
    });
  };

  return (
    <>
    <Modal animationType="slide" onRequestClose={closeDetail} visible transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Foruma dön" onPress={closeDetail} style={styles.iconButton}>
              <Ionicons color={colors.text} name="arrow-back" size={22} />
            </Pressable>
            <Text style={styles.topTitle}>Gönderi</Text>
            <Pressable
              accessibilityLabel="Gönderiyi paylaş"
              onPress={openShare}
              style={styles.iconButton}
            >
              <Ionicons color={colors.textMuted} name="share-outline" size={21} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.post}>
              <AuthorRow
                category={categoryLabels[thread.category]}
                date={formatDate(thread.createdAt?.toDate?.())}
                model={thread.authorModel}
                name={thread.authorName}
                onPress={() => openDriver()}
              />
              <Text style={styles.postBody}>{thread.body}</Text>
              {thread.imageUrl ? (
                <Image contentFit="cover" source={{ uri: thread.imageUrl }} style={styles.postImage} />
              ) : null}
              {thread.location?.label ? (
                <View style={styles.locationRow}>
                  <Ionicons color={colors.lime} name="location-outline" size={16} />
                  <Text style={styles.locationText}>{thread.location.label}</Text>
                </View>
              ) : null}
              <Text style={styles.timestamp}>{formatLongDate(thread.createdAt?.toDate?.())}</Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}><Text style={styles.metricValue}>{thread.likeCount || 0}</Text> beğeni</Text>
                <Text style={styles.metric}><Text style={styles.metricValue}>{thread.replyCount || 0}</Text> yanıt</Text>
              </View>
              <View style={styles.postActions}>
                <Pressable
                  accessibilityLabel={thread.likedByViewer ? 'Beğeniyi kaldır' : 'Gönderiyi beğen'}
                  disabled={Boolean(pendingKey)}
                  onPress={() => void runAction('thread-like', () => toggleForumLike(thread.id))}
                  style={styles.actionButton}
                >
                  {pendingKey === 'thread-like' ? (
                    <ActivityIndicator color={colors.rose} size="small" />
                  ) : (
                    <Ionicons
                      color={thread.likedByViewer ? colors.rose : colors.textMuted}
                      name={thread.likedByViewer ? 'heart' : 'heart-outline'}
                      size={22}
                    />
                  )}
                </Pressable>
                <Pressable accessibilityLabel="Yanıt alanına git" style={styles.actionButton}>
                  <Ionicons color={colors.textMuted} name="chatbubble-outline" size={21} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Gönderiyi paylaş"
                  onPress={openShare}
                  style={styles.actionButton}
                >
                  <Ionicons color={colors.textMuted} name="share-outline" size={21} />
                </Pressable>
              </View>
            </View>

            <View style={styles.replyComposer}>
              <View style={styles.replyAvatar}>
                <Ionicons color={colors.lime} name="person" size={18} />
              </View>
              <TextInput
                multiline
                onChangeText={setReplyBody}
                placeholder="Yanıtını gönder"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.lime}
                style={styles.replyInput}
                value={replyBody}
              />
              <Pressable
                accessibilityLabel="Yanıtla"
                disabled={pendingKey === 'reply'}
                onPress={submitReply}
                style={[styles.sendButton, (!replyBody.trim() || pendingKey === 'reply') && styles.buttonDisabled]}
              >
                {pendingKey === 'reply' ? (
                  <ActivityIndicator color={colors.black} size="small" />
                ) : (
                  <Ionicons color={colors.black} name="arrow-up" size={19} />
                )}
              </Pressable>
            </View>

            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

            {thread.replies.length === 0 ? (
              <View style={styles.emptyReplies}>
                <Text style={styles.emptyTitle}>Henüz yanıt yok</Text>
                <Text style={styles.emptyText}>Bu konuşmaya ilk katkıyı sen yap.</Text>
              </View>
            ) : thread.replies.map((reply) => {
              const pinned = thread.pinnedReplyId === reply.id;
              const pinLabel = thread.category === 'technical' ? 'Çözüm' : 'En yararlı cevap';
              return (
                <View key={reply.id} style={[styles.reply, pinned && styles.pinnedReply]}>
                  {pinned ? (
                    <View style={styles.solutionBadge}>
                      <Ionicons color={colors.black} name="checkmark-circle" size={15} />
                      <Text style={styles.solutionBadgeText}>{pinLabel}</Text>
                    </View>
                  ) : null}
                  <AuthorRow
                    date={formatDate(reply.createdAt?.toDate?.())}
                    model={reply.authorModel}
                    name={reply.authorName}
                    onPress={() => openDriver(reply)}
                  />
                  <Text style={styles.replyBody}>{reply.body}</Text>
                  <View style={styles.replyFooter}>
                    <Pressable
                      accessibilityLabel={reply.likedByViewer ? 'Yanıt beğenisini kaldır' : 'Yanıtı beğen'}
                      disabled={Boolean(pendingKey)}
                      onPress={() => void runAction(`reply-like-${reply.id}`, () => toggleForumLike(thread.id, reply.id))}
                      style={styles.replyLike}
                    >
                      {pendingKey === `reply-like-${reply.id}` ? (
                        <ActivityIndicator color={colors.rose} size="small" />
                      ) : (
                        <Ionicons
                          color={reply.likedByViewer ? colors.rose : colors.textMuted}
                          name={reply.likedByViewer ? 'heart' : 'heart-outline'}
                          size={18}
                        />
                      )}
                      <Text style={[styles.replyLikeCount, reply.likedByViewer && styles.likedText]}>
                        {reply.likeCount || 0}
                      </Text>
                    </Pressable>
                    {canPinSolution ? (
                      <Pressable
                        disabled={Boolean(pendingKey)}
                        onPress={() => void runAction(`pin-${reply.id}`, () => pinForumSolution(thread.id, reply.id))}
                        style={[styles.pinButton, pinned && styles.pinButtonActive]}
                      >
                        <Ionicons color={pinned ? colors.black : colors.lime} name="checkmark-circle-outline" size={16} />
                        <Text style={[styles.pinButtonText, pinned && styles.pinButtonTextActive]}>
                          {pinned ? 'Sabitlemeyi kaldır' : `${pinLabel} olarak sabitle`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
    <Modal animationType="fade" onRequestClose={() => setShareOpen(false)} transparent visible={shareOpen}>
      <View style={styles.shareBackdrop}>
        <View style={styles.shareSheet}>
          <View style={styles.shareHeader}>
            <View>
              <Text style={styles.shareTitle}>Arkadaşlarına Gönder</Text>
              <Text style={styles.shareSubtitle}>Gönderi seçtiğin sohbetlere kart olarak iletilir.</Text>
            </View>
            <Pressable onPress={() => setShareOpen(false)} style={styles.iconButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.friendList} showsVerticalScrollIndicator={false}>
            {social.friends.length ? social.friends.map((friend) => {
              const selected = selectedFriendIds.includes(friend.userId);
              return (
                <Pressable
                  key={friend.userId}
                  onPress={() => setSelectedFriendIds((current) => selected
                    ? current.filter((userId) => userId !== friend.userId)
                    : [...current, friend.userId])}
                  style={[styles.friendRow, selected && styles.friendRowSelected]}
                >
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendInitial}>{(friend.fullName || 'C').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName}>{friend.fullName || 'CRUISER sürücüsü'}</Text>
                    <Text style={styles.friendModel}>{friend.model || 'Araç bilgisi yok'}</Text>
                  </View>
                  <Ionicons
                    color={selected ? colors.lime : colors.textFaint}
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                  />
                </Pressable>
              );
            }) : (
              <Text style={styles.noFriends}>Gönderiyi iletebileceğin bir arkadaşın henüz yok.</Text>
            )}
          </ScrollView>
          <Pressable
            disabled={!selectedFriendIds.length || pendingKey === 'share'}
            onPress={sendToFriends}
            style={[styles.shareButton, (!selectedFriendIds.length || pendingKey === 'share') && styles.buttonDisabled]}
          >
            {pendingKey === 'share' ? <ActivityIndicator color={colors.black} /> : (
              <>
                <Ionicons color={colors.black} name="send" size={18} />
                <Text style={styles.shareButtonText}>Gönder ({selectedFriendIds.length})</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

function AuthorRow({ category, date, model, name, onPress }: {
  category?: string;
  date: string;
  model?: string;
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}>
      <View style={styles.authorAvatar}>
        <Text style={styles.authorInitial}>{(name || 'C').trim().charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.authorIdentity}>
        <View style={styles.authorNameRow}>
          <Text numberOfLines={1} style={styles.authorName}>{name}</Text>
          <Text style={styles.authorDate}>· {date}</Text>
        </View>
        <Text numberOfLines={1} style={styles.authorMeta}>{model || 'Araç bilgisi yok'}{category ? `  ·  ${category}` : ''}</Text>
      </View>
      <Ionicons color={colors.textFaint} name="ellipsis-horizontal" size={18} />
    </Pressable>
  );
}

function formatDate(date?: Date) {
  if (!date) return 'şimdi';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date);
}

function formatLongDate(date?: Date) {
  if (!date) return 'Şimdi';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17 },
  iconButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 40 },
  post: { padding: 17, borderBottomWidth: 1, borderBottomColor: colors.border },
  authorRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.limeMuted,
    borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  authorInitial: { color: colors.lime, fontFamily: fonts.extraBold, fontSize: 16 },
  authorIdentity: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { maxWidth: '70%', color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  authorDate: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 11 },
  authorMeta: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  postBody: { marginTop: 15, color: colors.text, fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 },
  postImage: { width: '100%', aspectRatio: 1.25, marginTop: 15, borderRadius: 19, backgroundColor: colors.surface },
  locationRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: colors.limeBright, fontFamily: fonts.semibold, fontSize: 11 },
  timestamp: { marginTop: 16, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 11 },
  metrics: { minHeight: 45, marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 20 },
  metric: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  metricValue: { color: colors.text, fontFamily: fonts.bold },
  postActions: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  actionButton: { width: 54, height: 44, alignItems: 'center', justifyContent: 'center' },
  replyComposer: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.limeMuted, alignItems: 'center', justifyContent: 'center' },
  replyInput: { flex: 1, maxHeight: 110, minHeight: 46, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 18, backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.regular, fontSize: 13 },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.55 },
  feedback: { paddingHorizontal: 16, paddingVertical: 8, color: colors.rose, fontFamily: fonts.semibold, fontSize: 11 },
  emptyReplies: { minHeight: 150, padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  emptyText: { marginTop: 5, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  reply: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  pinnedReply: { backgroundColor: 'rgba(163,230,53,0.055)', borderLeftWidth: 3, borderLeftColor: colors.lime },
  solutionBadge: { alignSelf: 'flex-start', minHeight: 29, marginBottom: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 5 },
  solutionBadgeText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
  replyBody: { marginLeft: 52, marginTop: 7, color: '#d9ddd5', fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  replyFooter: { minHeight: 44, marginLeft: 52, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  replyLike: { minWidth: 50, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyLikeCount: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  likedText: { color: colors.rose },
  pinButton: { minHeight: 36, maxWidth: '72%', paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  pinButtonActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  pinButtonText: { color: colors.limeBright, fontFamily: fonts.bold, fontSize: 9 },
  pinButtonTextActive: { color: colors.black },
  pressed: { opacity: 0.72 },
  shareBackdrop: { flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  shareSheet: { maxHeight: '76%', padding: 16, borderRadius: 28, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.backgroundRaised },
  shareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  shareTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17 },
  shareSubtitle: { maxWidth: 280, marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  friendList: { paddingVertical: 13, gap: 8 },
  friendRow: { minHeight: 62, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendRowSelected: { borderColor: colors.lime, backgroundColor: colors.limeMuted },
  friendAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  friendInitial: { color: colors.lime, fontFamily: fonts.extraBold, fontSize: 14 },
  friendCopy: { flex: 1 },
  friendName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  friendModel: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  noFriends: { paddingVertical: 30, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
  shareButton: { minHeight: 52, borderRadius: 18, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareButtonText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 13 },
});
