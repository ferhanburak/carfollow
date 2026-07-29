export type DriverSummary = {
  userId: string;
  fullName?: string;
  plate?: string;
  plateMasked?: string;
  model?: string;
  region?: string;
  driverScore?: number;
  friendshipId?: string;
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
  capacity?: number;
  approvedCount?: number;
  lifecycleStatus?: string;
  backendCanJoin?: boolean;
  backendCanViewDetails?: boolean;
  backendAccessReason?: string;
  attendees?: DriverSummary[];
};

export type DirectMessage = {
  id: string;
  senderUserId?: string;
  senderUid?: string;
  body: string;
  createdAt: number;
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
