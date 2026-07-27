const ERROR_PATTERNS = [
  /bulunamad/i,
  /g[oö]nderilemed/i,
  /kaydedilemed/i,
  /onaylanamad/i,
  /reddedilemed/i,
  /silinemed/i,
  /g[uü]ncellenemed/i,
  /senkronizasyon/i,
  /yetkiniz/i,
  /yetkisi yok/i,
  /permission/i,
  /kapalı/i,
  /kapasite/i,
  /kabul etmiyor/i,
  /gerekli/i,
  /kullanılabilir/i,
  /hata/i,
  /error/i,
];

export function getActionError(message) {
  if (!message) return "";
  return ERROR_PATTERNS.some((pattern) => pattern.test(message)) ? message : "";
}
