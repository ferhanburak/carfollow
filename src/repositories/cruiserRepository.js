export {
  appendFuelLog,
  appendServiceLog,
  appendMapPin,
  appendSpotPhoto,
  appendWashReview,
  advanceConvoySimulation,
  buildDriveTickState,
  createAttendeeRecord,
  createAuthenticatedUser,
  createSignedUpUser,
  getInitialWorldState,
  getQuickProfileByCredentials,
  incrementClanKm,
  incrementGalleryLike,
  incrementPinLike,
  incrementUserOdometer,
  inviteCruiseGuest,
  joinCruiseAttendee,
  listQuickProfiles,
  approveCruiseRequest,
  declineCruiseRequest,
  rateCruiseAttendee,
  updateConvoyAttendeeTripStatus,
  updateConvoyLifecycleStatus,
} from "./mockCruiserRepository";

export {
  isFirebaseRepositoryEnabled,
  saveFirebaseActiveDriver,
  subscribeFirebaseActiveDrivers,
  saveFirebaseCruiseJoin,
  saveFirebaseMapPin,
  saveFirebaseUserProfile,
  saveFirebaseWashReview,
} from "./firebaseCruiserRepository";

export {
  ensureFirebaseDirectMessageThread,
  initializeFirebasePresence,
  isFirebaseMessagingRepositoryEnabled,
  markFirebaseConversationRead,
  normalizeFirebaseMessageThread,
  saveFirebasePresenceState,
  saveFirebaseTypingState,
  sendFirebaseDirectMessage,
  subscribeFirebaseDirectMessages,
  subscribeFirebasePresence,
  subscribeFirebaseTyping,
} from "./firebaseMessagingRepository";

export {
  blockFirebaseDriver,
  buildFirebaseSocialState,
  cancelFirebaseFriendshipRequest,
  getFirebasePublicDriverProfile,
  isFirebaseSocialRepositoryEnabled,
  removeFirebaseFriendship,
  requestFirebaseFriendship,
  searchFirebaseDriverByPlate,
  respondFirebaseFriendship,
  subscribeFirebaseSocialState,
  unblockFirebaseDriver,
  updateFirebasePrivacySettings,
} from "./firebaseSocialRepository";

export {
  buildFirebaseClanState,
  cancelFirebaseClanInvite,
  createFirebaseClan,
  inviteFirebaseClanMember,
  isFirebaseClanRepositoryEnabled,
  leaveFirebaseClan,
  removeFirebaseClanMember,
  respondFirebaseClanInvite,
  subscribeFirebaseClanState,
  transferFirebaseClanOwnership,
  updateFirebaseClanMemberRole,
} from "./firebaseClanRepository";

export {
  createFirebaseVehiclePassportExport,
  loadFirebaseVehiclePassportExports,
  loadFirebaseVehiclePassportBundle,
  saveFirebaseFuelLog,
  saveFirebaseServiceLog,
} from "./firebaseVehiclePassportRepository";

export {
  finishFirebaseDriveSession,
  loadFirebaseDriverStatsState,
  loadFirebaseIndividualLeaderboard,
  startFirebaseDriveSession,
} from "./firebaseDriverStatsRepository";

export {
  isFirebaseNotificationRepositoryEnabled,
  markAllFirebaseNotificationsRead,
  markFirebaseNotificationRead,
  subscribeFirebaseNotifications,
} from "./firebaseNotificationRepository";

export {
  isFirebaseModerationRepositoryEnabled,
  submitFirebaseModerationReport,
} from "./firebaseModerationRepository";

export {
  addFirebaseMapSpotPhoto,
  buildFirebaseMapState,
  createFirebaseConvoy,
  createFirebaseMapNode,
  deleteFirebaseConvoy,
  deleteFirebaseMapSpotPhoto,
  inviteFirebaseConvoyMember,
  isFirebaseMapRepositoryEnabled,
  loadFirebaseAccessibleConvoys,
  mergeFirebaseConvoys,
  rateFirebaseConvoyMember,
  removeFirebaseConvoyMember,
  requestFirebaseConvoyJoin,
  respondFirebaseConvoyJoin,
  submitFirebaseWashReview,
  subscribeFirebaseMapState,
  toggleFirebaseMapLike,
  updateFirebaseConvoyLifecycle,
  updateFirebaseConvoyTripStatus,
} from "./firebaseMapRepository";

export {
  isFirebaseAuthRepositoryEnabled,
  deleteFirebaseAccount,
  exportFirebaseAccountData,
  loadFirebaseAuthenticatedProfile,
  registerFirebaseAccount,
  sendFirebaseEmailVerification,
  sendFirebasePasswordReset,
  signInFirebaseAccount,
  signOutFirebaseAccount,
  subscribeFirebaseAuthState,
  withdrawFirebasePrivacyConsent,
} from "./firebaseAuthRepository";

export {
  deleteFirebaseProfileAvatar,
  isFirebaseProfileRepositoryEnabled,
  updateFirebaseVehicleProfile,
  uploadFirebaseProfileAvatar,
} from "./firebaseProfileRepository";
