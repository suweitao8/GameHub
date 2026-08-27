[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://127.0.0.1:9000',
  [switch]$SkipBuild,
  [switch]$SkipLint,
  [switch]$SkipLive,
  [switch]$FullLint
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

function Invoke-GateStep ([string]$Name, [scriptblock]$Action) {
  Write-Host "`n[SELF-TEST] $Name" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw ('Self-test step failed: ' + $Name + ' (exit code ' + $LASTEXITCODE + ')')
  }
}

function Assert-Http ([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url
    if ($response.StatusCode -ne 200) {
      throw ('HTTP ' + $response.StatusCode)
    }
    return $response
  } catch {
      throw ('Cannot reach ' + $Url + ': ' + $_.Exception.Message)
  }
}

function Test-UsableBash {
  $bash = Get-Command bash -ErrorAction SilentlyContinue
  return $null -ne $bash -and $bash.Source -notmatch '[\\/]Windows[\\/]System32[\\/]bash\.exe$'
}

function Invoke-ServerBuild {
  if (Test-UsableBash) {
    pnpm run build:server
    return
  }

  Write-Host '[SELF-TEST] bash is unavailable; using the equivalent Windows-native server build.' -ForegroundColor Yellow
  if (Test-Path dist) { Remove-Item -Recurse -Force dist }
  Get-ChildItem packages -Directory | ForEach-Object {
    $packageDist = Join-Path $_.FullName 'dist'
    if (Test-Path $packageDist) { Remove-Item -Recurse -Force $packageDist }
  }
  pnpm exec tsc -b --verbose server/tsconfig.json
  if ($LASTEXITCODE -ne 0) { return }
  pnpm run resolve-tspaths:server
  if ($LASTEXITCODE -ne 0) { return }
  New-Item -ItemType Directory -Force -Path dist/core, dist/scripts, client/dist | Out-Null
  Copy-Item -Recurse server/core/static, server/core/assets dist/core
  Copy-Item server/locales dist
  Copy-Item server/scripts/upgrade.sh dist/scripts
  $clientAssets = Join-Path (Join-Path $repoRoot 'client') 'dist/assets'
  if (Test-Path $clientAssets) { Remove-Item -Recurse -Force $clientAssets }
  Copy-Item -Recurse client/src/assets client/dist
}

function Get-ChangedFiles {
  $files = @()
  $files += @(git diff --name-only develop...HEAD)
  $files += @(git diff --name-only)
  $files += @(git status --porcelain | ForEach-Object {
      if ($_.Length -gt 3) { $_.Substring(3).Trim().Trim('"') }
    })
  # Deleted files cannot be linted; drop them so large deletion batches
  # neither break the linters nor overflow the Windows command line.
  return @($files | Where-Object { $_ -and (Test-Path (Join-Path $repoRoot $_)) } | Sort-Object -Unique)
}

function Invoke-RepositoryLint {
  if ($FullLint) {
    if (Test-UsableBash) {
      pnpm run lint
      return
    }
    Write-Host '[SELF-TEST] bash is unavailable; using the equivalent Windows-native full lint steps.' -ForegroundColor Yellow
  } else {
    Write-Host '[SELF-TEST] running full server/schema lint and changed-file client lint.' -ForegroundColor Yellow
  }

  pnpm run oxlint -- --import-plugin --promise-plugin --node-plugin
  if ($LASTEXITCODE -ne 0) { return }
  pnpm run swagger-cli -- validate support/doc/api/openapi.yaml
  if ($LASTEXITCODE -ne 0) { return }
  pnpm run validate-config-schema
  if ($LASTEXITCODE -ne 0) { return }

  if ($FullLint) {
    Push-Location client
    try { pnpm run lint } finally { Pop-Location }
    return
  }

  $changedClientFiles = @(Get-ChangedFiles | Where-Object { $_ -like 'client/src/*' })
  $changedClientTs = @($changedClientFiles | Where-Object { $_ -match '\.(ts|html)$' } | ForEach-Object { $_.Substring(7) })
  $changedClientScss = @($changedClientFiles | Where-Object { $_ -match '\.scss$' } | ForEach-Object { $_.Substring(7) })
  if ($changedClientTs.Count -eq 0 -and $changedClientScss.Count -eq 0) {
    Write-Host '[SELF-TEST] no changed client files; client lint skipped.'
    return
  }

  Push-Location client
  try {
    # Batched invocations keep each command line well under the
    # Windows CreateProcess length limit for big change sets.
    $batchSize = 150
    if ($changedClientTs.Count -gt 0) {
      for ($i = 0; $i -lt $changedClientTs.Count; $i += $batchSize) {
        $batch = @($changedClientTs[$i..([Math]::Min($i + $batchSize - 1, $changedClientTs.Count - 1))])
        $eslintArgs = @('--') + $batch
        pnpm exec eslint @eslintArgs
        if ($LASTEXITCODE -ne 0) { return }
      }
    }
    if ($changedClientScss.Count -gt 0) {
      for ($i = 0; $i -lt $changedClientScss.Count; $i += $batchSize) {
        $batch = @($changedClientScss[$i..([Math]::Min($i + $batchSize - 1, $changedClientScss.Count - 1))])
        $stylelintArgs = @('--') + $batch
        pnpm exec stylelint @stylelintArgs
        if ($LASTEXITCODE -ne 0) { return }
      }
    }
  } finally { Pop-Location }
}

if (-not $SkipBuild) {
  Invoke-GateStep 'build server' { Invoke-ServerBuild }
  Invoke-GateStep 'build en-US client' { pnpm run build:client:light }
}

if (-not $SkipLint) {
  Invoke-GateStep 'run repository lint' { Invoke-RepositoryLint }
}

Invoke-GateStep 'verify GameHub source and build contracts' { pnpm run verify:gamehub-client }
Invoke-GateStep 'verify classic game packages' { pnpm run test:classic-games }

if (-not $SkipLive) {
  Write-Host "`n[SELF-TEST] check running service $BaseUrl" -ForegroundColor Cyan
  $ping = Assert-Http "$BaseUrl/api/v1/ping"
  if ($ping.Content.Trim() -ne 'pong') {
    throw ('Health check returned unexpected content: ' + $ping.Content)
  }

  $previousVerifyBase = $env:GAMEHUB_VERIFY_BASE
  try {
    $env:GAMEHUB_VERIFY_BASE = $BaseUrl
    Invoke-GateStep 'smoke test SPA and lazy-loaded bundles' { pnpm run verify:gamehub-client }
  } finally {
    if ($null -eq $previousVerifyBase) { Remove-Item Env:GAMEHUB_VERIFY_BASE -ErrorAction SilentlyContinue }
    else { $env:GAMEHUB_VERIFY_BASE = $previousVerifyBase }
  }
}

Write-Host "`nSELF-TEST PASS: build, static assets, and runtime entry checks passed." -ForegroundColor Green
