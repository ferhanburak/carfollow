const ERROR_PATTERNS = [
  /bulunamad/i,
  /gonderilemed/i,
  /kaydedilemed/i,
  /onaylanamad/i,
  /reddedilemed/i,
  /silinemed/i,
  /guncellenemed/i,
  /senkronizasyon/i,
  /yetkiniz/i,
  /yetkisi yok/i,
  /permission/i,
  /kapali/i,
  /kapasite/i,
  /kabul etmiyor/i,
  /gerekli/i,
  /kullanilabilir/i,
  /hata/i,
  /error/i,
];

export function getActionError(message) {
  if (!message) return "";
  return ERROR_PATTERNS.some((pattern) => pattern.test(message)) ? message : "";
}
