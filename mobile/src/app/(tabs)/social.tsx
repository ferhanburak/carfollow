import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PublicDriverProfileModal,
  type ProfileFriendshipState,
} from '@/components/public-driver-profile-modal';
import { ScreenShell, Surface } from '@/components/screen-shell';
import { useMapWorld } from '@/hooks/use-map-world';
import { useSocialWorld } from '@/hooks/use-social-world';
import { useAppData } from '@/providers/app-data-provider';
import { colors, fonts } from '@/theme/colors';
import type {
  DirectMessageThread,
  DriverSummary,
  MapPin,
} from '@/types/cruiser';

type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void | Promise<unknown>;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
};

type FriendshipState = 'none' | 'incoming' | 'outgoing' | 'accepted';

export default function SocialScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();
  const social = useSocialWorld();
  const mapWorld = useMapWorld();
  const appData = useAppData();
  const showMessages = params.section === 'messages';
  const [plate, setPlate] = useState('');
  const [searchResult, setSearchResult] = useState<DriverSummary | null>(null);
  const [searchComplete, setSearchComplete] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeThread, setActiveThread] = useState<DirectMessageThread | null>(null);
  const [message, setMessage] = useState('');
  const [clanCenterOpen, setClanCenterOpen] = useState(false);
  const [convoyTarget, setConvoyTarget] = useState<DriverSummary | null>(null);
  const [profileTarget, setProfileTarget] = useState<DriverSummary | null>(null);
  const [publicProfile, setPublicProfile] = useState<DriverSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const currentThread = activeThread
    ? appData.threads.find((item) => item.id === activeThread.id) ?? activeThread
    : null;

  const hostableConvoys = useMemo(
    () => mapWorld.pins.filter((pin) =>
      pin.type === 'meet' &&
      pin.eventMode === 'convoy' &&
      pin.lifecycleStatus === 'planning' &&
      ['host', 'manager'].includes(pin.viewerManagementRole ?? ''),
    ),
    [mapWorld.pins],
  );

  const clanEvents = useMemo(
    () => mapWorld.pins.filter((pin) =>
      pin.type === 'meet' &&
      Boolean(social.currentClan) &&
      (
        pin.clanId === social.currentClan?.id ||
        pin.createdByClan === social.currentClan?.name
      ),
    ),
    [mapWorld.pins, social.currentClan],
  );

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

  const friendshipState = (driver: DriverSummary): FriendshipState => {
    if (social.friends.some((item) => item.userId === driver.userId)) return 'accepted';
    if (social.incoming.some((item) => item.userId === driver.userId)) return 'incoming';
    if (social.outgoing.some((item) => item.userId === driver.userId)) return 'outgoing';
    return driver.friendshipStatus ?? 'none';
  };

  const canInviteClan = ['owner', 'captain'].includes(social.membership?.role ?? '');

  const clanInviteSent = (driver: DriverSummary) =>
    social.outgoingClanInvites.some((invite) =>
      invite.targetUserId === driver.userId && (invite.status ?? 'pending') === 'pending',
    );

  const openConvoyPicker = (driver: DriverSummary) => {
    setConvoyTarget(driver);
  };

  const openPublicProfile = async (driver: DriverSummary) => {
    setProfileTarget(driver);
    setPublicProfile(null);
    setProfileLoading(true);
    try {
      const result = await social.getPublicProfile(driver.userId);
      setPublicProfile(result ? { ...driver, ...result } : driver);
    } finally {
      setProfileLoading(false);
    }
  };

  const closePublicProfile = () => {
    setProfileTarget(null);
    setPublicProfile(null);
    setProfileLoading(false);
  };

  const activeProfile = publicProfile ?? profileTarget;
  const activeFriendshipState = (() => {
    if (!activeProfile) return 'none';
    if (activeProfile.userId === social.currentUserId) return 'self';
    if (social.blocked.some((driver) => driver.userId === activeProfile.userId)) return 'blocked';
    return friendshipState(activeProfile);
  })() as ProfileFriendshipState;
  const activeIsClanMember = Boolean(
    activeProfile && social.members.some((member) => member.userId === activeProfile.userId),
  );

  const buildSearchActions = (driver: DriverSummary): Action[] => {
    const state = friendshipState(driver);
    const actions: Action[] = [];
    if (state === 'none') {
      actions.push({
        icon: 'person-add',
        label: 'Arkadaşlık isteği gönder',
        primary: true,
        onPress: async () => {
          await social.requestFriend(driver.userId);
          announce('Arkadaşlık isteği gönderildi.');
        },
      });
    } else if (state === 'incoming') {
      actions.push(
        {
          icon: 'checkmark',
          label: 'Arkadaşlık isteğini kabul et',
          primary: true,
          onPress: async () => {
            await social.respondFriend(driver.userId, 'accepted');
            announce(`${driver.fullName || 'Sürücü'} ile artık arkadaşsınız.`);
          },
        },
        {
          icon: 'close',
          label: 'Arkadaşlık isteğini reddet',
          onPress: () => social.respondFriend(driver.userId, 'declined'),
        },
      );
    } else if (state === 'outgoing') {
      actions.push({
        icon: 'checkmark-done',
        label: 'Arkadaşlık isteği gönderildi',
        disabled: true,
        onPress: () => undefined,
      });
    } else {
      actions.push({
        icon: 'chatbubble',
        label: 'Sohbet aç',
        primary: true,
        onPress: () => openChat(driver),
      });
    }
    if (canInviteClan) {
      actions.push({
        icon: clanInviteSent(driver) ? 'checkmark-done' : 'shield',
        label: clanInviteSent(driver) ? 'Klan daveti gönderildi' : 'Klana davet et',
        disabled: clanInviteSent(driver),
        onPress: async () => {
          await social.inviteClan(driver.userId);
          announce('Klan daveti gönderildi.');
        },
      });
    }
    if (hostableConvoys.length) {
      actions.push({
        icon: 'navigate',
        label: 'Konvoya davet et',
        onPress: () => openConvoyPicker(driver),
      });
    }
    return actions;
  };

  if (showMessages) {
    return (
      <>
        <ScreenShell scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
          <View style={styles.pageHeading}>
            <Pressable
              accessibilityLabel="Social ekranına dön"
              onPress={() => router.replace('/(tabs)/social')}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View>
              <Text style={styles.pageTitle}>Mesajlar</Text>
              <Text style={styles.pageMeta}>{appData.threads.length} sohbet</Text>
            </View>
          </View>
          <Surface>
            <View style={styles.listGap}>
              {appData.threads.length ? appData.threads.map((thread) => {
                const latest = thread.messages.at(-1);
                const unread = Boolean(
                  latest &&
                  latest.senderUserId !== social.currentUserId &&
                  latest.senderUid !== social.currentUserId &&
                  latest.createdAt > thread.lastReadAt,
                );
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
                    <DriverAvatar icon="chatbubble" />
                    <View style={styles.copy}>
                      <Text style={styles.driverName}>{thread.participantName}</Text>
                      <Text numberOfLines={1} style={styles.driverModel}>
                        {latest?.body || thread.participantModel || 'Sohbeti başlatın'}
                      </Text>
                    </View>
                    {unread ? <View style={styles.unreadDot} /> : null}
                    <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
                  </Pressable>
                );
              }) : <EmptyState text="Henüz bir sohbetiniz yok." />}
            </View>
          </Surface>
        </ScreenShell>
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
            }
          }}
          thread={currentThread}
        />
      </>
    );
  }

  return (
    <>
      <ScreenShell scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {social.error ? <Text style={styles.error}>{social.error}</Text> : null}
        {mapWorld.error ? <Text style={styles.error}>{mapWorld.error}</Text> : null}

        <Surface>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Klan Merkezi</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {social.currentClan?.name || `${social.incomingClanInvites.length} davet`}
              </Text>
            </View>
          </View>
          {social.currentClan ? (
            <ClanSummary
              clanName={social.currentClan.name}
              clanTag={social.currentClan.tag}
              eventCount={clanEvents.length}
              memberCount={social.members.length}
              monthlyKm={social.currentClan.monthlyKm ?? 0}
              onPress={() => setClanCenterOpen(true)}
              role={social.membership?.role ?? 'member'}
            />
          ) : (
            <ClanCreatePanel announce={announce} social={social} />
          )}
        </Surface>

        <Surface>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Arkadaş Bul ve Bağlan</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{social.friends.length} arkadaş</Text>
            </View>
          </View>

          <View style={styles.searchPanel}>
            <Text style={styles.groupTitle}>Kullanıcı Ara</Text>
            <Text style={styles.groupMeta}>Tam plaka ile sürücü ara</Text>
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
                accessibilityLabel="Sürücü ara"
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
                actions={buildSearchActions(searchResult)}
                driver={searchResult}
                onOpen={() => runAction(() => openPublicProfile(searchResult))}
                showPlate
              />
            ) : searchComplete ? (
              <EmptyState text="Bu plakaya ait erişilebilir bir sürücü bulunamadı." />
            ) : null}
          </View>

          <DriverGroup
            empty="Yeni arkadaşlık isteği yok."
            title="Gelen İstekler"
            count={social.incoming.length}
          >
            {social.incoming.map((driver) => (
              <DriverCard
                driver={driver}
                key={driver.userId}
                onOpen={() => runAction(() => openPublicProfile(driver))}
                actions={[
                  {
                    icon: 'checkmark',
                    label: 'Kabul et',
                    primary: true,
                    onPress: async () => {
                      await social.respondFriend(driver.userId, 'accepted');
                      announce(`${driver.fullName || 'Sürücü'} ile artık arkadaşsınız.`);
                    },
                  },
                  {
                    icon: 'close',
                    label: 'Reddet',
                    onPress: () => social.respondFriend(driver.userId, 'declined'),
                  },
                ] as Action[]}
              />
            ))}
          </DriverGroup>

          <DriverGroup
            empty="Bekleyen giden istek yok."
            title="Giden İstekler"
            count={social.outgoing.length}
          >
            {social.outgoing.map((driver) => (
              <DriverCard
                driver={driver}
                key={driver.userId}
                onOpen={() => runAction(() => openPublicProfile(driver))}
                actions={[{
                  icon: 'arrow-undo',
                  label: 'İsteği geri çek',
                  onPress: () => social.cancelFriend(driver.userId),
                }]}
              />
            ))}
          </DriverGroup>

          <DriverGroup
            empty="Henüz arkadaş eklenmedi."
            title="Arkadaş Listesi"
            count={social.friends.length}
          >
            {social.friends.map((driver) => (
              <DriverCard
                driver={driver}
                key={driver.userId}
                onOpen={() => runAction(() => openPublicProfile(driver))}
                actions={[
                  {
                    icon: 'chatbubble',
                    label: 'Sohbet aç',
                    primary: true,
                    onPress: () => openChat(driver),
                  },
                  ...(canInviteClan ? [{
                    icon: (clanInviteSent(driver) ? 'checkmark-done' : 'shield') as keyof typeof Ionicons.glyphMap,
                    label: clanInviteSent(driver) ? 'Klan daveti gönderildi' : 'Klana davet et',
                    disabled: clanInviteSent(driver),
                    onPress: async () => {
                      await social.inviteClan(driver.userId);
                      announce('Klan daveti gönderildi.');
                    },
                  }] : []),
                  ...(hostableConvoys.length ? [{
                    icon: 'navigate' as keyof typeof Ionicons.glyphMap,
                    label: 'Konvoya davet et',
                    onPress: () => openConvoyPicker(driver),
                  }] : []),
                  {
                    icon: 'person-remove',
                    label: 'Arkadaşlıktan çıkar',
                    onPress: () => confirmAction(
                      'Arkadaşlıktan çıkar',
                      `${driver.fullName || 'Bu sürücü'} arkadaş listenizden çıkarılsın mı?`,
                      () => social.removeFriend(driver.userId),
                    ),
                  },
                  {
                    icon: 'ban',
                    label: 'Sürücüyü engelle',
                    danger: true,
                    onPress: () => confirmAction(
                      'Sürücüyü engelle',
                      'Arkadaşlık kaldırılır ve bu kullanıcı sizinle etkileşim kuramaz.',
                      () => social.blockDriver(driver.userId),
                    ),
                  },
                ] as Action[]}
              />
            ))}
          </DriverGroup>
        </Surface>
      </ScreenShell>

      <ClanCenterModal
        events={clanEvents}
        onClose={() => setClanCenterOpen(false)}
        onDeleteEvent={async (event) => {
          await social.deleteClanEvent(event.id);
          await mapWorld.refreshConvoys();
          announce('Etkinlik silindi.');
        }}
        open={clanCenterOpen}
        onOpenDriver={(driver) => runAction(() => openPublicProfile(driver))}
        social={social}
        announce={announce}
      />
      <PublicDriverProfileModal
        busy={Boolean(social.busy)}
        canInviteClan={canInviteClan && !activeIsClanMember}
        canInviteConvoy={Boolean(hostableConvoys.length)}
        clanInviteSent={Boolean(activeProfile && clanInviteSent(activeProfile))}
        error={social.error}
        friendshipState={activeFriendshipState}
        loading={profileLoading}
        onAcceptFriend={activeProfile ? async () => {
          await social.respondFriend(activeProfile.userId, 'accepted');
          announce(`${activeProfile.fullName || 'Sürücü'} ile artık arkadaşsınız.`);
        } : undefined}
        onBlock={activeProfile ? () => confirmAction(
          'Sürücüyü engelle',
          'Arkadaşlık kaldırılır ve bu kullanıcı sizinle etkileşim kuramaz.',
          async () => {
            await social.blockDriver(activeProfile.userId);
            announce('Sürücü engellendi.');
          },
        ) : undefined}
        onCancelFriend={activeProfile ? async () => {
          await social.cancelFriend(activeProfile.userId);
          announce('Arkadaşlık isteği geri çekildi.');
        } : undefined}
        onClose={closePublicProfile}
        onInviteClan={activeProfile ? async () => {
          await social.inviteClan(activeProfile.userId);
          announce('Klan daveti gönderildi.');
        } : undefined}
        onInviteConvoy={activeProfile ? () => {
          const driver = activeProfile;
          closePublicProfile();
          openConvoyPicker(driver);
        } : undefined}
        onMessage={activeProfile ? async () => {
          const driver = activeProfile;
          closePublicProfile();
          await openChat(driver);
        } : undefined}
        onRejectFriend={activeProfile ? async () => {
          await social.respondFriend(activeProfile.userId, 'declined');
          announce('Arkadaşlık isteği reddedildi.');
        } : undefined}
        onRemoveFriend={activeProfile ? () => confirmAction(
          'Arkadaşlıktan çıkar',
          `${activeProfile.fullName || 'Bu sürücü'} arkadaş listenizden çıkarılsın mı?`,
          async () => {
            await social.removeFriend(activeProfile.userId);
            announce('Arkadaşlık kaldırıldı.');
          },
        ) : undefined}
        onReport={activeProfile ? async (reason, details) => {
          await social.reportDriver(activeProfile.userId, reason, details);
          announce('Raporunuz incelemeye gönderildi.');
        } : undefined}
        onRequestFriend={activeProfile ? async () => {
          await social.requestFriend(activeProfile.userId);
          announce('Arkadaşlık isteği gönderildi.');
        } : undefined}
        onUnblock={activeProfile ? async () => {
          await social.unblockDriver(activeProfile.userId);
          announce('Sürücünün engeli kaldırıldı.');
        } : undefined}
        profile={activeProfile}
        visible={Boolean(profileTarget)}
      />
      <ConvoyInviteModal
        convoys={hostableConvoys}
        driver={convoyTarget}
        onClose={() => setConvoyTarget(null)}
        onInvite={async (convoy, driver) => {
          await social.inviteConvoy(convoy.id, driver.userId);
          await mapWorld.refreshConvoys();
          announce('Konvoy daveti gönderildi.');
          setConvoyTarget(null);
        }}
      />
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
          }
        }}
        thread={currentThread}
      />
    </>
  );
}

