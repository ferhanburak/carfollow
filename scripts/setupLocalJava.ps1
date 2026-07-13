$ErrorActionPreference = "Stop"

$rootDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$toolsDirectory = Join-Path $rootDirectory "tools"
$targetDirectory = Join-Path $toolsDirectory "jre-21"
$archivePath = Join-Path $env:TEMP "cruiser-temurin-jre-21.zip"
$downloadUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk"

New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
$existingJava = Get-ChildItem -LiteralPath $targetDirectory -Recurse -Filter java.exe -File -ErrorAction SilentlyContinue |
  Select-Object -First 1

if (-not $existingJava) {
  Write-Host "Downloading the Eclipse Temurin 21 JRE for Firebase emulators..."
  Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing
  Expand-Archive -LiteralPath $archivePath -DestinationPath $targetDirectory -Force
  $existingJava = Get-ChildItem -LiteralPath $targetDirectory -Recurse -Filter java.exe -File |
    Select-Object -First 1
}

if (-not $existingJava) {
  throw "Java installation could not be located under $targetDirectory"
}

$javaHome = Split-Path (Split-Path $existingJava.FullName -Parent) -Parent
Write-Host "Local Java is ready: $javaHome"
& $existingJava.FullName -version
