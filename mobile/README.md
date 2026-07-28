# CRUISER Mobile

CRUISER'ın Android ve iOS uygulaması Expo SDK 57, Expo Router ve Firebase JS SDK ile geliştirilir. Web uygulaması kök dizinde bağımsız çalışmaya devam eder.

## Gereksinimler

- Node.js `22.12+` veya güncel LTS
- Android için Android Studio ya da fiziksel cihaz
- iOS yerel derlemesi için macOS veya EAS Build

## Kurulum

```powershell
cd D:\carfollow\mobile
npm install
Copy-Item .env.example .env
```

`.env` içindeki Firebase değerlerini gerçek proje yapılandırmasıyla doldurun. Depoda kullanılan hedefler:

- Firestore: `carfollow-eu`
- Realtime Database: `europe-west1`
- Functions: `europe-west1`
- Storage: `carfollow-75750-media-eu`

## Başlatma

```powershell
cd D:\carfollow\mobile
npx expo start
```

Android için terminalde `a`, web ön izlemesi için `w` tuşuna basılabilir. Arka plan konumu, native harita ve bildirim özellikleri eklendiğinde Expo Go yerine development build kullanılacaktır.

## Kontroller

```powershell
npm run lint
npx tsc --noEmit
npx expo-doctor
```

## Yapı

```text
src/
  app/
    (auth)/
    (tabs)/
  components/
  hooks/
  lib/
  providers/
  theme/
```
