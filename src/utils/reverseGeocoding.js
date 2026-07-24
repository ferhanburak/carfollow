import { getDistanceMeters } from "./driveTelemetry";

const NEIGHBORHOOD_TYPES = [
  "neighborhood",
  "sublocality_level_2",
  "sublocality_level_1",
  "administrative_area_level_4",
];

const DISTRICT_TYPES = [
  "administrative_area_level_2",
  "administrative_area_level_3",
  "sublocality_level_1",
  "locality",
];

const CITY_TYPES = ["administrative_area_level_1", "locality"];

function findAddressComponent(results, acceptedTypes) {
  for (const result of results ?? []) {
    for (const component of result.address_components ?? []) {
      if (acceptedTypes.some((type) => component.types?.includes(type))) {
        return component.long_name;
      }
    }
  }

  return "";
}

export function formatDistrictLocation(results) {
  const neighborhood = findAddressComponent(results, NEIGHBORHOOD_TYPES);
  const district = findAddressComponent(results, DISTRICT_TYPES);
  const city = findAddressComponent(results, CITY_TYPES);
  const labels = [neighborhood, district || city]
    .filter(Boolean)
    .filter((label, index, values) => values.indexOf(label) === index);

  return labels.slice(0, 2).join(" / ");
}

export function shouldRefreshResolvedLocation(previous, current, now = Date.now()) {
  if (!current) return false;
  if (!previous?.location || !previous?.resolvedAt) return true;

  return (
    getDistanceMeters(previous.location, current) >= 300
    || now - previous.resolvedAt >= 120_000
  );
}
