export function validateSignUpForm(form, options = {}) {
  const errors = {};
  if (options.requireEmail) {
    const email = form.email?.trim() ?? "";
    if (!email) {
      errors.email = "E-mail is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid e-mail address.";
    }
  }
  if (!form.fullName.trim()) errors.fullName = "Full name is required.";
  if (!form.plate.trim()) errors.plate = "Plate is required.";
  if (!form.password.trim() || form.password.trim().length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }
  if (!form.model.trim()) errors.model = "Car/Bike model is required.";
  if (!String(form.horsepower).trim() || Number(form.horsepower) <= 0) {
    errors.horsepower = "Horsepower must be greater than 0.";
  }
  if (!form.garage.trim()) errors.garage = "Primary garage is required.";
  return errors;
}

export function validateFuelForm(form, odometer) {
  const errors = {};
  if (!String(form.liters).trim() || Number(form.liters) <= 0) {
    errors.liters = "Liters must be greater than 0.";
  }
  if (!String(form.price).trim() || Number(form.price) <= 0) {
    errors.price = "Price must be greater than 0.";
  }
  if (!String(form.currentKm).trim() || Number(form.currentKm) < Number(odometer)) {
    errors.currentKm = "Current KM cannot be below odometer.";
  }
  if (!String(form.station).trim()) {
    errors.station = "Station is required.";
  }
  return errors;
}

export function validateWashForm(form) {
  const errors = {};
  const foam = Number(form.foam);
  const water = Number(form.water);
  if (!Number.isFinite(foam) || foam < 1 || foam > 5) {
    errors.foam = "Foam rating must be between 1 and 5.";
  }
  if (!Number.isFinite(water) || water < 1 || water > 5) {
    errors.water = "Water rating must be between 1 and 5.";
  }
  if (!form.note.trim()) {
    errors.note = "Review note is required.";
  }
  return errors;
}

export function validateMapPinForm(form) {
  const errors = {};
  const lat = Number(form.lat);
  const lng = Number(form.lng);

  if (!form.name.trim()) {
    errors.name = "Node name is required.";
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.lat = "Latitude must be between -90 and 90.";
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors.lng = "Longitude must be between -180 and 180.";
  }

  if (form.type === "spot" && !form.description.trim()) {
    errors.description = "Spot description is required.";
  }
  if (form.type === "meet") {
    if (!form.time.trim()) {
      errors.time = "Launch time is required.";
    }
    if (!form.route.trim()) {
      errors.route = "Route summary is required.";
    }
    if (!["public", "friends", "clan"].includes(form.visibility)) {
      errors.visibility = "Visibility must be public, friends, or clan.";
    }
    if (!Number.isFinite(Number(form.capacity)) || Number(form.capacity) < 2) {
      errors.capacity = "Capacity must be at least 2.";
    }
    if (!["open", "request", "trusted"].includes(form.accessPolicy)) {
      errors.accessPolicy = "Access policy must be open, request, or trusted.";
    }
    if (!["public", "trusted"].includes(form.detailVisibility)) {
      errors.detailVisibility = "Detail visibility must be public or trusted.";
    }
    if (!Number.isFinite(Number(form.minDriverScore)) || Number(form.minDriverScore) < 0 || Number(form.minDriverScore) > 100) {
      errors.minDriverScore = "Minimum driver score must be between 0 and 100.";
    }
    if (!Number.isFinite(Number(form.minHarmonyVotes)) || Number(form.minHarmonyVotes) < 0) {
      errors.minHarmonyVotes = "Minimum harmony votes must be 0 or greater.";
    }
    if (!Number.isFinite(Number(form.maxAlertVotes)) || Number(form.maxAlertVotes) < 0) {
      errors.maxAlertVotes = "Maximum alert votes must be 0 or greater.";
    }
    if (Array.isArray(form.routePoints) && form.routePoints.length === 1) {
      errors.routePoints = "Add at least 2 route points or clear the draft route.";
    }
  }
  if (form.type === "wash") {
    const foam = Number(form.foam);
    const water = Number(form.water);
    if (!Number.isFinite(foam) || foam < 1 || foam > 5) {
      errors.foam = "Foam rating must be between 1 and 5.";
    }
    if (!Number.isFinite(water) || water < 1 || water > 5) {
      errors.water = "Water rating must be between 1 and 5.";
    }
    if (!form.note.trim()) {
      errors.note = "Launch review note is required.";
    }
  }

  return errors;
}

export function validateSpotPhotoForm(form) {
  const errors = {};

  if (!form.title.trim()) {
    errors.title = "Photo title is required.";
  }
  if (!form.imageUrl.trim()) {
    errors.imageUrl = "Select a photo file before uploading.";
  }

  return errors;
}

export function validateServiceLogForm(form, odometer) {
  const errors = {};
  const serviceKm = Number(form.serviceKm);
  const cost = Number(form.cost);

  if (!form.partKey?.trim()) {
    errors.partKey = "Part selection is required.";
  }
  if (!form.serviceDate?.trim()) {
    errors.serviceDate = "Service date is required.";
  }
  if (!Number.isFinite(serviceKm) || serviceKm < 0) {
    errors.serviceKm = "Service KM must be 0 or greater.";
  }
  if (!form.serviceShop?.trim()) {
    errors.serviceShop = "Service shop is required.";
  }
  if (!Number.isFinite(cost) || cost < 0) {
    errors.cost = "Cost must be 0 or greater.";
  }

  return errors;
}
