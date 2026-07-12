import { getPinIcon } from "../constants/pins";
import { resolveAppId } from "../services/firebasePaths.js";
import { createDefaultParts, inferVehicleType, normalizeVehicleParts } from "../utils/vehicleParts";

export const appId = resolveAppId();

function buildParts(model, baseKm, overrides = {}) {
  const vehicleType = inferVehicleType(model);
  const defaultParts = createDefaultParts(vehicleType, baseKm);

  return normalizeVehicleParts(
    defaultParts.map((part) => ({
      ...part,
      ...(overrides[part.key] ?? {}),
    })),
    vehicleType,
  );
}

// Firestore public collections:
// /artifacts/{appId}/public/data/{collectionName}
// Firestore private user collections:
// /artifacts/{appId}/users/{userId}/{collectionName}
// Keep deep sorting/filtering on the client to avoid index-heavy query shapes.
// Plate-based DM should move to Firebase Realtime Database for lower latency.

export const quickProfiles = [
  {
    id: "p1",
    fullName: "Poyraz Alkan",
    plate: "06 PWA 101",
    password: "seat1907",
    model: "Seat Ibiza Cupra",
    tuningStage: "Stage 2+",
    horsepower: 248,
    garage: "Ankara Apex Garage",
    odometer: 68420,
    badges: ["Gece Savascisi", "Asfalt Aglatan", "Grid Hunter"],
    clan: "Neon Wolves",
    clanRole: "owner",
    region: "Ankara Bati",
    avatar:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
    vehicleType: "car",
    parts: buildParts("Seat Ibiza Cupra", 68420, {
      oil: { replacedKm: 64500, replacedAt: "2026-03-10" },
      oilFilter: { replacedKm: 64500, replacedAt: "2026-03-10" },
      airFilter: { replacedKm: 63200, replacedAt: "2026-01-18" },
      cabinFilter: { replacedKm: 62050, replacedAt: "2025-12-14" },
      spark: { replacedKm: 52000, replacedAt: "2025-05-24" },
      coolant: { replacedKm: 46800, replacedAt: "2025-02-12" },
      battery: { replacedKm: 41000, replacedAt: "2024-10-04" },
      transmissionFluid: { replacedKm: 37800, replacedAt: "2024-06-22" },
      frontBrakes: { replacedKm: 59200, replacedAt: "2025-11-02" },
      rearBrakes: { replacedKm: 55100, replacedAt: "2025-08-08" },
      frontTires: { replacedKm: 49500, replacedAt: "2025-04-16" },
      rearTires: { replacedKm: 44800, replacedAt: "2024-12-06" },
    }),
    serviceLogs: [
      { id: "s1", partKey: "oil", type: "replacement", serviceDate: "2026-03-10", serviceKm: 64500, serviceShop: "Ankara Apex Garage", cost: 2250, notes: "5W-40 ve filtre seti degisti." },
      { id: "s2", partKey: "frontBrakes", type: "replacement", serviceDate: "2025-11-02", serviceKm: 59200, serviceShop: "Ankara Apex Garage", cost: 4850, notes: "On balatalar ve disk kontrolu yapildi." },
      { id: "s3", partKey: "frontTires", type: "replacement", serviceDate: "2025-04-16", serviceKm: 49500, serviceShop: "Ankara Apex Garage", cost: 13200, notes: "On lastikler performans seti ile yenilendi." },
    ],
    fuelLogs: [
      { id: "f1", liters: 36, price: 1848, currentKm: 68110, station: "OPET Bilkent" },
      { id: "f2", liters: 32, price: 1664, currentKm: 67640, station: "Shell Esenboga" },
      { id: "f3", liters: 34, price: 1734, currentKm: 67120, station: "Total Cayyolu" },
    ],
    monthlyKm: 842,
    driverScore: 91,
    harmonyVotes: 17,
    alertVotes: 1,
    friends: [
      {
        userId: "seed-35-srt-908",
        plate: "35 SRT 908",
        fullName: "Ece Yalin",
        model: "Ducati Monster",
        region: "Izmir Cevre",
        clan: "Midnight Apex",
        avatar: "",
        status: "accepted",
        createdAt: 1751902200000,
      },
    ],
    incomingRequests: [
      {
        userId: "seed-34-turbo-54",
        plate: "34 TURBO 54",
        fullName: "Can Sarp",
        model: "Golf GTI Clubsport",
        region: "Istanbul Avrupa",
        clan: "Turbo Syndicate",
        avatar: "",
        status: "pending",
        createdAt: 1752229800000,
      },
    ],
    outgoingRequests: [
      {
        userId: "seed-16-gti-232",
        plate: "16 GTI 232",
        fullName: "Mete Alp",
        model: "Golf GTI",
        region: "Bursa Ring",
        clan: "Neon Wolves",
        avatar: "",
        status: "pending",
        createdAt: 1752143400000,
      },
    ],
    clanInvites: [
      {
        id: "clan-invite-seed-1",
        clanId: "c2",
        clanName: "Midnight Apex",
        clanTag: "APEX",
        fromPlate: "35 SRT 908",
        fromName: "Ece Yalin",
        targetPlate: "06 PWA 101",
        targetName: "Poyraz Alkan",
        targetModel: "Seat Ibiza Cupra",
        createdAt: 1752236400000,
        status: "pending",
      },
    ],
    sentClanInvites: [
      {
        id: "clan-sent-seed-1",
        clanId: "c1",
        clanName: "Neon Wolves",
        clanTag: "WOLF",
        fromPlate: "06 PWA 101",
        fromName: "Poyraz Alkan",
        targetPlate: "35 SRT 908",
        targetName: "Ece Yalin",
        targetModel: "Ducati Monster",
        createdAt: 1752237000000,
        status: "pending",
      },
    ],
    conversations: {
      "06_PWA_101__35_SRT_908": {
        id: "06_PWA_101__35_SRT_908",
        participantPlate: "35 SRT 908",
        participantName: "Ece Yalin",
        participantModel: "Ducati Monster",
        participantAvatar: "",
        messages: [
          {
            id: "msg-seed-1",
            authorPlate: "35 SRT 908",
            authorName: "Ece Yalin",
            body: "Mogan cikisi icin 22:30 bulusalim mi?",
            createdAt: 1752231600000,
          },
          {
            id: "msg-seed-2",
            authorPlate: "06 PWA 101",
            authorName: "Poyraz Alkan",
            body: "Olur, ben de route'u hazirliyorum.",
            createdAt: 1752232200000,
          },
        ],
      },
    },
  },
  {
    id: "p2",
    fullName: "Mert Ozan",
    plate: "34 MOTO 410",
    password: "r6track",
    model: "Yamaha R6",
    tuningStage: "Stage 1",
    horsepower: 132,
    garage: "MotoLab Istanbul",
    odometer: 28140,
    badges: ["Viraj Krali", "Night Run", "Quick Launch"],
    clan: "Midnight Apex",
    clanRole: "member",
    region: "Istanbul Kuzey",
    avatar:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80",
    vehicleType: "motorcycle",
    parts: buildParts("Yamaha R6", 28140, {
      oil: { replacedKm: 25800, replacedAt: "2026-04-18" },
      oilFilter: { replacedKm: 25800, replacedAt: "2026-04-18" },
      airFilter: { replacedKm: 23500, replacedAt: "2026-01-11" },
      spark: { replacedKm: 21000, replacedAt: "2025-08-01" },
      coolant: { replacedKm: 20200, replacedAt: "2025-06-22" },
      battery: { replacedKm: 18050, replacedAt: "2025-02-10" },
      chain: { replacedKm: 22400, replacedAt: "2025-10-02" },
      clutch: { replacedKm: 17300, replacedAt: "2024-12-18" },
      frontBrakes: { replacedKm: 24100, replacedAt: "2025-12-12" },
      rearBrakes: { replacedKm: 21600, replacedAt: "2025-09-20" },
      frontTires: { replacedKm: 20880, replacedAt: "2025-08-12" },
      rearTires: { replacedKm: 23340, replacedAt: "2026-02-20" },
    }),
    serviceLogs: [
      { id: "ms1", partKey: "oil", type: "replacement", serviceDate: "2026-04-18", serviceKm: 25800, serviceShop: "MotoLab Istanbul", cost: 1650, notes: "Sentetik yag ve filtre degisimi." },
      { id: "ms2", partKey: "frontBrakes", type: "inspection", serviceDate: "2026-02-08", serviceKm: 24940, serviceShop: "MotoLab Istanbul", cost: 450, notes: "Balata kalinligi olculdu, degisim gerekmiyor." },
      { id: "ms3", partKey: "chain", type: "repair", serviceDate: "2025-10-02", serviceKm: 22400, serviceShop: "MotoLab Istanbul", cost: 1200, notes: "Zincir gergisi ve temizligi yapildi." },
    ],
    fuelLogs: [
      { id: "m1", liters: 14, price: 714, currentKm: 27980, station: "BP Atasehir" },
      { id: "m2", liters: 15, price: 765, currentKm: 27610, station: "Petrol Ofisi Kadikoy" },
      { id: "m3", liters: 13, price: 663, currentKm: 27260, station: "Aytemiz Bostanci" },
    ],
    monthlyKm: 706,
    driverScore: 88,
    harmonyVotes: 12,
    alertVotes: 2,
    friends: [
      {
        userId: "seed-34-turbo-54",
        plate: "34 TURBO 54",
        fullName: "Can Sarp",
        model: "Golf GTI Clubsport",
        region: "Istanbul Avrupa",
        clan: "Turbo Syndicate",
        avatar: "",
        status: "accepted",
        createdAt: 1751821200000,
      },
    ],
    incomingRequests: [],
    outgoingRequests: [
      {
        userId: "seed-07-vtec-707",
        plate: "07 VTEC 707",
        fullName: "Deniz Korhan",
        model: "Honda Civic FB7",
        region: "Antalya Sahil",
        clan: "Lowline Union",
        avatar: "",
        status: "pending",
        createdAt: 1752172200000,
      },
    ],
    clanInvites: [
      {
        id: "clan-invite-seed-2",
        clanId: "c3",
        clanName: "Turbo Syndicate",
        clanTag: "TRBO",
        fromPlate: "34 TURBO 54",
        fromName: "Can Sarp",
        targetPlate: "34 MOTO 410",
        targetName: "Mert Ozan",
        targetModel: "Yamaha R6",
        createdAt: 1752237600000,
        status: "pending",
      },
    ],
    sentClanInvites: [],
    conversations: {
      "34_MOTO_410__34_TURBO_54": {
        id: "34_MOTO_410__34_TURBO_54",
        participantPlate: "34 TURBO 54",
        participantName: "Can Sarp",
        participantModel: "Golf GTI Clubsport",
        participantAvatar: "",
        messages: [
          {
            id: "msg-seed-3",
            authorPlate: "34 TURBO 54",
            authorName: "Can Sarp",
            body: "Arkadaslara ozel mini konvoy acalim mi?",
            createdAt: 1752235200000,
          },
        ],
      },
    },
  },
];

