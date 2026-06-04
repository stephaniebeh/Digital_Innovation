# Export PostShot .psht projects to public/scenes/{desk}/scene-splat.ply
param(
  [ValidateSet("desk1", "desk2", "all")]
  [string]$Desk = "all"
)

$cli = "${env:ProgramFiles}\Jawset Postshot\bin\postshot-cli.exe"
$root = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path $cli)) {
  Write-Error "PostShot CLI not found at: $cli"
  exit 1
}

function Export-DeskSplat([string]$id) {
  $psht = Join-Path $root "$id\untitled.psht"
  $out = Join-Path $root "public\scenes\$id\scene-splat.ply"
  if (-not (Test-Path $psht)) {
    Write-Warning "Skip $id - no $psht (train in PostShot first)"
    return $false
  }
  Write-Host "Exporting $id ..."
  & $cli export $psht --export-splat $out
  if (-not (Test-Path $out)) {
    Write-Error "Export failed for $id"
    return $false
  }
  $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
  Write-Host ('  -> {0} ({1} MB)' -f $out, $mb)
  return $true
}

$targets = if ($Desk -eq "all") { @("desk1", "desk2") } else { @($Desk) }
$ok = 0
foreach ($t in $targets) {
  if (Export-DeskSplat $t) { $ok++ }
}
if ($ok -eq 0) {
  Write-Error "No splats exported. Use PostShot GUI (File > Export Splat Model) or scripts/bake-desk-splat-aholo.ps1"
  exit 1
}
Write-Host "Done. Reload the desk demo in the browser."
