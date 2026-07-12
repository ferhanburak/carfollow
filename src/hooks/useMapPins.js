import { useEffect, useMemo, useState } from "react";
import {
  appendMapPin,
  appendSpotPhoto,
  appendWashReview,
  createAttendeeRecord,
  incrementGalleryLike,
  incrementPinLike,
  joinCruiseAttendee,
  rateCruiseAttendee,
  saveFirebaseCruiseJoin,
  saveFirebaseMapPin,
  saveFirebaseWashReview,
} from "../repositories/cruiserRepository";
import { getPinIcon } from "../constants/pins";
import {
  createMapPinForm,
  createSpotPhotoForm,
  createWashForm,
} from "../utils/garage";
import {
  validateMapPinForm,
  validateSpotPhotoForm,
  validateWashForm,
} from "../utils/validation";
import { filterVisibleMapPins } from "../utils/meetVisibility";

function parseTags(rawTags) {
  return rawTags
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function buildFallbackGridPosition(lat, lng, pins) {
  const latitudes = [...pins.map((pin) => pin.lat).filter((value) => typeof value === "number"), lat];
  const longitudes = [...pins.map((pin) => pin.lng).filter((value) => typeof value === "number"), lng];
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const normalizedX = 15 + ((lng - minLng) / lngRange) * 70;
  const normalizedY = 85 - ((lat - minLat) / latRange) * 70;

  return {
    x: `${normalizedX.toFixed(0)}%`,
    y: `${normalizedY.toFixed(0)}%`,
  };
}

function buildMeetRoutePath(lat, lng) {
  return [
    { lat: Number((lat + 0.028).toFixed(4)), lng: Number((lng - 0.051).toFixed(4)) },
    { lat: Number((lat + 0.013).toFixed(4)), lng: Number((lng - 0.021).toFixed(4)) },
    { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
  ];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Photo file could not be read."));
    reader.readAsDataURL(file);
  });
}

