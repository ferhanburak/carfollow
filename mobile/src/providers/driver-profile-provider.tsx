import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import {
  AppState,
  Modal,
  ScrollView,
  View,
} from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PublicDriverProfileModal,
  type ProfileFriendshipState,
} from '@/components/public-driver-profile-modal';
import { RouteSummaryModal } from '@/components/route-summary-modal';
import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
  localizedAlert,
} from '@/components/localized-text';
import { useMapWorld } from '@/hooks/use-map-world';
import { useConvoyTracking } from '@/hooks/use-convoy-tracking';
import { useSocialWorld } from '@/hooks/use-social-world';
import {
  clearPendingRouteSummary,
  consumePendingRouteSummary,
  subscribeToRouteSummaries,
  type RouteSummary,
} from '@/lib/route-summary';
import { useAppData } from '@/providers/app-data-provider';
import { useAuth } from '@/providers/auth-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary, MapPin } from '@/types/cruiser';

type DriverProfileContextValue = {
  mapWorld: ReturnType<typeof useMapWorld>;
  openDriverProfile: (
    driver: DriverSummary,
    context?: { convoyId?: string },
  ) => Promise<void>;
  social: ReturnType<typeof useSocialWorld>;
};

const DriverProfileContext = createContext<DriverProfileContextValue | null>(null);

export function DriverProfileProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const appData = useAppData();
  const social = useSocialWorld();
  const mapWorld = useMapWorld();
  useConvoyTracking(user?.uid, mapWorld);
  const [profileTarget, setProfileTarget] = useState<DriverSummary | null>(null);
  const [publicProfile, setPublicProfile] = useState<DriverSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendshipOverride, setFriendshipOverride] = useState<ProfileFriendshipState | null>(null);
  const [clanInviteOverride, setClanInviteOverride] = useState<boolean | null>(null);
  const [convoyTarget, setConvoyTarget] = useState<DriverSummary | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const profileRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const restore = () => {
      void consumePendingRouteSummary().then((summary) => {
        if (mounted && summary) setRouteSummary(summary);
      });
    };
    restore();
    const unsubscribe = subscribeToRouteSummaries((summary) => {
      setRouteSummary(summary);
      void clearPendingRouteSummary();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') restore();
    });
    return () => {
      mounted = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const hostableConvoys = useMemo(
    () => mapWorld.pins.filter((pin) =>
      pin.type === 'meet' &&
      pin.eventMode === 'convoy' &&
      pin.lifecycleStatus === 'planning' &&
      ['host', 'manager'].includes(pin.viewerManagementRole ?? ''),
    ),
    [mapWorld.pins],
  );

  const activeProfile = publicProfile ?? profileTarget;
  const activeFriendshipState = friendshipOverride ?? resolveFriendshipState(activeProfile, social);
  const activeIsClanMember = Boolean(
    activeProfile && social.members.some((member) => member.userId === activeProfile.userId),
  );
  const canInviteClan = ['owner', 'captain'].includes(social.membership?.role ?? '');
  const clanInviteSent = clanInviteOverride ?? Boolean(
    activeProfile && social.outgoingClanInvites.some((invite) =>
      invite.targetUserId === activeProfile.userId &&
      (invite.status ?? 'pending') === 'pending',
    ),
  );

  const closeDriverProfile = () => {
    profileRequestRef.current += 1;
    setProfileTarget(null);
    setPublicProfile(null);
    setProfileLoading(false);
    setFriendshipOverride(null);
    setClanInviteOverride(null);
  };

  const openDriverProfile = async (
    driver: DriverSummary,
    context: { convoyId?: string } = {},
  ) => {
    if (!driver?.userId) return;
    void Haptics.selectionAsync();
    if (driver.userId === social.currentUserId) {
      router.push('/(tabs)/profile');
      return;
    }

    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    setProfileTarget(driver);
    setPublicProfile(null);
    setProfileLoading(true);
    setFriendshipOverride(null);
    setClanInviteOverride(null);
    try {
      const result = await social.getPublicProfile(driver.userId, context);
      if (profileRequestRef.current === requestId) {
        setPublicProfile(result ? { ...driver, ...result } : driver);
      }
    } catch {
      if (profileRequestRef.current === requestId) setPublicProfile(driver);
    } finally {
      if (profileRequestRef.current === requestId) setProfileLoading(false);
    }
  };

  const confirm = (title: string, message: string, action: () => Promise<unknown>) => {
    localizedAlert(title, message, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onayla', style: 'destructive', onPress: () => void action() },
    ]);
  };

  const value: DriverProfileContextValue = {
    mapWorld,
    openDriverProfile,
    social,
  };

  return (
    <DriverProfileContext.Provider value={value}>
      {children}
      <PublicDriverProfileModal
        busy={Boolean(social.busy)}
        canInviteClan={canInviteClan && !activeIsClanMember}
        canInviteConvoy={Boolean(hostableConvoys.length)}
        clanInviteSent={clanInviteSent}
        error={social.error}
        friendshipState={activeFriendshipState}
        loading={profileLoading}
        onAcceptFriend={activeProfile ? async () => {
          setFriendshipOverride('accepted');
          try {
            await social.respondFriend(activeProfile.userId, 'accepted');
          } catch (error) {
            setFriendshipOverride(null);
            throw error;
          }
        } : undefined}
        onBlock={activeProfile ? () => confirm(
          'Sürücüyü engelle',
          'Arkadaşlık kaldırılır ve bu kullanıcı sizinle etkileşim kuramaz.',
          () => social.blockDriver(activeProfile.userId),
        ) : undefined}
        onCancelFriend={activeProfile ? async () => {
          setFriendshipOverride('none');
          try {
            await social.cancelFriend(activeProfile.userId);
          } catch (error) {
            setFriendshipOverride(null);
            throw error;
          }
        } : undefined}
        onClose={closeDriverProfile}
        onInviteClan={activeProfile ? async () => {
          setClanInviteOverride(true);
          try {
            await social.inviteClan(activeProfile.userId);
          } catch (error) {
            setClanInviteOverride(null);
            throw error;
          }
        } : undefined}
        onInviteConvoy={activeProfile ? () => {
          const driver = activeProfile;
          closeDriverProfile();
          setConvoyTarget(driver);
        } : undefined}
        onMessage={activeProfile ? async () => {
          const threadId = await appData.openThread(activeProfile.userId);
          closeDriverProfile();
          router.push({
            pathname: '/(tabs)/social',
            params: { section: 'messages', threadId },
          });
        } : undefined}
        onRejectFriend={activeProfile ? async () => {
          setFriendshipOverride('none');
          try {
            await social.respondFriend(activeProfile.userId, 'declined');
          } catch (error) {
            setFriendshipOverride(null);
            throw error;
          }
        } : undefined}
        onRemoveFriend={activeProfile ? () => confirm(
          'Arkadaşlıktan çıkar',
          `${activeProfile.fullName || 'Bu sürücü'} arkadaş listenizden çıkarılsın mı?`,
          () => social.removeFriend(activeProfile.userId),
        ) : undefined}
        onReport={activeProfile ? (reason, details) =>
          social.reportDriver(activeProfile.userId, reason, details) : undefined}
        onRequestFriend={activeProfile ? async () => {
          setFriendshipOverride('outgoing');
          try {
            await social.requestFriend(activeProfile.userId);
          } catch (error) {
            setFriendshipOverride(null);
            throw error;
          }
        } : undefined}
        onUnblock={activeProfile ? () =>
          social.unblockDriver(activeProfile.userId) : undefined}
        onViewProfile={activeProfile ? () => {
          const targetUserId = activeProfile.userId;
          closeDriverProfile();
          router.push({
            pathname: '/(tabs)/public-profile',
            params: { userId: targetUserId },
          } as unknown as Href);
        } : undefined}
        profile={activeProfile}
        visible={Boolean(profileTarget)}
      />
      <GlobalConvoyInviteModal
        convoys={hostableConvoys}
        driver={convoyTarget}
        onClose={() => setConvoyTarget(null)}
        onInvite={async (convoy, driver) => {
          await social.inviteConvoy(convoy.id, driver.userId);
          await mapWorld.refreshConvoys();
          setConvoyTarget(null);
        }}
      />
      <RouteSummaryModal
        key={routeSummary?.id ?? 'route-summary-empty'}
        onClose={() => {
          setRouteSummary(null);
          void clearPendingRouteSummary();
        }}
        protectEndpoints={profile?.privacy?.safeZoneEnabled !== false}
        summary={routeSummary}
      />
    </DriverProfileContext.Provider>
  );
}

