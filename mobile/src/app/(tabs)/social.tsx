import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenShell, Surface } from '@/components/screen-shell';
import { useSocialWorld } from '@/hooks/use-social-world';
import { useAppData } from '@/providers/app-data-provider';
import { colors, fonts } from '@/theme/colors';
import type { DirectMessageThread, DriverSummary } from '@/types/cruiser';

type Section = 'connections' | 'clan' | 'messages';

export default function SocialScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const social = useSocialWorld();
  const appData = useAppData();
  const [section, setSection] = useState<Section>(
    params.section === 'messages' ? 'messages' : 'connections',
  );
  const [plate, setPlate] = useState('');
  const [searchResult, setSearchResult] = useState<DriverSummary | null>(null);
  const [searchComplete, setSearchComplete] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeThread, setActiveThread] = useState<DirectMessageThread | null>(null);
  const [message, setMessage] = useState('');

  const currentThread = activeThread
    ? appData.threads.find((item) => item.id === activeThread.id) ?? activeThread
    : null;

  const announce = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 2600);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const search = async () => {
    if (plate.replace(/\s/g, '').length < 5) {
      setNotice('Eksiksiz bir plaka girin.');
      return;
    }
    try {
      const driver = await social.searchPlate(plate);
      setSearchResult(driver);
      setSearchComplete(true);
    } catch {
      setSearchComplete(true);
    }
  };

  const openChat = async (driver: DriverSummary) => {
    try {
      const threadId = await appData.openThread(driver.userId);
      const existing = appData.threads.find((item) => item.id === threadId);
      setActiveThread(existing ?? {
        id: threadId,
        participantUserId: driver.userId,
        participantName: driver.fullName || driver.plate || 'CRUISER sürücüsü',
        participantPlate: driver.plate || '',
        participantModel: driver.model || 'Araç bilgisi yok',
        messages: [],
        lastReadAt: 0,
        updatedAt: 0,
      });
      await appData.markThreadRead(threadId);
    } catch {
      setNotice('Sohbet açılamadı.');
    }
  };

  return (
    <ScreenShell scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <View style={styles.sections}>
        <SectionButton
          active={section === 'connections'}
          icon="people"
          label="Bağlantılar"
          onPress={() => setSection('connections')}
        />
        <SectionButton
          active={section === 'clan'}
          icon="shield"
          label="Klan"
          onPress={() => setSection('clan')}
        />
        <SectionButton
          active={section === 'messages'}
          badge={appData.unreadConversationCount}
          icon="chatbubbles"
          label="Mesajlar"
          onPress={() => setSection('messages')}
        />
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {social.error ? <Text style={styles.error}>{social.error}</Text> : null}

      {section === 'connections' ? (
        <>
          <Surface accent>
            <Text style={styles.sectionTitle}>Plakadan Sürücü Bul</Text>
            <View style={styles.searchRow}>
              <TextInput
                autoCapitalize="characters"
                maxLength={16}
                onChangeText={(value) => {
                  setPlate(value.toUpperCase());
                  setSearchComplete(false);
                  setSearchResult(null);
                }}
                onSubmitEditing={() => void search()}
                placeholder="06 ABC 123"
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
                value={plate}
              />
              <Pressable
                disabled={social.busy === 'search'}
                onPress={() => void search()}
                style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
              >
                {social.busy === 'search'
                  ? <ActivityIndicator color={colors.black} />
                  : <Ionicons name="search" color={colors.black} size={21} />}
              </Pressable>
            </View>
            {searchResult ? (
              <DriverCard
                driver={searchResult}
                actions={[
                  {
                    icon: 'person-add',
                    label: 'Arkadaş Ekle',
                    onPress: async () => {
                      try {
                        await social.requestFriend(searchResult.userId);
                        announce('Arkadaşlık isteği gönderildi.');
                      } catch {}
                    },
                  },
                  ...(social.currentClan ? [{
                    icon: 'shield' as const,
                    label: 'Klana Davet Et',
                    onPress: async () => {
                      try {
                        await social.inviteClan(searchResult.userId);
                        announce('Klan daveti gönderildi.');
                      } catch {}
                    },
                  }] : []),
                ]}
              />
            ) : searchComplete ? (
              <Text style={styles.empty}>Bu plakaya ait erişilebilir bir sürücü bulunamadı.</Text>
            ) : null}
          </Surface>

          <DriverGroup
            empty="Yeni arkadaşlık isteğiniz yok."
            title={`Gelen İstekler · ${social.incoming.length}`}
          >
            {social.incoming.map((driver) => (
              <DriverCard
                driver={driver}
                key={driver.userId}
                actions={[
                  {
                    icon: 'checkmark',
                    label: 'Kabul Et',
                    primary: true,
                    onPress: async () => {
                      try {
                        await social.respondFriend(driver.userId, 'accepted');
                        announce(`${driver.fullName || 'Sürücü'} ile artık arkadaşsınız.`);
                      } catch {}
                    },
                  },
                  {
                    icon: 'close',
                    label: 'Reddet',
                    onPress: () => social.respondFriend(driver.userId, 'declined'),
                  },
                ]}
              />
            ))}
          </DriverGroup>

          <DriverGroup empty="Gönderilmiş istek yok." title={`Giden İstekler · ${social.outgoing.length}`}>
            {social.outgoing.map((driver) => (
              <DriverCard
                driver={driver}
                key={driver.userId}
                actions={[{
                  icon: 'close',
                  label: 'Geri Çek',
                  onPress: () => social.cancelFriend(driver.userId),
                }]}
              />
            ))}
          </DriverGroup>

          <DriverGroup empty="Henüz arkadaşınız yok." title={`Arkadaşlar · ${social.friends.length}`}>
            {social.friends.map((driver) => (
              <DriverCard
                driver={driver}
                key={driver.userId}
                actions={[
                  {
                    icon: 'chatbubble',
                    label: 'Mesaj',
                    primary: true,
                    onPress: () => openChat(driver),
                  },
                  ...(social.currentClan ? [{
                    icon: 'shield' as const,
                    label: 'Klana Davet',
                    onPress: async () => {
                      try {
                        await social.inviteClan(driver.userId);
                        announce('Klan daveti gönderildi.');
                      } catch {}
                    },
                  }] : []),
                  {
                    icon: 'person-remove',
                    label: 'Çıkar',
                    onPress: () => social.removeFriend(driver.userId),
                  },
                ]}
              />
            ))}
          </DriverGroup>
        </>
      ) : null}

      {section === 'clan' ? (
        <ClanSection social={social} announce={announce} />
      ) : null}

      {section === 'messages' ? (
        <Surface>
          <Text style={styles.sectionTitle}>Sohbetler</Text>
          <Text style={styles.sectionSubtitle}>Mesajlar cihazlar arasında anlık eşitlenir.</Text>
          <View style={styles.listGap}>
            {appData.threads.length ? appData.threads.map((thread) => {
              const latest = thread.messages.at(-1);
              const unread = latest && latest.createdAt > thread.lastReadAt;
              return (
                <Pressable
                  key={thread.id}
                  onPress={() => {
                    setActiveThread(thread);
                    void appData.markThreadRead(thread.id);
                  }}
                  style={({ pressed }) => [
                    styles.thread,
                    unread && styles.threadUnread,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={18} color={colors.black} />
                  </View>
                  <View style={styles.threadCopy}>
                    <Text style={styles.driverName}>{thread.participantName}</Text>
                    <Text numberOfLines={1} style={styles.threadMessage}>
                      {latest?.body || 'Sohbeti başlatın'}
                    </Text>
                  </View>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              );
            }) : <Text style={styles.empty}>Henüz bir sohbetiniz yok.</Text>}
          </View>
        </Surface>
      ) : null}

      <ChatModal
        message={message}
        onChangeMessage={setMessage}
        onClose={() => setActiveThread(null)}
        onSend={async () => {
          if (!currentThread || !message.trim()) return;
          const body = message.trim();
          setMessage('');
          try {
            await appData.sendMessage(currentThread.participantUserId, body);
          } catch {
            setMessage(body);
            setNotice('Mesaj gönderilemedi.');
          }
        }}
        thread={currentThread}
      />
    </ScreenShell>
  );
}

function SectionButton({
  active,
  badge = 0,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  badge?: number;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.sectionButton, active && styles.sectionButtonActive]}>
      <Ionicons name={icon} size={18} color={active ? colors.black : colors.textMuted} />
      <Text style={[styles.sectionButtonText, active && styles.sectionButtonTextActive]}>{label}</Text>
      {badge ? <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{badge}</Text></View> : null}
    </Pressable>
  );
}

