# Bake scene-splat.ply via local Next.js + Aholo API (desk1 or desk2).
# Prereqs: npm run dev, AHOLO_API_KEY in .env.local, 20+ images in desk?\dense\0\images
param(
  [ValidateSet("desk1", "desk2")]
  [string]$Desk = "desk1",
  [string]$BaseUrl = "http://localhost:3000",
  [int]$ImageCount = 24
)

$root = Split-Path $PSScriptRoot -Parent
$imageDir = Join-Path $root "$Desk\dense\0\images"
$out = Join-Path $root "public\scenes\$Desk\scene-splat.ply"

if (-not (Test-Path $imageDir)) {
  Write-Error "Missing images: $imageDir"
  exit 1
}

$images = Get-ChildItem $imageDir -File -Include *.jpg,*.jpeg,*.png |
  Sort-Object Name |
  Select-Object -First $ImageCount

if ($images.Count -lt 20) {
  Write-Error "Need at least 20 images; found $($images.Count) in $imageDir"
  exit 1
}

Write-Host "Uploading $($images.Count) images from $Desk to Aholo via $BaseUrl ..."

$files = @($images | ForEach-Object { Get-Item $_.FullName })

try {
  $recon = Invoke-RestMethod -Uri "$BaseUrl/api/reconstruct" -Method Post -Form @{
    scene = "space"
    taskQuality = "normal"
    name = "afterimage-$Desk"
    files = $files
  }
} catch {
  Write-Error "Reconstruct failed. Is npm run dev running with AHOLO_API_KEY? $_"
  exit 1
}

$worldId = $recon.worldId
Write-Host "worldId: $worldId - polling (up to 45 min)..."

$deadline = (Get-Date).AddMinutes(45)
$modelUrl = $null
$format = "ply"

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 5
  $status = Invoke-RestMethod -Uri "$BaseUrl/api/world/$worldId"
  Write-Host "  status: $($status.status)"
  if ($status.status -eq "SUCCEEDED" -and ($status.modelUrl -or $status.plyPath -or $status.spzPath)) {
    if ($status.plyPath) {
      $modelUrl = $status.plyPath
      $format = "ply"
    } elseif ($status.spzPath) {
      $modelUrl = $status.spzPath
      $format = "spz"
    } else {
      $modelUrl = $status.modelUrl
    }
    break
  }
  if ($status.status -eq "FAILED") {
    Write-Error "Reconstruction failed"
    exit 1
  }
}

if (-not $modelUrl) {
  Write-Error "Timed out waiting for model"
  exit 1
}

$proxy = "$BaseUrl/api/model?url=$([uri]::EscapeDataString($modelUrl))&ext=$format"
Write-Host "Downloading to $out ..."
Invoke-WebRequest -Uri $proxy -OutFile $out
Write-Host ('Saved {0} ({1} MB)' -f $out, [math]::Round((Get-Item $out).Length / 1MB, 1))
