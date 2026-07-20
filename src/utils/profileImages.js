export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateProfileImageFile(file) {
  if (!file) return "";
  if (!String(file.type ?? "").startsWith("image/")) return "Profil fotografi bir gorsel dosyasi olmali.";
  if (Number(file.size ?? 0) >= MAX_PROFILE_IMAGE_BYTES) return "Profil fotografi 5 MB'dan kucuk olmali.";
  return "";
}

export function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Fotograf okunamadi."));
    reader.readAsDataURL(file);
  });
}
