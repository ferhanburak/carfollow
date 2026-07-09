import { resolveAppId } from "../services/firebasePaths.js";

export const appId = resolveAppId();

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
    region: "Ankara Bati",
    avatar:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
    parts: [
      { key: "oil", name: "Engine Oil", replacedKm: 64500, lifeExpectancy: 8000 },
      { key: "brakes", name: "Brake Pads", replacedKm: 59200, lifeExpectancy: 18000 },
      { key: "spark", name: "Spark Plugs", replacedKm: 52000, lifeExpectancy: 30000 },
    ],
    fuelLogs: [
      { id: "f1", liters: 36, price: 1848, currentKm: 68110, station: "OPET Bilkent" },
      { id: "f2", liters: 32, price: 1664, currentKm: 67640, station: "Shell Esenboga" },
      { id: "f3", liters: 34, price: 1734, currentKm: 67120, station: "Total Cayyolu" },
    ],
    driverScore: 91,
    harmonyVotes: 17,
    alertVotes: 1,
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
    region: "Istanbul Kuzey",
    avatar:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80",
    parts: [
      { key: "oil", name: "Engine Oil", replacedKm: 25800, lifeExpectancy: 5000 },
      { key: "brakes", name: "Brake Pads", replacedKm: 24100, lifeExpectancy: 14000 },
      { key: "spark", name: "Spark Plugs", replacedKm: 21000, lifeExpectancy: 20000 },
    ],
    fuelLogs: [
      { id: "m1", liters: 14, price: 714, currentKm: 27980, station: "BP Atasehir" },
      { id: "m2", liters: 15, price: 765, currentKm: 27610, station: "Petrol Ofisi Kadikoy" },
      { id: "m3", liters: 13, price: 663, currentKm: 27260, station: "Aytemiz Bostanci" },
    ],
    driverScore: 88,
    harmonyVotes: 12,
    alertVotes: 2,
  },
];

export const initialMapPins = [
  {
    id: "spot-1",
    type: "spot",
    icon: "📸",
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
    icon: "🧼",
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
    icon: "ğŸ§¼",
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
    icon: "🏍️",
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
  { id: "c1", name: "Neon Wolves", km: 14280, members: 31 },
  { id: "c2", name: "Midnight Apex", km: 12840, members: 28 },
  { id: "c3", name: "Turbo Syndicate", km: 11770, members: 24 },
  { id: "c4", name: "Lowline Union", km: 9640, members: 19 },
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
  { key: "drive", label: "Surus", icon: "HUD" },
  { key: "clans", label: "Klanlar", icon: "Crew" },
  { key: "garage", label: "Garaj", icon: "Servis" },
];
