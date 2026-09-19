param([int]$Port = 3001)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) {
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
$env:PORT = [string]$Port
Write-Host "GimmeABreak: http://127.0.0.1:$Port"
& node scripts/serve.mjs
