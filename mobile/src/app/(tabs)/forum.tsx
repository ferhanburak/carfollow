import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import {
  createForumThread,
  type ForumThread,
  useForumFeed,
} from '@/hooks/use-forum-feed';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';

type Filter = 'all' | ForumThread['category'];

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
  const { profile } = useAuth();
  const { error, loading, threads } = useForumFeed();
  const [filter, setFilter] = useState<Filter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [category, setCategory] = useState<ForumThread['category']>('roadlife');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const visibleThreads = useMemo(
    () => threads.filter((thread) => filter === 'all' || thread.category === filter),
    [filter, threads],
  );

  const publish = async () => {
    if (body.trim().length < 8) {
      setFeedback('Paylaşım en az 8 karakter olmalıdır.');
      return;
    }
    setSubmitting(true);
    setFeedback('');
    try {
      await createForumThread(category, body);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBody('');
      setComposerOpen(false);
      setFeedback('Paylaşım yayınlandı.');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback('Paylaşım gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
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
                  setBody('');
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
            <View style={styles.composerActions}>
              <View style={styles.futureActions}>
                <Ionicons color={colors.textFaint} name="image-outline" size={20} />
                <Ionicons color={colors.textFaint} name="location-outline" size={20} />
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
        <ThreadCard key={thread.id} thread={thread} />
      ))}
    </ScreenShell>
  );
}

function ThreadCard({ thread }: { thread: ForumThread }) {
  return (
    <View style={styles.thread}>
      <View style={styles.threadHeader}>
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
      </View>
      <Text style={styles.threadBody}>{thread.body}</Text>
      {thread.imageUrl ? (
        <Image
          contentFit="cover"
          source={{ uri: thread.imageUrl }}
          style={styles.threadImage}
          transition={180}
        />
      ) : null}
      <View style={styles.threadActions}>
        <View style={styles.threadAction}>
          <Ionicons color={colors.textMuted} name="heart-outline" size={19} />
          <Text style={styles.actionCount}>{thread.likeCount || 0}</Text>
        </View>
        <View style={styles.threadAction}>
          <Ionicons color={colors.textMuted} name="chatbubble-outline" size={18} />
          <Text style={styles.actionCount}>{thread.replyCount || 0}</Text>
        </View>
        <Ionicons color={colors.textFaint} name="share-outline" size={19} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  futureActions: { flexDirection: 'row', gap: 16, paddingLeft: 4 },
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
  threadActions: {
    minHeight: 42,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  threadAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
