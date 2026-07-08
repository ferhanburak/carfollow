export function validateSignUpForm(form) {
  const errors = {};
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