export const individualDriverSeed = [
  {
    plate: "34 TURBO 54",
    fullName: "Can Sarp",
    model: "Golf GTI Clubsport",
    region: "Istanbul Avrupa",
    clan: "Turbo Syndicate",
    monthlyKm: 918,
    driverScore: 93,
    harmonyVotes: 19,
    alertVotes: 1,
  },
  {
    plate: "35 SRT 908",
    fullName: "Ece Yalin",
    model: "Ducati Monster",
    region: "Izmir Cevre",
    clan: "Midnight Apex",
    monthlyKm: 774,
    driverScore: 89,
    harmonyVotes: 14,
    alertVotes: 2,
  },
  {
    plate: "16 GTI 232",
    fullName: "Mete Alp",
    model: "Golf GTI",
    region: "Bursa Ring",
    clan: "Neon Wolves",
    monthlyKm: 688,
    driverScore: 84,
    harmonyVotes: 11,
    alertVotes: 3,
  },
  {
    plate: "07 VTEC 707",
    fullName: "Deniz Korhan",
    model: "Honda Civic FB7",
    region: "Antalya Sahil",
    clan: "Lowline Union",
    monthlyKm: 521,
    driverScore: 54,
    harmonyVotes: 4,
    alertVotes: 7,
  },
];

export const initialMapPins = [
  {
    id: "spot-1",
    type: "spot",
    icon: getPinIcon("spot"),
    name: "Mogan Lake Sunset",
    lat: 39.7869,
    lng: 32.8068,
    x: "22%",
    y: "28%",
    likes: 128,
    galleryLikes: 314,
    tags: ["#SmoothAsphalt", "#EpicSunset", "#CinematicPull"],
    description: "Golden hour rollers ve dusuk trafikli sahil hatti.",
    gallery: [
      {
        id: "g1",
        title: "Lake Line",
        likes: 78,
        author: "06 PWA 101",
        imageUrl:
          "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "g2",
        title: "Rear Diff Glow",
        likes: 59,
        author: "34 MOTO 410",
        imageUrl:
          "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "wash-1",
    type: "wash",
    icon: getPinIcon("wash"),
    name: "Foam District Self Wash",
    lat: 39.9042,
    lng: 32.7315,
    x: "61%",
    y: "46%",
    rating: { foam: 4.2, water: 3.7, reviews: 3, allowsBuckets: 2, shadowDrying: 1 },
    reviews: [
      {
        id: "r1",
        author: "06 PWA 101",
        foam: 5,
        water: 4,
        allowsBuckets: true,
        shadowDrying: true,
        note: "Kopuk dolgun, kurutma alani biraz dar.",
      },
      {
        id: "r2",
        author: "34 TURBO 54",
        foam: 4,
        water: 3,
        allowsBuckets: true,
        shadowDrying: false,
        note: "Basinc iyi ama kirec bazen belli oluyor.",
      },
      {
        id: "r3",
        author: "35 HND 192",
        foam: 4,
        water: 4,
        allowsBuckets: false,
        shadowDrying: false,
        note: "Gece saatinde sakin oluyor.",
      },
    ],
  },
  {
    id: "wash-2",
    type: "wash",
    icon: getPinIcon("wash"),
    name: "Night Mist Wash Hub",
    lat: 39.8544,
    lng: 32.8391,
    x: "74%",
    y: "38%",
    rating: { foam: 4.7, water: 4.4, reviews: 2, allowsBuckets: 2, shadowDrying: 2 },
    reviews: [
      {
        id: "r4",
        author: "34 MOTO 410",
        foam: 5,
        water: 4,
        allowsBuckets: true,
        shadowDrying: true,
        note: "Jet guclu, gece aydinlatmasi baya iyi.",
      },
      {
        id: "r5",
        author: "06 PWA 101",
        foam: 4,
        water: 5,
        allowsBuckets: true,
        shadowDrying: true,
        note: "Kirec dusuk, bezle kurulama alani rahat.",
      },
    ],
  },
  {
    id: "meet-1",
    type: "meet",
    icon: getPinIcon("meet"),
    name: "Sahil Midnight Cruise",
    lat: 39.8422,
    lng: 32.7827,
    x: "43%",
    y: "72%",
    time: "23:30",
    route: "Beytepe -> Incek -> Mogan",
    routePath: [
      { lat: 39.9042, lng: 32.7315 },
      { lat: 39.8728, lng: 32.7562 },
      { lat: 39.8422, lng: 32.7827 },
      { lat: 39.8124, lng: 32.7961 },
      { lat: 39.7869, lng: 32.8068 },
    ],
    attendees: [
      {
        plate: "06 PWA 101",
        fullName: "Poyraz Alkan",
        model: "Seat Ibiza Cupra",
        region: "Ankara Bati",
        score: 91,
        harmonyVotes: 17,
        alertVotes: 1,
        status: "Uyumlu",
      },
      {
        plate: "34 MOTO 410",
        fullName: "Mert Ozan",
        model: "Yamaha R6",
        region: "Istanbul Kuzey",
        score: 88,
        harmonyVotes: 12,
        alertVotes: 2,
        status: "Convoy Ready",
      },
      {
        plate: "07 VTEC 707",
        fullName: "Deniz Korhan",
        model: "Honda Civic FB7",
        region: "Antalya Sahil",
        score: 54,
        harmonyVotes: 4,
        alertVotes: 7,
        status: "Watchlist",
      },
    ],
  },
];

export const initialClans = [
  { id: "c1", name: "Neon Wolves", tag: "WOLF", description: "Ankara cikisli gece surusu ve hatchback odakli ekip.", km: 14280, members: 31, captainPlate: "06 PWA 101", visibility: "friends" },
  { id: "c2", name: "Midnight Apex", tag: "APEX", description: "Sport bike ve precision cruise karisimi premium convoy ekibi.", km: 12840, members: 28, captainPlate: "35 SRT 908", visibility: "public" },
  { id: "c3", name: "Turbo Syndicate", tag: "TRBO", description: "Istanbul merkezli hizli organize bulusma ve rolling squad.", km: 11770, members: 24, captainPlate: "34 TURBO 54", visibility: "public" },
  { id: "c4", name: "Lowline Union", tag: "LOW", description: "Fitment, static setup ve chill route seven suruculerin grubu.", km: 9640, members: 19, captainPlate: "07 VTEC 707", visibility: "friends" },
];

export const initialDrivers = [
  { plate: "34 MOTO 410", vehicle: "Yamaha R6", node: "FSM Koprusu", speed: 102 },
  { plate: "06 PWA 101", vehicle: "Seat Ibiza Cupra", node: "Eskisehir Yolu", speed: 96 },
  { plate: "16 GTI 232", vehicle: "Golf GTI", node: "Bursa Ring", speed: 108 },
  { plate: "35 SRT 908", vehicle: "Ducati Monster", node: "Izmir Cevre", speed: 99 },
];

export const tuningOptions = ["Stock", "Stage 1", "Stage 2+", "Stage 3"];

export const navItems = [
  { key: "map", label: "Harita", icon: "Grid" },
  { key: "liveMap", label: "Live Map", icon: "Map" },
  { key: "drive", label: "Surus", icon: "HUD" },
  { key: "clans", label: "Stats", icon: "Rank" },
  { key: "garage", label: "Garaj", icon: "Servis" },
];

export const socialDirectorySeed = [
  ...quickProfiles.map((profile) => ({
    userId: profile.id,
    plate: profile.plate,
    fullName: profile.fullName,
    model: profile.model,
    region: profile.region,
    clan: profile.clan,
    avatar: profile.avatar,
    driverScore: profile.driverScore,
    monthlyKm: profile.monthlyKm,
  })),
  ...individualDriverSeed.map((profile) => ({
    ...profile,
    userId: `seed-${profile.plate.toLowerCase().replaceAll(" ", "-")}`,
    avatar: "",
  })),
];
