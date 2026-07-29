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

Android için terminalde `a`, web ön izlemesi için `w` tuşuna basılabilir. Native harita, arka plan konumu ve bildirim testleri için Expo Go yerine development build kullanılır.

## EAS Build

İlk bulut derlemesinden önce bir kez Expo hesabıyla oturum açıp projeyi EAS'e bağlayın:

```powershell
cd D:\carfollow\mobile
npm run eas:login
npm run eas:init
```

Android telefona kurulabilir development APK:

```powershell
npm run build:android:dev
```

Test kullanıcılarıyla paylaşılabilir preview APK:

```powershell
npm run build:android:preview
```

Google Play için production AAB ve App Store için production IPA:

```powershell
npm run build:android:production
npm run build:ios:production
```

Production profili sürüm kodunu EAS üzerinde otomatik artırır. Android ve iOS mağaza hesapları, uygulamayı mağazaya gönderme aşamasına kadar gerekli değildir.

## D: Üzerinde Yerel Android Derlemesi

Android Studio, Android SDK, JDK ve Gradle önbelleği `D:\Android` altında
tutulur. Mevcut EAS sürümünü ve telefon verilerini koruyan, yan yana
kurulabilir bağımsız test APK'sı:

```powershell
cd D:\carfollow\mobile
npm run android:local:apk
```

Çıktı:

```text
D:\carfollow\artifacts\tracksnap-local-release.apk
```

Bu yerel APK `com.ferhanburak.cruiser.local` paket kimliğini kullanır ve
yalnızca test içindir. Google Maps'in bu sürümde çalışması için Android API
anahtarına bu paket kimliği ile yerel debug keystore SHA-1 değeri de
eklenmelidir.

Yerel test imzası `D:\Android\keystores\tracksnap-local.keystore` konumunda
kalıcı tutulur. Bu dosya silinirse telefondaki yerel test uygulamasını veri
kaybetmeden güncellemek mümkün olmaz; güvenli bir yedeği alınmalıdır.

Yerel AAB üretmek için:

```powershell
npm run android:local:aab
```

Play Store'a gönderilecek üretim AAB'si yerel debug anahtarıyla
imzalanmamalıdır. Üretimde mevcut EAS keystore kullanılmaya devam edilmelidir.

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