function DriverGroup({
  children,
  empty,
  title,
}: {
  children: ReactNode;
  empty: string;
  title: string;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Surface>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.listGap}>
        {hasChildren ? children : <Text style={styles.empty}>{empty}</Text>}
      </View>
    </Surface>
  );
}

function DriverCard({
  actions,
  driver,
}: {
  actions: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void | Promise<unknown>;
    primary?: boolean;
  }[];
  driver: DriverSummary;
}) {
  return (
    <View style={styles.driverCard}>
      <View style={styles.driverIdentity}>
        <View style={styles.avatar}>
          <Ionicons name="car-sport" size={18} color={colors.black} />
        </View>
        <View style={styles.driverCopy}>
          <Text style={styles.driverName}>{driver.fullName || 'CRUISER sürücüsü'}</Text>
          <Text style={styles.driverModel}>{driver.model || driver.region || 'Araç bilgisi yok'}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={action.label}
            key={action.label}
            onPress={() => void action.onPress()}
            style={({ pressed }) => [
              styles.iconAction,
              action.primary && styles.iconActionPrimary,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={action.icon}
              size={18}
              color={action.primary ? colors.black : colors.text}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ClanSection({
  announce,
  social,
}: {
  announce: (text: string) => void;
  social: ReturnType<typeof useSocialWorld>;
}) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');

  if (!social.currentClan) {
    return (
      <>
        {social.incomingClanInvites.length ? (
          <Surface accent>
            <Text style={styles.sectionTitle}>Klan Davetleri</Text>
            <View style={styles.listGap}>
              {social.incomingClanInvites.map((invite) => (
                <View key={invite.id} style={styles.invite}>
                  <View style={styles.driverCopy}>
                    <Text style={styles.driverName}>{invite.clanName || 'Klan daveti'}</Text>
                    <Text style={styles.driverModel}>
                      {invite.invitedByName || 'Klan yönetimi'} tarafından
                    </Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      try {
                        await social.respondClanInvite(invite.clanId, 'accepted');
                        announce(`${invite.clanName || 'Klana'} katıldınız.`);
                      } catch {}
                    }}
                    style={styles.iconActionPrimary}
                  >
                    <Ionicons name="checkmark" size={18} color={colors.black} />
                  </Pressable>
                  <Pressable
                    onPress={() => social.respondClanInvite(invite.clanId, 'declined')}
                    style={styles.iconAction}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          </Surface>
        ) : null}
        <Surface>
          <Text style={styles.sectionTitle}>Klan Kur</Text>
          <Text style={styles.sectionSubtitle}>Ekibini oluştur ve ortak sürüş istatistiklerini büyüt.</Text>
          <TextInput
            onChangeText={setName}
            placeholder="Klan adı *"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            value={name}
          />
          <TextInput
            autoCapitalize="characters"
            maxLength={6}
            onChangeText={(value) => setTag(value.toUpperCase())}
            placeholder="Kısa etiket *"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            value={tag}
          />
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder="Klan açıklaması"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.textArea]}
            value={description}
          />
          <Pressable
            disabled={!name.trim() || !tag.trim() || social.busy === 'create-clan'}
            onPress={async () => {
              try {
                await social.createClan(name, tag, description);
                announce('Klan oluşturuldu.');
              } catch {}
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Ionicons name="shield-checkmark" size={19} color={colors.black} />
            <Text style={styles.primaryButtonText}>Klanı Oluştur</Text>
          </Pressable>
        </Surface>
      </>
    );
  }

  const canManage = ['owner', 'captain'].includes(social.membership?.role ?? '');
  return (
    <>
      <Surface accent>
        <View style={styles.clanHeader}>
          <View style={styles.clanLogo}>
            <Text style={styles.clanTag}>{social.currentClan.tag}</Text>
          </View>
          <View style={styles.driverCopy}>
            <Text style={styles.clanName}>{social.currentClan.name}</Text>
            <Text style={styles.driverModel}>
              {social.membership?.role === 'owner'
                ? 'Kurucu'
                : social.membership?.role === 'captain' ? 'Kaptan' : 'Üye'}
            </Text>
          </View>
        </View>
        <View style={styles.clanStats}>
          <ClanMetric label="Üye" value={social.members.length} />
          <ClanMetric label="Aylık KM" value={Math.round(social.currentClan.monthlyKm ?? 0)} />
          <ClanMetric label="Davet" value={social.outgoingClanInvites.length} />
        </View>
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Üyeler</Text>
        <View style={styles.listGap}>
          {social.members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.driverCopy}>
                <Text style={styles.driverName}>{member.fullName || member.plate}</Text>
                <Text style={styles.driverModel}>{member.model || 'Araç bilgisi yok'} · {member.role}</Text>
              </View>
              {canManage && member.userId !== social.profile?.id && member.role !== 'owner' ? (
                <Pressable
                  onPress={async () => {
                    const nextRole = member.role === 'captain' ? 'member' : 'captain';
                    try {
                      await social.updateClanRole(member.userId, nextRole);
                      announce(`Rol ${nextRole === 'captain' ? 'kaptan' : 'üye'} olarak değiştirildi.`);
                    } catch {}
                  }}
                  style={styles.iconAction}
                >
                  <Ionicons name="swap-horizontal" size={18} color={colors.text} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </Surface>

      {social.membership?.role !== 'owner' ? (
        <Pressable
          onPress={() => void social.leaveClan()}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
        >
          <Ionicons name="exit-outline" size={19} color="#fda4af" />
          <Text style={styles.dangerText}>Klandan Ayrıl</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function ClanMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.clanMetric}>
      <Text style={styles.metricValue}>{value.toLocaleString('tr-TR')}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ChatModal({
  message,
  onChangeMessage,
  onClose,
  onSend,
  thread,
}: {
  message: string;
  onChangeMessage: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  thread: DirectMessageThread | null;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(thread)}>
      <View style={styles.chatRoot}>
        <View style={styles.chatHeader}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.driverCopy}>
            <Text style={styles.driverName}>{thread?.participantName}</Text>
            <Text style={styles.driverModel}>{thread?.participantModel}</Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {thread?.messages.map((item) => {
            const own = item.senderUserId !== thread.participantUserId &&
              item.senderUid !== thread.participantUserId;
            return (
              <View key={item.id} style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, own && styles.bubbleTextOwn]}>{item.body}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            maxLength={1000}
            multiline
            onChangeText={onChangeMessage}
            placeholder="Mesaj yazın"
            placeholderTextColor={colors.textFaint}
            style={styles.composerInput}
            value={message}
          />
          <Pressable disabled={!message.trim()} onPress={onSend} style={styles.sendButton}>
            <Ionicons name="send" size={19} color={colors.black} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sections: {
    padding: 4,
    borderRadius: 19,
    backgroundColor: colors.black,
    flexDirection: 'row',
    gap: 4,
  },
  sectionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  sectionButtonActive: { backgroundColor: colors.lime },
  sectionButtonText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9 },
  sectionButtonTextActive: { color: colors.black },
  sectionBadge: {
    position: 'absolute',
    right: 9,
    top: 7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 8 },
  sectionTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  sectionSubtitle: {
    marginTop: 4,
    marginBottom: 13,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
  },
  searchRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1.4,
  },
  searchButton: {
    width: 54,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listGap: { marginTop: 12, gap: 9 },
  empty: {
    paddingVertical: 18,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  notice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    color: colors.limeBright,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  error: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(244,63,94,0.1)',
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  driverCard: {
    padding: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
  },
  driverIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCopy: { flex: 1, minWidth: 0 },
  driverName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  driverModel: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  actionRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 7 },
  iconAction: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionPrimary: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invite: {
    minHeight: 62,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    minHeight: 52,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  textArea: { minHeight: 86, paddingTop: 13, textAlignVertical: 'top' },
  primaryButton: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: colors.black, fontFamily: fonts.bold, fontSize: 13 },
  clanHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clanLogo: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clanTag: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 14 },
  clanName: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20 },
  clanStats: { marginTop: 16, flexDirection: 'row', gap: 8 },
  clanMetric: {
    flex: 1,
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 15 },
  metricLabel: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.bold, fontSize: 8 },
  memberRow: {
    minHeight: 58,
    padding: 11,
    borderRadius: 16,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerButton: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    backgroundColor: 'rgba(244,63,94,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerText: { color: '#fda4af', fontFamily: fonts.bold, fontSize: 12 },
  thread: {
    minHeight: 64,
    padding: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  threadUnread: { borderColor: colors.borderStrong, backgroundColor: colors.limeMuted },
  threadCopy: { flex: 1, minWidth: 0 },
  threadMessage: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lime },
  chatRoot: { flex: 1, paddingTop: 44, backgroundColor: colors.background },
  chatHeader: {
    minHeight: 66,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: { flexGrow: 1, padding: 14, justifyContent: 'flex-end', gap: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: colors.lime },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  bubbleTextOwn: { color: colors.black },
  composer: {
    padding: 12,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingTop: 13,
    borderRadius: 17,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
