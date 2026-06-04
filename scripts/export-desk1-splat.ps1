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

& $cli export $input --export-splat $output
if (-not (Test-Path $output)) {
  Write-Error "Export did not create $output"
  exit 1
}
$mb = [math]::Round((Get-Item $output).Length / 1MB, 1)
Write-Host ('Exported splat PLY ({0} MB) to {1}' -f $mb, $output)
Write-Host "Restart npm run dev and reload the site."
