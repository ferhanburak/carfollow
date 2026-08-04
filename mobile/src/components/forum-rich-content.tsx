import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { LocalizedPressable as Pressable, LocalizedText as Text } from '@/components/localized-text';
import type {
  ForumEventReference,
  ForumMention,
  ForumPoll,
} from '@/hooks/use-forum-feed';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

export function ForumPollCard({
  busy,
  onVote,
  poll,
  selectedOptionId,
}: {
  busy?: boolean;
  onVote: (optionId: string) => void;
  poll: ForumPoll;
  selectedOptionId?: string;
}) {
  const [renderedAt] = useState(() => Date.now());
  const expired = poll.expiresAtMs <= renderedAt;
  const showResults = Boolean(selectedOptionId) || expired;

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <View style={styles.inlineLabel}>
          <Ionicons color={colors.lime} name="stats-chart" size={16} />
          <Text style={styles.pollTitle}>Anket</Text>
        </View>
        <Text style={styles.pollMeta}>
          {expired ? 'Sona erdi' : formatRemainingTime(poll.expiresAtMs, renderedAt)}
        </Text>
      </View>
      <View style={styles.pollOptions}>
        {poll.options.map((option) => {
          const selected = selectedOptionId === option.id;
          const percentage = poll.totalVotes > 0
            ? Math.round((option.voteCount / poll.totalVotes) * 100)
            : 0;
          return (
            <Pressable
              accessibilityRole="button"
              disabled={busy || expired}
              key={option.id}
              onPress={() => onVote(option.id)}
              style={({ pressed }) => [
                styles.pollOption,
                selected && styles.pollOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              {showResults ? (
                <View style={[styles.pollProgress, { width: `${percentage}%` }]} />
              ) : null}
              <View style={styles.pollOptionContent}>
                <View style={styles.pollOptionIdentity}>
                  <Ionicons
                    color={selected ? colors.lime : colors.textFaint}
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                  />
                  <Text numberOfLines={2} style={styles.pollOptionText}>{option.text}</Text>
                </View>
                {showResults ? <Text style={styles.pollPercentage}>%{percentage}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.pollFooter}>{poll.totalVotes || 0} oy</Text>
    </View>
  );
}

export function ForumMentionRow({
  mentions,
  onOpenDriver,
}: {
  mentions: ForumMention[];
  onOpenDriver: (mention: ForumMention) => void;
}) {
  if (!mentions.length) return null;
  return (
    <View style={styles.mentionRow}>
      <Ionicons color={colors.lime} name="at" size={16} />
      <View style={styles.mentionList}>
        {mentions.map((mention) => (
          <Pressable
            key={mention.userId}
            onPress={() => onOpenDriver(mention)}
            style={({ pressed }) => [styles.mentionChip, pressed && styles.pressed]}
          >
            <Text style={styles.mentionText}>@{mention.fullName}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ForumEventCard({
  event,
  onOpen,
}: {
  event: ForumEventReference;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
      <View style={styles.eventIcon}>
        <Ionicons
          color={colors.black}
          name={event.eventMode === 'convoy' ? 'navigate' : 'people'}
          size={19}
        />
      </View>
      <View style={styles.eventCopy}>
        <Text style={styles.eventLabel}>
          {event.eventMode === 'convoy' ? 'Konvoy' : 'Buluşma'}
        </Text>
        <Text numberOfLines={1} style={styles.eventName}>{event.name}</Text>
        {event.scheduledStartAtMs ? (
          <Text style={styles.eventDate}>{formatEventDate(event.scheduledStartAtMs)}</Text>
        ) : null}
      </View>
      <Ionicons color={colors.textFaint} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function formatRemainingTime(expiresAtMs: number, renderedAt: number) {
  const hours = Math.max(1, Math.ceil((expiresAtMs - renderedAt) / (60 * 60 * 1000)));
  if (hours < 24) return `${hours} sa kaldı`;
  return `${Math.ceil(hours / 24)} gün kaldı`;
}

function formatEventDate(value: number) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const styles = createThemedStyles(() => ({
  pressed: { opacity: 0.72 },
  inlineLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pollCard: {
    marginTop: 13,
    padding: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  pollHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pollTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  pollMeta: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  pollOptions: { marginTop: 10, gap: 8 },
  pollOption: {
    minHeight: 48,
    overflow: 'hidden',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    justifyContent: 'center',
  },
  pollOptionSelected: { borderColor: colors.lime },
  pollProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    top: 0,
    minWidth: 4,
    backgroundColor: colors.limeMuted,
  },
  pollOptionContent: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pollOptionIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollOptionText: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 11 },
  pollPercentage: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 11 },
  pollFooter: { marginTop: 9, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  mentionRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  mentionList: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mentionChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    justifyContent: 'center',
  },
  mentionText: { color: colors.limeBright, fontFamily: fonts.bold, fontSize: 10 },
  eventCard: {
    minHeight: 72,
    marginTop: 12,
    padding: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  eventIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCopy: { flex: 1 },
  eventLabel: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 8, textTransform: 'uppercase', letterSpacing: 1 },
  eventName: { marginTop: 3, color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  eventDate: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
}));
