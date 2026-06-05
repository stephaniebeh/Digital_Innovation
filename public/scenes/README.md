# Scene files for the desk demo

The desk demo shows **3D Gaussian splats** (`scene-splat.spz` or `scene-splat.ply`) built from your desk photo sets via **Aholo** — no PostShot required.

| Desk | Source photos | Output |
|------|---------------|--------|
| **desk1** | `desk1/desk1 images/` (preferred) or `desk1/dense/0/images/` | `public/scenes/desk1/scene-splat.{spz\|ply}` |
| **desk3** | `desk3/desk3 images/` (preferred) or `desk3/dense/0/images/` | `public/scenes/desk3/scene-splat.{spz\|ply}` |
| **desk2** | `desk2/desk2 images/` (preferred) or `desk2/dense/0/images/` | `public/scenes/desk2/scene-splat.{spz\|ply}` |

Timeline order: **2020 desk1** → **2023 desk3** → **2026 desk2**.

### Why Aholo’s website can look sharper than this demo

- **Training set:** An older bake used only **24** images and `taskQuality: normal`. Using **all** photos in `desk1 images` / `desk2 images` (like Aholo’s web UI) is the biggest quality win.
- **Re-bake:** `npm run bake-splats` uploads **every photo** in `desk1/desk1 images` and `desk2/desk2 images` with **`taskQuality: high`**, and prefers **SPZ** when Aholo provides it.
- **Viewer:** The demo uses `@mkkellogg/gaussian-splats-3d` with antialiasing and alpha cleanup (`splatAlphaRemovalThreshold` 28). Floaters (“blob” splats) are often weak Gaussians in the file itself; re-baking with more images helps more than viewer tweaks alone.

`scene.ply` (COLMAP point cloud) is optional — used only for **auto-align** in the align panel.

---

## Generate splats (recommended)

1. Add `AHOLO_API_KEY` to `.env.local` (from [Aholo Labs](https://labs.aholo3d.cn/api-keys)).
2. From the repo root:

```powershell
npm install
npm run bake-splats
```

This uploads **all** images per desk (high quality), runs Aholo reconstruction (can take a long time with 200+ photos), and saves **SPZ or PLY**. One desk only:

```powershell
npm run bake-splat:desk1
npm run bake-splat:desk3
npm run bake-splat:desk2
```

Quick test with fewer photos: `npx tsx scripts/bake-desk-splats.ts desk1 --images 40`

### Match a reconstruction you already made in the app

If **Reconstruct with Aholo** looked good, copy the `worldId` from the viewer and save that exact model into the desk demo (no re-upload):

```powershell
npx tsx scripts/save-desk-splat-from-world.ts desk1 YOUR_WORLD_ID
```

Hard-refresh the browser after saving.

---

## Optional: COLMAP align files

```powershell
Copy-Item desk1\dense\0\fused.ply public\scenes\desk1\scene.ply -Force
Copy-Item desk2\dense\0\fused.ply public\scenes\desk2\scene.ply -Force
```
