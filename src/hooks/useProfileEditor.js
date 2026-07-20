import { useEffect, useMemo, useState } from "react";
import {
  isFirebaseProfileRepositoryEnabled,
  updateFirebaseVehicleProfile,
  uploadFirebaseProfileAvatar,
} from "../repositories/cruiserRepository";
import { readImageFileAsDataUrl, validateProfileImageFile } from "../utils/profileImages";

function buildProfileForm(user) {
  return {
    fullName: user?.fullName ?? "",
    model: user?.model ?? "",
    tuningStage: user?.tuningStage ?? "Stock",
    horsepower: String(user?.horsepower ?? ""),
    garage: user?.garage ?? "",
    region: user?.region ?? "",
    avatar: user?.avatar ?? "",
    avatarFile: null,
    avatarFileName: "",
    avatarPreview: user?.avatar ?? "",
    odometer: String(user?.odometer ?? ""),
  };
}

function validateProfileForm(form, user) {
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
  const odometer = Number(form.odometer);
  if (!String(form.odometer).trim() || !Number.isFinite(odometer) || odometer < 0 || odometer > 5000000) {
    errors.odometer = "Mevcut KM 0 ile 5.000.000 arasinda olmali.";
  } else if (odometer < Number(user?.odometer ?? 0) && user?.odometerOrigin) {
    errors.odometer = "Kayitli kilometre geriye alinamaz.";
  }

  return errors;
}

export function useProfileEditor({ user, setUser }) {
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(user));
  const [profileErrors, setProfileErrors] = useState({});
  const [profileFeedback, setProfileFeedback] = useState("");
  const [profilePending, setProfilePending] = useState(false);

  useEffect(() => {
    setProfileForm(buildProfileForm(user));
  }, [user?.avatar, user?.fullName, user?.garage, user?.horsepower, user?.model, user?.odometer, user?.region, user?.tuningStage]);

  const profileCompletion = useMemo(() => {
    const values = [
      profileForm.fullName,
      profileForm.model,
      profileForm.tuningStage,
      profileForm.horsepower,
      profileForm.garage,
      profileForm.region,
      profileForm.avatarPreview || profileForm.avatar,
      profileForm.odometer,
    ];
    const completed = values.filter((value) => String(value ?? "").trim()).length;
    return Math.round((completed / values.length) * 100);
  }, [profileForm]);

  const loadProfileAvatarFile = async (file) => {
    const avatarError = validateProfileImageFile(file);
    if (avatarError) {
      setProfileErrors((current) => ({ ...current, avatar: avatarError }));
      return false;
    }
    if (!file) {
      setProfileForm((current) => ({ ...current, avatarFile: null, avatarFileName: "", avatarPreview: current.avatar }));
      setProfileErrors((current) => ({ ...current, avatar: undefined }));
      return true;
    }
    try {
      const avatarPreview = await readImageFileAsDataUrl(file);
      setProfileForm((current) => ({ ...current, avatarFile: file, avatarFileName: file.name, avatarPreview }));
      setProfileErrors((current) => ({ ...current, avatar: undefined }));
      return true;
    } catch (error) {
      setProfileErrors((current) => ({ ...current, avatar: error instanceof Error ? error.message : "Fotograf okunamadi." }));
      return false;
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    const errors = validateProfileForm(profileForm, user);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    setProfilePending(true);
    setProfileFeedback("");
    try {
      let avatar = profileForm.avatar;
      if (profileForm.avatarFile && isFirebaseProfileRepositoryEnabled()) {
        avatar = (await uploadFirebaseProfileAvatar(profileForm.avatarFile)).avatarUrl;
      } else if (profileForm.avatarFile) {
        avatar = profileForm.avatarPreview;
      }
      const nextProfile = {
        fullName: profileForm.fullName.trim(),
        model: profileForm.model.trim(),
        tuningStage: profileForm.tuningStage,
        horsepower: Number(profileForm.horsepower),
        garage: profileForm.garage.trim(),
        region: profileForm.region.trim(),
        avatar,
        odometer: Number(profileForm.odometer),
      };
      let backendResult = null;
      if (isFirebaseProfileRepositoryEnabled()) {
        backendResult = await updateFirebaseVehicleProfile(nextProfile);
      }
      setUser((current) => ({
        ...current,
        ...nextProfile,
        odometerOrigin: backendResult?.correctionApplied ? "legacy-corrected" : (current.odometerOrigin ?? "user-entered"),
      }));
      setProfileForm((current) => ({ ...current, ...nextProfile, avatarFile: null, avatarFileName: "", avatarPreview: avatar }));
      setProfileErrors({});
      setProfileFeedback(backendResult?.correctionApplied
        ? "Eski 12.000 KM varsayimi duzeltildi; profil ve parca baslangiclari guncellendi."
        : "Profil, fotograf ve kilometre bilgileri guncellendi.");
      return true;
    } catch (error) {
      const message = error?.code === "functions/failed-precondition"
        ? "Kilometre daha once dogrulandigi icin geriye alinamadi. Daha yuksek veya esit bir KM gir."
        : error instanceof Error ? error.message : "Profil guncellenemedi.";
      setProfileFeedback(message);
      return false;
    } finally {
      setProfilePending(false);
    }
  };

  return {
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    profilePending,
    loadProfileAvatarFile,
    setProfileForm,
    submitProfile,
  };
}
