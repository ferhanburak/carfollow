export const PIN_TYPE_META = Object.freeze({
  spot: {
    icon: "📸",
    label: "Photo Spot",
  },
  wash: {
    icon: "🧼",
    label: "Car Wash",
  },
  meet: {
    icon: "🏍️",
    label: "Cruise Meet",
  },
});

export function getPinTypeMeta(type) {
  return PIN_TYPE_META[type] ?? PIN_TYPE_META.meet;
}

export function getPinIcon(type) {
  return getPinTypeMeta(type).icon;
}
