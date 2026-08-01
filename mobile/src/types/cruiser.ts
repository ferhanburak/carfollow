export type DriverSummary = {
  userId: string;
  id?: string;
  fullName?: string;
  plate?: string;
  plateMasked?: string;
  model?: string;
  region?: string;
  driverScore?: number;
  score?: number;
  monthlyKm?: number;
  harmonyVotes?: number;
  alertVotes?: number;
  communityEventLikesReceived?: number;
  communityPhotoLikesReceived?: number;
  communityHelpfulVotesReceived?: number;
  communityKudos?: number;
  avatar?: string;
  clan?: string;
  clanId?: string;
  vehicleType?: string;
  relation?: 'self' | 'friend' | 'clan' | 'convoy' | 'stranger';
  friendshipId?: string;
  friendshipStatus?: 'none' | 'incoming' | 'outgoing' | 'accepted';
  status?: string;
};

export type Friendship = {
  id: string;
  participantIds: string[];
  requesterUserId: string;
  targetUserId: string;
  requesterProfile?: DriverSummary;
  targetProfile?: DriverSummary;
  status: 'pending' | 'accepted';
  createdAt: number;
};

export type Clan = {
  id: string;
  name: string;
  tag: string;
  description?: string;
  ownerUserId?: string;
  memberCount?: number;
  members?: number;
  monthlyKm?: number;
  monthlyDriveSeconds?: number;
  monthlyMaxSpeedKmh?: number;
};

export type ClanMember = DriverSummary & {
  id: string;
  clanId: string;
  role: 'owner' | 'captain' | 'member';
  joinedAt?: number;
};

export type ClanInvite = {
  id: string;
  clanId: string;
  clanName?: string;
  clanTag?: string;
  targetUserId: string;
  targetName?: string;
  targetPlate?: string;
  invitedByUserId: string;
  invitedByName?: string;
  status?: string;
  createdAt: number;
};

export type MapPin = {
  id: string;
  type: 'spot' | 'wash' | 'meet';
  name: string;
  description?: string;
  lat: number;
  lng: number;
  tags?: string[];
  likes?: number;
  galleryLikes?: number;
  photoCount?: number;
  createdByName?: string;
  createdByPlate?: string;
  rating?: {
    foam?: number;
    water?: number;
    reviews?: number;
    allowsBuckets?: number;
    shadowDrying?: number;
  };
  route?: string;
  routePath?: { lat: number; lng: number }[];
  time?: string;
  eventMode?: 'meetup' | 'convoy';
  visibility?: 'public' | 'friends' | 'clan';
  accessPolicy?: 'open' | 'request';
  detailVisibility?: string;
  clanId?: string;
  createdByClan?: string;
  hostUserId?: string;
  createdByUid?: string;
  capacity?: number;
  approvedCount?: number;
  minDriverScore?: number;
  minHarmonyVotes?: number;
  maxAlertVotes?: number;
  scheduledStartAtMs?: number;
  lifecycleStatus?: string;
  backendCanJoin?: boolean;
  backendCanLike?: boolean;
  backendCanViewDetails?: boolean;
  backendAccessReason?: string;
  viewerManagementRole?: 'host' | 'manager' | 'member' | '';
  invitedGuests?: DriverSummary[];
  pendingRequests?: DriverSummary[];
  attendees?: DriverSummary[];
};

export type DirectMessage = {
  id: string;
  senderUserId?: string;
  senderUid?: string;
  body: string;
  createdAt: number;
  share?: {
    type: 'forum' | 'event';
    targetId: string;
    title?: string;
    preview?: string;
    imageUrl?: string;
  };
};

export type DirectMessageThread = {
  id: string;
  participantUserId: string;
  participantName: string;
  participantPlate: string;
  participantModel: string;
  messages: DirectMessage[];
  lastReadAt: number;
  updatedAt: number;
};

export type CruiserNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: number;
  readAt: number | null;
};

export type LeaderboardEntry = {
  id: string;
  userId?: string;
  clanId?: string;
  fullName?: string;
  model?: string;
  clanName?: string;
  name?: string;
  memberCount?: number;
  driverScore?: number;
  dailyKm?: number;
  dailyDriveSeconds?: number;
  dailyMaxSpeedKmh?: number;
  weeklyKm?: number;
  weeklyDriveSeconds?: number;
  weeklyMaxSpeedKmh?: number;
  monthlyKm?: number;
  monthlyDriveSeconds?: number;
  monthlyMaxSpeedKmh?: number;
  dailyPeriodKey?: string;
  weeklyPeriodKey?: string;
  periodKey?: string;
};
