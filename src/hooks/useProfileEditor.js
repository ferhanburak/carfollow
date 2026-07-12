import { useEffect, useMemo, useState } from "react";

function buildProfileForm(user) {
  return {
    fullName: user?.fullName ?? "",
    model: user?.model ?? "",
    tuningStage: user?.tuningStage ?? "Stock",
    horsepower: String(user?.horsepower ?? ""),
    garage: user?.garage ?? "",
    region: user?.region ?? "",
    avatar: user?.avatar ?? "",
  };
}

function validateProfileForm(form) {
  const errors = {};

  if (!form.fullName.trim()) {
    errors.fullName = "Isim gerekli.";
  }
  if (!form.model.trim()) {
    errors.model = "Arac modeli gerekli.";
  }
  if (!String(form.horsepower).trim() || Number(form.horsepower) <= 0) {
    errors.horsepower = "HP 0'dan buyuk olmali.";
  }
  if (!form.garage.trim()) {
    errors.garage = "Garaj / servis bilgisi gerekli.";
  }
  if (!form.region.trim()) {
    errors.region = "Bolge gerekli.";
  }

  return errors;
}

export function useProfileEditor({ user, setUser }) {
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(user));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileFeedback, setProfileFeedback] = useState("");

  useEffect(() => {
    setProfileForm(buildProfileForm(user));
  }, [user?.avatar, user?.fullName, user?.garage, user?.horsepower, user?.model, user?.region, user?.tuningStage]);

  const profileCompletion = useMemo(() => {
    const values = [
      profileForm.fullName,
      profileForm.model,
      profileForm.tuningStage,
      profileForm.horsepower,
      profileForm.garage,
      profileForm.region,
      profileForm.avatar,
    ];
    const completed = values.filter((value) => String(value ?? "").trim()).length;
    return Math.round((completed / values.length) * 100);
  }, [profileForm]);

  const submitProfile = (event) => {
    event.preventDefault();
    const errors = validateProfileForm(profileForm);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setUser((current) => ({
      ...current,
      fullName: profileForm.fullName.trim(),
      model: profileForm.model.trim(),
      tuningStage: profileForm.tuningStage,
      horsepower: Number(profileForm.horsepower),
      garage: profileForm.garage.trim(),
      region: profileForm.region.trim(),
      avatar: profileForm.avatar.trim() || current.avatar,
    }));
    setProfileErrors({});
    setProfileFeedback("Profil ve arac bilgileri guncellendi.");
  };

  return {
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    setProfileForm,
    submitProfile,
  };
}
