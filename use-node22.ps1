param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Command
)

$nodeRoot = Join-Path $PSScriptRoot "tools\node-v22.23.1-win-x64"

if (-not (Test-Path $nodeRoot)) {
  Write-Error "Portable Node 22 install was not found at $nodeRoot"
  exit 1
}

$env:Path = "$nodeRoot;$env:Path"

if (-not $Command -or $Command.Count -eq 0) {
  Write-Host "Portable Node 22 is active for this session."
  Write-Host "Node version: $(node -v)"
  Write-Host ""
  Write-Host "Examples:"
  Write-Host "  .\use-node22.ps1 npm run dev"
  Write-Host "  .\use-node22.ps1 npm run build"
  Write-Host "  .\use-node22.ps1 npm run test:run"
  exit 0
}

& $Command[0] @($Command | Select-Object -Skip 1)
exit $LASTEXITCODE
