# Light zh-Hans client build for Windows.
# Matches server layout:
#   client/dist/browser/en-US/index.html
#   client/dist/browser/assets/**
#   client/dist/locale/**
#
# Usage (from repo root):
#   pwsh -File scripts/build/client-light.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

function Remove-PathIfExists ([string]$Path) {
  if (Test-Path $Path) {
    Remove-Item -Recurse -Force $Path
  }
}

Write-Host 'Building @peertube/player...'
$playerDir = Join-Path $repoRoot 'client\src\standalone\player'
Remove-PathIfExists (Join-Path $playerDir 'build')
Push-Location $playerDir
try {
  $vite = Join-Path $repoRoot 'node_modules\.bin\vite.cmd'
  if (-not (Test-Path $vite)) {
    $vite = Join-Path $repoRoot 'client\node_modules\.bin\vite.cmd'
  }
  & $vite build --mode production --config ./vite.config.mjs
  if ($LASTEXITCODE -ne 0) { throw "player vite build failed ($LASTEXITCODE)" }
} finally {
  Pop-Location
}

Write-Host 'Building Angular client (zh-Hans, light compatibility path)...'
Remove-PathIfExists (Join-Path $repoRoot 'client\dist\browser')
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot 'client\dist') | Out-Null

Push-Location (Join-Path $repoRoot 'client')
try {
  $env:NODE_OPTIONS = '--max_old_space_size=8192'
  $ng = '.\node_modules\.bin\ng.cmd'
  if (-not (Test-Path $ng)) { $ng = Join-Path $repoRoot 'node_modules\.bin\ng.cmd' }
  # The light build serves the Chinese bundle from the existing en-US path so
  # server defaults and deployment checks remain compatible with this layout.
  & $ng build --output-path 'dist/browser/en-US' --configuration production,zh-Hans-light --source-map=false
  if ($LASTEXITCODE -ne 0) { throw "ng build failed ($LASTEXITCODE)" }
} finally {
  Pop-Location
}

$browserRoot = Join-Path $repoRoot 'client\dist\browser'
$localeDir = Join-Path $browserRoot 'en-US'
$localized = Join-Path $localeDir 'zh-Hans-CN'
$nested = Join-Path $localeDir 'browser'

if (Test-Path $nested) {
  Get-ChildItem $nested | ForEach-Object {
    $dest = Join-Path $localeDir $_.Name
    Remove-PathIfExists $dest
    Move-Item $_.FullName $dest
  }
  Remove-PathIfExists $nested
}

if (Test-Path $localized) {
  Get-ChildItem $localized | ForEach-Object {
    $dest = Join-Path $localeDir $_.Name
    Remove-PathIfExists $dest
    Move-Item $_.FullName $dest
  }
  Remove-PathIfExists $localized
}

$localeAssets = Join-Path $localeDir 'assets'
$rootAssets = Join-Path $browserRoot 'assets'
if (Test-Path $localeAssets) {
  Remove-PathIfExists $rootAssets
  Move-Item $localeAssets $rootAssets
}

$srcLocale = Join-Path $repoRoot 'client\src\locale'
$distLocale = Join-Path $repoRoot 'client\dist\locale'
if (Test-Path $srcLocale) {
  Remove-PathIfExists $distLocale
  Copy-Item -Recurse $srcLocale $distLocale
}

$index = Join-Path $localeDir 'index.html'
$banner = Join-Path $rootAssets 'images\gamehub-header-banner-10x1.png'
if (-not (Test-Path $index)) { throw "Missing $index" }
if (-not (Test-Path $banner)) {
  Write-Warning "Banner asset not found at $banner (optional if not shipped)"
}

Write-Host "Light zh-Hans client build OK:"
Write-Host "  $index"
Write-Host "  $rootAssets"
