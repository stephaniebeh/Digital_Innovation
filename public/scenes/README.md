# Scene files for the demo

## Why the old view looked like a blur

`meshed-poisson.ply` is a **solid mesh** from COLMAP. We were drawing **two semi-transparent meshes on top of each other**, which looks like a muddy blob.

The app now uses **`fused.ply`** (dense **point cloud**) by default — sharper for COLMAP data.

For **Aholo-like** clarity you need **3D Gaussian splats**, not COLMAP mesh/PLY.

---

## What you already have

| Desk | File | What it is |
|------|------|------------|
| **desk1** | `desk1/untitled.psht` (~374 MB) | **PostShot 3DGS project** — export this for splat quality |
| **desk1** | `desk1/dense/0/fused.ply` | COLMAP point cloud → copied to `public/scenes/desk1/scene.ply` |
| **desk1** | `desk1/dense/0/meshed-poisson.ply` | COLMAP mesh (not used in viewer anymore) |
| **desk1** | `desk1/dense/0/images/*.jpg` | Source photos (hotspots) |
| **desk2** | `desk2/dense/0/fused.ply` | Point cloud → `public/scenes/desk2/scene.ply` |
| **desk2** | (no `.psht`) | Train/export splats in PostShot if you want matching quality |

---

## Aholo-like quality (3D Gaussian splats)

### 1. Export from PostShot (desk1)

You already trained **desk1** as `untitled.psht`. In PostShot:

- **GUI:** File → **Export Splat Model** → save as PLY  
- **CLI:**
  ```powershell
  & "$env:ProgramFiles\Jawset Postshot\bin\postshot-cli.exe" export `
    --input "C:\Users\steph\afterimage-prototype\desk1\untitled.psht" `
    --output "C:\Users\steph\afterimage-prototype\public\scenes\desk1\scene-splat.ply" `
    --format ply
  ```

Copy the export to:

`public/scenes/desk1/scene-splat.ply`

### 2. desk2

Run PostShot on `desk2/dense/0/images` (or your image folder), export the same way to:

`public/scenes/desk2/scene-splat.ply`

### 3. Reload the site

If **both** `scene-splat.ply` files exist, the viewer switches to **“3D Gaussian splat”** mode automatically.

---

## COLMAP refresh (point cloud mode)

```powershell
Copy-Item desk1\dense\0\fused.ply public\scenes\desk1\scene.ply -Force
Copy-Item desk2\dense\0\fused.ply public\scenes\desk2\scene.ply -Force
```

---

## Summary

| Goal | File to add |
|------|-------------|
| Clear enough for prototype (now) | `scene.ply` from `fused.ply` ✓ |
| Aholo / splat look | `scene-splat.ply` from PostShot `.psht` export |

COLMAP alone cannot match Aholo splats without a **3DGS training step** (PostShot, Aholo API, Nerfstudio, etc.).