function confirmAction(title: string, message: string, action: () => Promise<unknown>) {
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Onayla', style: 'destructive', onPress: () => runAction(action) },
  ]);
}

function runAction(action: () => void | Promise<unknown>) {
  void Promise.resolve().then(action).catch(() => undefined);
}

function DriverAvatar({ icon = 'car-sport' }: { icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.avatar}>
      <Ionicons name={icon} size={18} color={colors.black} />
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.empty}>{text}</Text>
    </View>
  );
}

function DriverGroup({
  children,
  count,
  empty,
  title,
}: {
  children: ReactNode;
  count: number;
  empty: string;
  title: string;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <Text style={styles.groupTitle}>{title}</Text>
        <View style={styles.smallCount}>
          <Text style={styles.smallCountText}>{count}</Text>
        </View>
      </View>
      <View style={styles.listGap}>
        {count ? children : <EmptyState text={empty} />}
      </View>
    </View>
  );
}

function DriverCard({
  actions,
  driver,
  onOpen,
  showPlate = false,
}: {
  actions: Action[];
  driver: DriverSummary;
  onOpen: () => void;
  showPlate?: boolean;
}) {
  return (
    <View style={styles.driverCard}>
      <Pressable
        accessibilityLabel={`${driver.fullName || driver.model || 'Sürücü'} profilini aç`}
        onPress={onOpen}
        style={({ pressed }) => [styles.driverRow, pressed && styles.pressed]}
      >
        <DriverAvatar />
        <View style={styles.copy}>
          {showPlate && driver.plate ? <Text style={styles.plate}>{driver.plate}</Text> : null}
          <Text numberOfLines={1} style={styles.driverName}>
            {driver.fullName || 'CRUISER sürücüsü'}
          </Text>
          <Text numberOfLines={1} style={styles.driverModel}>
            {driver.model || driver.region || 'Araç bilgisi yok'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
      </Pressable>
      <View style={styles.actionRow}>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={action.label}
            disabled={action.disabled}
            key={action.label}
            onPress={() => runAction(action.onPress)}
            style={({ pressed }) => [
              styles.iconAction,
              action.primary && styles.iconActionPrimary,
              action.danger && styles.iconActionDanger,
              action.disabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={action.icon}
              size={18}
              color={action.primary ? colors.black : action.danger ? '#fda4af' : colors.text}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ClanSummary({
  clanName,
  clanTag,
  eventCount,
  memberCount,
  monthlyKm,
  onPress,
  role,
}: {
  clanName: string;
  clanTag: string;
  eventCount: number;
  memberCount: number;
  monthlyKm: number;
  onPress: () => void;
  role: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${clanName} klan detaylarını aç`}
      onPress={onPress}
      style={({ pressed }) => [styles.clanSummary, pressed && styles.pressed]}
    >
      <View style={styles.titleRow}>
        <View style={styles.copy}>
          <Text style={styles.clanName}>{clanName}</Text>
          <Text style={styles.clanTag}>{clanTag}</Text>
        </View>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{roleLabel(role)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.limeBright} />
      </View>
      <View style={styles.metrics}>
        <Metric label="Aylık KM" value={monthlyKm.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} />
        <Metric label="Üye" value={memberCount} />
        <Metric label="Etkinlik" value={eventCount} />
      </View>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function roleLabel(role: string) {
  if (role === 'owner') return 'Kurucu';
  if (role === 'captain') return 'Kaptan';
  return 'Üye';
}

function ClanCreatePanel({
  announce,
  social,
}: {
  announce: (text: string) => void;
  social: ReturnType<typeof useSocialWorld>;
}) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');

  return (
    <View style={styles.createPanel}>
      {social.incomingClanInvites.length ? (
        <View style={styles.inviteBlock}>
          <Text style={styles.groupTitle}>Gelen Klan Davetleri</Text>
          <View style={styles.listGap}>
            {social.incomingClanInvites.map((invite) => (
              <View key={invite.id} style={styles.inviteRow}>
                <View style={styles.copy}>
                  <Text style={styles.driverName}>{invite.clanName || 'Klan daveti'}</Text>
                  <Text style={styles.driverModel}>
                    {invite.invitedByName || 'Klan yönetimi'} tarafından
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Klan davetini kabul et"
                  onPress={() => runAction(async () => {
                    await social.respondClanInvite(invite.clanId, 'accepted');
                    announce(`${invite.clanName || 'Klana'} katıldınız.`);
                  })}
                  style={styles.iconActionPrimary}
                >
                  <Ionicons name="checkmark" size={18} color={colors.black} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Klan davetini reddet"
                  onPress={() => runAction(
                    () => social.respondClanInvite(invite.clanId, 'declined'),
                  )}
                  style={styles.iconAction}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.groupTitle}>Klan Kur</Text>
      <Text style={styles.groupMeta}>Ekibini oluştur ve ortak sürüşlerini büyüt.</Text>
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
        onPress={() => runAction(async () => {
          await social.createClan(name, tag, description);
          announce('Klan oluşturuldu.');
        })}
        style={({ pressed }) => [
          styles.primaryButton,
          (!name.trim() || !tag.trim()) && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="shield-checkmark" size={19} color={colors.black} />
        <Text style={styles.primaryButtonText}>Klanı Oluştur</Text>
      </Pressable>
    </View>
  );
}

function ClanCenterModal({
  announce,
  events,
  onClose,
  onDeleteEvent,
  onOpenDriver,
  open,
  social,
}: {
  announce: (text: string) => void;
  events: MapPin[];
  onClose: () => void;
  onDeleteEvent: (event: MapPin) => Promise<void>;
  onOpenDriver: (driver: DriverSummary) => void;
  open: boolean;
  social: ReturnType<typeof useSocialWorld>;
}) {
  const insets = useSafeAreaInsets();
  if (!social.currentClan) return null;
  const role = social.membership?.role ?? 'member';
  const canManage = ['owner', 'captain'].includes(role);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={open}>
      <View style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <View style={styles.copy}>
            <Text style={styles.pageTitle}>{social.currentClan.name}</Text>
            <Text style={styles.clanTag}>{social.currentClan.tag} · {roleLabel(role)}</Text>
          </View>
          <Pressable accessibilityLabel="Klan merkezini kapat" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={21} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 18) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metrics}>
            <Metric
              label="Aylık KM"
              value={(social.currentClan.monthlyKm ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
            />
            <Metric label="Üye" value={social.members.length} />
            <Metric label="Etkinlik" value={events.length} />
          </View>
          {social.error ? <Text style={styles.error}>{social.error}</Text> : null}
          {social.currentClan.description ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailCopy}>{social.currentClan.description}</Text>
            </View>
          ) : null}

          <View style={styles.detailBlock}>
            <Text style={styles.groupTitle}>Klan Kadrosu</Text>
            <View style={styles.listGap}>
              {social.members.map((member) => {
                const isSelf = member.userId === social.currentUserId;
                const canRemove = !isSelf && (
                  role === 'owner' && member.role !== 'owner' ||
                  role === 'captain' && member.role === 'member'
                );
                return (
                  <View key={member.id} style={styles.memberCard}>
                    <Pressable
                      accessibilityLabel={`${member.fullName || member.model || 'Sürücü'} profilini aç`}
                      disabled={isSelf}
                      onPress={() => onOpenDriver(member)}
                      style={({ pressed }) => [
                        styles.memberIdentity,
                        pressed && !isSelf && styles.pressed,
                      ]}
                    >
                      <DriverAvatar />
                      <View style={styles.copy}>
                        <Text style={styles.driverName}>
                          {member.fullName || member.plate || 'CRUISER sürücüsü'}
                          {isSelf ? ' (Sen)' : ''}
                        </Text>
                        <Text style={styles.driverModel}>{member.model || 'Araç bilgisi yok'}</Text>
                      </View>
                    </Pressable>
                    <View style={styles.rolePill}>
                      <Text style={styles.roleText}>{roleLabel(member.role)}</Text>
                    </View>
                    {role === 'owner' && !isSelf && member.role !== 'owner' ? (
                      <Pressable
                        accessibilityLabel="Klan rolünü değiştir"
                        onPress={() => runAction(async () => {
                          const nextRole = member.role === 'captain' ? 'member' : 'captain';
                          await social.updateClanRole(member.userId, nextRole);
                          announce(`Rol ${roleLabel(nextRole)} olarak değiştirildi.`);
                        })}
                        style={styles.smallAction}
                      >
                        <Ionicons name="swap-horizontal" size={17} color={colors.text} />
                      </Pressable>
                    ) : null}
                    {role === 'owner' && !isSelf && member.role !== 'owner' ? (
                      <Pressable
                        accessibilityLabel="Klan sahipliğini devret"
                        onPress={() => confirmAction(
                          'Sahipliği devret',
                          `${member.fullName || 'Bu üye'} klanın yeni kurucusu olsun mu?`,
                          async () => {
                            await social.transferClanOwnership(member.userId);
                            announce('Klan sahipliği devredildi.');
                          },
                        )}
                        style={styles.smallAction}
                      >
                        <Ionicons name="key" size={16} color="#fde68a" />
                      </Pressable>
                    ) : null}
                    {canRemove ? (
                      <Pressable
                        accessibilityLabel="Üyeyi klandan çıkar"
                        onPress={() => confirmAction(
                          'Üyeyi çıkar',
                          `${member.fullName || 'Bu üye'} klandan çıkarılsın mı?`,
                          () => social.removeClanMember(member.userId),
                        )}
                        style={[styles.smallAction, styles.smallDanger]}
                      >
                        <Ionicons name="person-remove" size={16} color="#fda4af" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.groupTitle}>Klan Etkinlikleri</Text>
            <View style={styles.listGap}>
              {events.length ? events.map((event) => (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name={event.eventMode === 'convoy' ? 'navigate' : 'location'}
                      size={17}
                      color={colors.limeBright}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.driverName}>{event.name}</Text>
                    <Text style={styles.driverModel}>
                      {event.lifecycleStatus === 'planning' ? 'Planlandı' : 'Geçmiş etkinlik'}
                    </Text>
                  </View>
                  {canManage ? (
                    <Pressable
                      accessibilityLabel="Etkinliği sil"
                      onPress={() => confirmAction(
                        'Etkinliği sil',
                        `${event.name} kalıcı olarak silinsin mi?`,
                        () => onDeleteEvent(event),
                      )}
                      style={[styles.smallAction, styles.smallDanger]}
                    >
                      <Ionicons name="trash" size={16} color="#fda4af" />
                    </Pressable>
                  ) : null}
                </View>
              )) : <EmptyState text="Klan etkinliği bulunmuyor." />}
            </View>
          </View>

          {canManage ? (
            <View style={styles.detailBlock}>
              <Text style={styles.groupTitle}>Giden Davetler</Text>
              <View style={styles.listGap}>
                {social.outgoingClanInvites.length ? social.outgoingClanInvites.map((invite) => (
                  <View key={invite.id} style={styles.inviteRow}>
                    <View style={styles.copy}>
                      <Text style={styles.driverName}>
                        {invite.targetName || invite.targetPlate || 'Davet edilen sürücü'}
                      </Text>
                      <Text style={styles.driverModel}>Yanıt bekleniyor</Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Klan davetini geri çek"
                      onPress={() => runAction(
                        () => social.cancelClanInvite(invite.targetUserId),
                      )}
                      style={styles.smallAction}
                    >
                      <Ionicons name="close" size={17} color={colors.text} />
                    </Pressable>
                  </View>
                )) : <EmptyState text="Bekleyen giden davet yok." />}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => confirmAction(
              'Klandan ayrıl',
              'Klan üyeliğinizi sonlandırmak istediğinizden emin misiniz?',
              async () => {
                await social.leaveClan();
                onClose();
              },
            )}
            style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
          >
            <Ionicons name="exit-outline" size={19} color="#fda4af" />
            <Text style={styles.dangerText}>Klandan Ayrıl</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ConvoyInviteModal({
  convoys,
  driver,
  onClose,
  onInvite,
}: {
  convoys: MapPin[];
  driver: DriverSummary | null;
  onClose: () => void;
  onInvite: (convoy: MapPin, driver: DriverSummary) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(driver)}>
      <View style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <View style={styles.copy}>
            <Text style={styles.pageTitle}>Konvoy Seç</Text>
            <Text style={styles.pageMeta}>{driver?.fullName || driver?.model}</Text>
          </View>
          <Pressable accessibilityLabel="Konvoy seçimini kapat" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={21} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {convoys.length ? convoys.map((convoy) => {
            const invited = convoy.invitedGuests?.some((item) => item.userId === driver?.userId);
            return (
              <Pressable
                accessibilityLabel={`${convoy.name} konvoyuna davet et`}
                disabled={invited || !driver}
                key={convoy.id}
                onPress={() => {
                  if (driver) runAction(() => onInvite(convoy, driver));
                }}
                style={({ pressed }) => [
                  styles.convoyCard,
                  invited && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.eventIcon}>
                  <Ionicons name="navigate" size={18} color={colors.limeBright} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.driverName}>{convoy.name}</Text>
                  <Text style={styles.driverModel}>
                    {convoy.approvedCount ?? 1}/{convoy.capacity ?? 0} sürücü
                  </Text>
                </View>
                <Ionicons
                  name={invited ? 'checkmark-done' : 'send'}
                  size={18}
                  color={invited ? colors.textFaint : colors.limeBright}
                />
              </Pressable>
            );
          }) : <EmptyState text="Davet gönderebileceğiniz planlı bir konvoy yok." />}
        </ScrollView>
      </View>
    </Modal>
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
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={Boolean(thread)}>
      <View style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.copy}>
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
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
  pageHeading: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pageTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 18 },
  pageMeta: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { flex: 1, color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  countPill: {
    maxWidth: 140,
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  searchPanel: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
  },
  searchRow: { marginTop: 11, flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 1.3,
  },
  searchButton: {
    width: 52,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  groupHeading: { flexDirection: 'row', alignItems: 'center' },
  groupTitle: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  groupMeta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  smallCount: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCountText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9 },
  listGap: { marginTop: 10, gap: 8 },
  emptyState: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    textAlign: 'center',
  },
  notice: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    color: colors.limeBright,
    fontFamily: fonts.semibold,
    fontSize: 10,
    textAlign: 'center',
  },
  error: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(244,63,94,0.1)',
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 10,
    textAlign: 'center',
  },
  driverCard: {
    marginTop: 10,
    padding: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  plate: {
    marginBottom: 2,
    color: colors.limeBright,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  driverName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  driverModel: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  actionRow: { marginTop: 9, flexDirection: 'row', justifyContent: 'flex-end', gap: 7 },
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
  iconActionDanger: {
    borderColor: 'rgba(244,63,94,0.3)',
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  disabled: { opacity: 0.42 },
  clanSummary: {
    marginTop: 13,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
  },
  clanName: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17 },
  clanTag: {
    marginTop: 3,
    color: colors.limeBright,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  rolePill: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 8 },
  metrics: { marginTop: 13, flexDirection: 'row', gap: 7 },
  metric: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.semibold,
    fontSize: 7,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metricValue: { marginTop: 4, color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 13 },
  createPanel: { marginTop: 13 },
  inviteBlock: { marginBottom: 16 },
  inviteRow: {
    minHeight: 60,
    padding: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  input: {
    minHeight: 50,
    marginTop: 9,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  textArea: { minHeight: 78, paddingTop: 13, textAlignVertical: 'top' },
  primaryButton: {
    minHeight: 50,
    marginTop: 11,
    borderRadius: 16,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: colors.black, fontFamily: fonts.bold, fontSize: 12 },
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
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    minHeight: 74,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalContent: { padding: 14, gap: 12 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBlock: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailCopy: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  memberCard: {
    minHeight: 62,
    padding: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  memberIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  smallAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallDanger: {
    borderColor: 'rgba(244,63,94,0.25)',
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  eventRow: {
    minHeight: 58,
    padding: 9,
    borderRadius: 15,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    backgroundColor: 'rgba(244,63,94,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerText: { color: '#fda4af', fontFamily: fonts.bold, fontSize: 12 },
  convoyCard: {
    minHeight: 68,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messages: { flexGrow: 1, padding: 14, justifyContent: 'flex-end', gap: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: colors.lime },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  bubbleTextOwn: { color: colors.black },
  composer: {
    padding: 12,
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