export function useMapPins({ initialWorld, user }) {
  const [mapPins, setMapPins] = useState(initialWorld.mapPins);
  const [selectedPinId, setSelectedPinId] = useState(initialWorld.mapPins[0].id);
  const [washForm, setWashForm] = useState(createWashForm);
  const [washErrors, setWashErrors] = useState({});
  const [washFeedback, setWashFeedback] = useState("");
  const [mapPinForm, setMapPinForm] = useState(() => createMapPinForm(initialWorld.mapPins[0]));
  const [mapPinErrors, setMapPinErrors] = useState({});
  const [mapPinFeedback, setMapPinFeedback] = useState("");
  const [mapDraftLocation, setMapDraftLocation] = useState(null);
  const [mapPickMode, setMapPickMode] = useState("node");
  const [spotPhotoForm, setSpotPhotoForm] = useState(createSpotPhotoForm);
  const [spotPhotoErrors, setSpotPhotoErrors] = useState({});
  const [spotPhotoFeedback, setSpotPhotoFeedback] = useState("");

  const visibleMapPins = useMemo(() => filterVisibleMapPins(mapPins, user), [mapPins, user]);
  const selectedPin = visibleMapPins.find((pin) => pin.id === selectedPinId) ?? visibleMapPins[0] ?? null;

  useEffect(() => {
    if (!visibleMapPins.length) {
      return;
    }

    const selectedStillVisible = visibleMapPins.some((pin) => pin.id === selectedPinId);
    if (!selectedStillVisible) {
      setSelectedPinId(visibleMapPins[0].id);
    }
  }, [selectedPinId, visibleMapPins]);

  const likePin = () => {
    if (!selectedPin) {
      return;
    }
    setMapPins((current) => incrementPinLike(current, selectedPin.id));
  };

  const likeGalleryImage = (galleryId) => {
    if (!selectedPin) {
      return;
    }
    setMapPins((current) => incrementGalleryLike(current, selectedPin.id, galleryId));
  };

  const submitWashReview = (event) => {
    event.preventDefault();
    if (!user || !selectedPin || selectedPin.type !== "wash") {
      return;
    }

    const validationErrors = validateWashForm(washForm);
    setWashErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const review = {
      id: `review-${Date.now()}`,
      author: user.plate,
      foam: Number(washForm.foam),
      water: Number(washForm.water),
      allowsBuckets: washForm.allowsBuckets,
      shadowDrying: washForm.shadowDrying,
      note: washForm.note,
    };

    let nextPin = null;
    setMapPins((current) => {
      const nextPins = appendWashReview(current, selectedPin.id, review);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });
    setWashForm(createWashForm());
    setWashErrors({});
    setWashFeedback("Review added successfully.");
    void saveFirebaseWashReview(selectedPin.id, review);
    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const joinCruise = () => {
    if (!user || !selectedPin || selectedPin.type !== "meet") {
      return;
    }

    const attendee = createAttendeeRecord(user);
    let nextPin = null;
    setMapPins((current) => {
      const nextPins = joinCruiseAttendee(current, selectedPin.id, attendee);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });
    void saveFirebaseCruiseJoin(selectedPin.id, user.plate);
    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const rateAttendee = (plate, signal) => {
    if (!selectedPin || selectedPin.type !== "meet") {
      return;
    }

    let nextPin = null;
    setMapPins((current) => {
      const nextPins = rateCruiseAttendee(current, selectedPin.id, plate, signal);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });

    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const useSelectedPinCoordinates = () => {
    if (!selectedPin) {
      return;
    }

    setMapPinForm((current) => ({
      ...current,
      lat: selectedPin.lat ?? current.lat,
      lng: selectedPin.lng ?? current.lng,
    }));
    setMapDraftLocation({
      lat: selectedPin.lat ?? mapPinForm.lat,
      lng: selectedPin.lng ?? mapPinForm.lng,
      source: "selected",
    });
  };

  const clearDraftRoute = () => {
    setMapPinForm((current) => ({
      ...current,
      routePoints: [],
    }));
    setMapPickMode("node");
    setMapPinFeedback("Taslak event rotasi temizlendi.");
  };

  const removeLastDraftRoutePoint = () => {
    setMapPinForm((current) => ({
      ...current,
      routePoints: current.routePoints.slice(0, -1),
    }));
    setMapPinFeedback("Son rota noktasi kaldirildi.");
  };

  const pickMapLocation = (coords) => {
    if (!coords) {
      return;
    }

    const normalizedCoords = {
      lat: Number(coords.lat.toFixed(4)),
      lng: Number(coords.lng.toFixed(4)),
    };

    if (mapPinForm.type === "meet" && mapPickMode === "route") {
      setMapPinForm((current) => ({
        ...current,
        routePoints: [...current.routePoints, normalizedCoords],
      }));
      setMapPinFeedback("Rota noktasI taslaga eklendi.");
      setMapPinErrors((current) => ({
        ...current,
        routePoints: undefined,
      }));
      return;
    }

    setMapPinForm((current) => ({
      ...current,
      lat: normalizedCoords.lat,
      lng: normalizedCoords.lng,
    }));
    setMapDraftLocation({
      lat: normalizedCoords.lat,
      lng: normalizedCoords.lng,
      source: "map",
    });
    setMapPinFeedback("Map uzerinden yeni lokasyon secildi.");
    setMapPinErrors((current) => ({
      ...current,
      lat: undefined,
      lng: undefined,
    }));
  };

  const submitMapPin = (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    const validationErrors = validateMapPinForm(mapPinForm);
    setMapPinErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const lat = Number(mapPinForm.lat);
    const lng = Number(mapPinForm.lng);
    const fallbackPosition = buildFallbackGridPosition(lat, lng, mapPins);
    const basePin = {
      id: `${mapPinForm.type}-${Date.now()}`,
      type: mapPinForm.type,
      icon: getPinIcon(mapPinForm.type),
      name: mapPinForm.name.trim(),
      lat,
      lng,
      ...fallbackPosition,
    };

    let newPin;
    if (mapPinForm.type === "spot") {
      newPin = {
        ...basePin,
        likes: 0,
        galleryLikes: 0,
        tags: parseTags(mapPinForm.tags),
        description: mapPinForm.description.trim(),
        gallery: [],
      };
    } else if (mapPinForm.type === "meet") {
      newPin = {
        ...basePin,
        time: mapPinForm.time,
        route: mapPinForm.route.trim(),
        routePath: mapPinForm.routePoints.length > 1 ? mapPinForm.routePoints : buildMeetRoutePath(lat, lng),
        visibility: mapPinForm.visibility,
        createdByPlate: user.plate,
        createdByName: user.fullName,
        createdByClan: user.clan ?? "",
        attendees: [createAttendeeRecord(user)],
      };
    } else {
      const initialReview = {
        id: `wash-review-${Date.now()}`,
        author: user.plate,
        foam: Number(mapPinForm.foam),
        water: Number(mapPinForm.water),
        allowsBuckets: mapPinForm.allowsBuckets,
        shadowDrying: mapPinForm.shadowDrying,
        note: mapPinForm.note.trim(),
      };

      newPin = {
        ...basePin,
        rating: {
          foam: initialReview.foam,
          water: initialReview.water,
          reviews: 1,
          allowsBuckets: initialReview.allowsBuckets ? 1 : 0,
          shadowDrying: initialReview.shadowDrying ? 1 : 0,
        },
        reviews: [initialReview],
      };
    }

    setMapPins((current) => appendMapPin(current, newPin));
    setSelectedPinId(newPin.id);
    setMapPinForm({
      ...createMapPinForm(newPin),
      type: mapPinForm.type,
      lat: newPin.lat,
      lng: newPin.lng,
      routePoints: [],
    });
    setMapDraftLocation({
      lat: newPin.lat,
      lng: newPin.lng,
      source: "created",
    });
    setMapPickMode("node");
    setMapPinErrors({});
    setMapPinFeedback(`${newPin.name} added to the live map.`);
    void saveFirebaseMapPin(newPin);
  };

  const submitSpotPhoto = (event) => {
    event.preventDefault();
    if (!user || !selectedPin || selectedPin.type !== "spot") {
      return;
    }

    const validationErrors = validateSpotPhotoForm(spotPhotoForm);
    setSpotPhotoErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const photo = {
      id: `gallery-${Date.now()}`,
      title: spotPhotoForm.title.trim(),
      likes: 0,
      author: user.plate,
      imageUrl: spotPhotoForm.imageUrl,
      uploadedAt: Date.now(),
    };

    let nextPin = null;
    setMapPins((current) => {
      const nextPins = appendSpotPhoto(current, selectedPin.id, photo);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });
    setSpotPhotoForm(createSpotPhotoForm());
    setSpotPhotoErrors({});
    setSpotPhotoFeedback("Photo dropped into the spot gallery.");
    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const loadSpotPhotoFile = async (file) => {
    if (!file) {
      setSpotPhotoForm((current) => ({
        ...current,
        imageUrl: "",
        fileName: "",
      }));
      return;
    }

    try {
      const imageUrl = await readFileAsDataUrl(file);
      setSpotPhotoForm((current) => ({
        ...current,
        imageUrl,
        fileName: file.name,
        title: current.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      setSpotPhotoErrors((current) => ({ ...current, imageUrl: undefined }));
    } catch (error) {
      setSpotPhotoErrors((current) => ({
        ...current,
        imageUrl: error instanceof Error ? error.message : "Photo file could not be read.",
      }));
    }
  };

  const resetMapInteractions = () => {
    setWashFeedback("");
    setMapPinFeedback("");
    setSpotPhotoFeedback("");
  };

  return {
    clearDraftRoute,
    joinCruise,
    likeGalleryImage,
    likePin,
    loadSpotPhotoFile,
    mapDraftLocation,
    mapPickMode,
    mapPinErrors,
    mapPinFeedback,
    mapPinForm,
    mapPins: visibleMapPins,
    pickMapLocation,
    rateAttendee,
    removeLastDraftRoutePoint,
    resetMapInteractions,
    selectedPin,
    selectedPinId,
    setMapPickMode,
    setMapPinForm,
    setMapPins,
    setSelectedPinId,
    setSpotPhotoForm,
    setWashForm,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitMapPin,
    submitSpotPhoto,
    submitWashReview,
    useSelectedPinCoordinates,
    washForm,
    washErrors,
    washFeedback,
  };
}
