import { startTransition, useEffect, useRef, useState } from "react";
import {
  appendFuelLog,
  appendWashReview,
  buildDriveTickState,
  getInitialWorldState,
  incrementClanKm,
  incrementGalleryLike,
  incrementPinLike,
  incrementUserOdometer,
  joinCruiseAttendee,
  syncActiveDriver,
  tickAmbientDrivers,
} from "../repositories/cruiserRepository";
import { createFuelForm, createWashForm, computeFuelInsights } from "../utils/garage";
import { validateFuelForm, validateWashForm } from "../utils/validation";

export function useCruiserWorld(user, setUser, setFuelForm) {
  const initialWorld = getInitialWorldState();
  const [activeTab, setActiveTab] = useState("map");
  const [isDriving, setIsDriving] = useState(false);
  const [driveHud, setDriveHud] = useState({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
  const [mapPins, setMapPins] = useState(initialWorld.mapPins);
  const [selectedPinId, setSelectedPinId] = useState(initialWorld.mapPins[0].id);
  const [washForm, setWashForm] = useState(createWashForm);
  const [washErrors, setWashErrors] = useState({});
  const [washFeedback, setWashFeedback] = useState("");
  const [fuelErrors, setFuelErrors] = useState({});
  const [clans, setClans] = useState(initialWorld.clans);
  const [drivers, setDrivers] = useState(initialWorld.drivers);
  const tickerRef = useRef(0);

  useEffect(() => {
    const shuffleTimer = window.setInterval(() => {
      startTransition(() => {
        setDrivers((current) => tickAmbientDrivers(current, tickerRef.current));
        tickerRef.current += 1;
      });
    }, 2200);

    return () => window.clearInterval(shuffleTimer);
  }, []);

  useEffect(() => {
    if (!isDriving || !user) {
      return undefined;
    }

    const driveTimer = window.setInterval(() => {
      startTransition(() => {
        setDriveHud((current) => buildDriveTickState(current));

        setUser((current) => {
          if (!current) {
            return current;
          }

          return incrementUserOdometer(current);
        });

        setClans((current) => incrementClanKm(current, user.clan));
        setDrivers((current) => syncActiveDriver(current, user));
      });
    }, 1000);

    return () => window.clearInterval(driveTimer);
  }, [isDriving, setUser, user]);

  const selectedPin = mapPins.find((pin) => pin.id === selectedPinId) ?? mapPins[0];
  const fuelInsights = user ? computeFuelInsights(user.fuelLogs) : { average: 0, costPerFill: 0, totalSpend: 0 };

  const likePin = () => {
    setMapPins((current) => incrementPinLike(current, selectedPin.id));
  };

  const likeGalleryImage = (galleryId) => {
    setMapPins((current) => incrementGalleryLike(current, selectedPin.id, galleryId));
  };

  const submitWashReview = (event) => {
    event.preventDefault();
    if (!user || selectedPin.type !== "wash") {
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

    setMapPins((current) => appendWashReview(current, selectedPin.id, review));
    setWashForm(createWashForm());
    setWashErrors({});
    setWashFeedback("Review added successfully.");
  };

  const joinCruise = () => {
    if (!user || selectedPin.type !== "meet") {
      return;
    }

    setMapPins((current) => joinCruiseAttendee(current, selectedPin.id, user.plate));
  };

  const submitFuelLog = (event, fuelForm) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    const validationErrors = validateFuelForm(fuelForm, user.odometer);
    setFuelErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const nextLog = {
      id: `fuel-${Date.now()}`,
      liters: Number(fuelForm.liters),
      price: Number(fuelForm.price),
      currentKm: Number(fuelForm.currentKm),
      station: fuelForm.station,
    };

    setUser((current) => appendFuelLog(current, nextLog));
    setFuelForm(createFuelForm(Number(fuelForm.currentKm)));
    setFuelErrors({});
  };

  const toggleDrive = () => {
    setIsDriving((current) => !current);
    setActiveTab("drive");
  };

  const resetSessionView = () => {
    setActiveTab("map");
    setDriveHud({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
    setWashFeedback("");
  };

  return {
    activeTab,
    clans,
    driveHud,
    drivers,
    fuelInsights,
    fuelErrors,
    isDriving,
    joinCruise,
    likeGalleryImage,
    likePin,
    mapPins,
    resetSessionView,
    selectedPin,
    selectedPinId,
    setActiveTab,
    setSelectedPinId,
    setWashForm,
    submitFuelLog,
    submitWashReview,
    toggleDrive,
    washForm,
    washErrors,
    washFeedback,
  };
}
