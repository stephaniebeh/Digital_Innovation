# Export desk1 PostShot project to 3D Gaussian splat PLY for the web viewer.
# Requires PostShot: https://www.jawset.com/postshot

$cli = "${env:ProgramFiles}\Jawset Postshot\bin\postshot-cli.exe"
$root = Split-Path $PSScriptRoot -Parent
$input = Join-Path $root "desk1\untitled.psht"
$output = Join-Path $root "public\scenes\desk1\scene-splat.ply"

if (-not (Test-Path $cli)) {
  Write-Error "PostShot CLI not found at: $cli"
  exit 1
}

if (-not (Test-Path $input)) {
  Write-Error "Missing PostShot project: $input"
  exit 1
}

& $cli export --input $input --output $output --format ply
Write-Host "Exported splat PLY to $output"
Write-Host "Restart npm run dev and reload the site."
