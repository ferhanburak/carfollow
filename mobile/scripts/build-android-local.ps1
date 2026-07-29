[CmdletBinding()]
param(
  [ValidateSet("apk", "aab")]
  [string]$Format = "apk"
)

$ErrorActionPreference = "Stop"

$androidRoot = "D:\Android"
$sdkRoot = Join-Path $androidRoot "Sdk"
$javaHome = Join-Path $androidRoot "android-studio\jbr"
$localKeystore = Join-Path $androidRoot "keystores\tracksnap-local.keystore"
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = "D:\carfollow\artifacts"

if (-not (Test-Path (Join-Path $sdkRoot "platform-tools\adb.exe"))) {
  throw "Android SDK bulunamadi: $sdkRoot"
}

if (-not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
  throw "Android Studio JDK bulunamadi: $javaHome"
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_USER_HOME = Join-Path $androidRoot ".android"
$env:GRADLE_USER_HOME = Join-Path $androidRoot ".gradle"
$env:JAVA_HOME = $javaHome
$env:TRACKSNAP_LOCAL_ANDROID = "true"
$env:NODE_ENV = "production"

Push-Location $projectRoot
try {
  Write-Host "Native Android projesi D: uzerinde hazirlaniyor..."
  & npx expo prebuild --platform android --clean --no-install
  if ($LASTEXITCODE -ne 0) {
    throw "Expo prebuild basarisiz oldu."
  }

  $localProperties = Join-Path $projectRoot "android\local.properties"
  "sdk.dir=D\:\\Android\\Sdk" | Set-Content -LiteralPath $localProperties -Encoding ascii

  if (-not (Test-Path $localKeystore)) {
    throw "Kalici yerel keystore bulunamadi: $localKeystore"
  }
  Copy-Item -LiteralPath $localKeystore `
    -Destination (Join-Path $projectRoot "android\app\debug.keystore") -Force

  $gradleProperties = Join-Path $projectRoot "android\gradle.properties"
  $gradleSettings = Get-Content -LiteralPath $gradleProperties -Raw
  $gradleSettings = $gradleSettings -replace `
    "org\.gradle\.jvmargs=.*", `
    "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m"
  $gradleSettings | Set-Content -LiteralPath $gradleProperties -Encoding ascii

  $gradleTask = if ($Format -eq "aab") {
    "app:bundleRelease"
  } else {
    "app:assembleRelease"
  }

  Write-Host "Yalnizca arm64-v8a icin $Format derleniyor..."
  Push-Location (Join-Path $projectRoot "android")
  try {
    & .\gradlew.bat $gradleTask "-PreactNativeArchitectures=arm64-v8a" `
      -x lintVitalAnalyzeRelease
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle derlemesi basarisiz oldu."
    }
  } finally {
    Pop-Location
  }

  New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
  if ($Format -eq "aab") {
    $source = Join-Path $projectRoot "android\app\build\outputs\bundle\release\app-release.aab"
    $destination = Join-Path $artifactRoot "tracksnap-local-release.aab"
  } else {
    $source = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
    $destination = Join-Path $artifactRoot "tracksnap-local-release.apk"
  }

  Copy-Item -LiteralPath $source -Destination $destination -Force
  Write-Host "Derleme hazir: $destination"
} finally {
  Pop-Location
}