export function useDriverProfile() {
  const context = useContext(DriverProfileContext);
  if (!context) {
    throw new Error('useDriverProfile, DriverProfileProvider içinde kullanılmalıdır.');
  }
  return context;
}

function resolveFriendshipState(
  profile: DriverSummary | null,
  social: ReturnType<typeof useSocialWorld>,
): ProfileFriendshipState {
  if (!profile) return 'none';
  if (profile.userId === social.currentUserId) return 'self';
  if (social.blocked.some((driver) => driver.userId === profile.userId)) return 'blocked';
  if (social.friends.some((driver) => driver.userId === profile.userId)) return 'accepted';
  if (social.incoming.some((driver) => driver.userId === profile.userId)) return 'incoming';
  if (social.outgoing.some((driver) => driver.userId === profile.userId)) return 'outgoing';
  return profile.friendshipStatus ?? 'none';
}

function GlobalConvoyInviteModal({
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
            <Text style={styles.title}>Konvoy Seç</Text>
            <Text style={styles.meta}>{driver?.fullName || driver?.model}</Text>
          </View>
          <Pressable accessibilityLabel="Konvoy seçimini kapat" onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={21} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {convoys.length ? convoys.map((convoy) => {
            const invited = convoy.invitedGuests?.some((item) => item.userId === driver?.userId);
            return (
              <Pressable
                accessibilityLabel={`${convoy.name} konvoyuna davet et`}
                disabled={invited || !driver}
                key={convoy.id}
                onPress={() => {
                  if (driver) void onInvite(convoy, driver);
                }}
                style={({ pressed }) => [
                  styles.convoyCard,
                  invited && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.icon}>
                  <Ionicons name="navigate" size={18} color={colors.limeBright} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.convoyName}>{convoy.name}</Text>
                  <Text style={styles.meta}>
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
          }) : (
            <Text style={styles.empty}>
              Davet gönderebileceğiniz planlı bir konvoy yok.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = createThemedStyles(() => ({
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    minHeight: 80,
    paddingHorizontal: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 19 },
  meta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  close: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, gap: 9 },
  convoyCard: {
    minHeight: 72,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoyName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  empty: {
    paddingVertical: 36,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
