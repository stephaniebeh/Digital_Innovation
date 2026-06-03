# Aholo API integration (Afterimage)

This matches the **Aholo Quick Start** and **World Reconstruction** docs you shared.

## Flow

| Step | Aholo API | This app |
|------|-----------|----------|
| 1 | `GET https://api.aholo3d.cn/asset/v1/token` | `src/lib/aholo/upload.ts` |
| 2 | Upload each file to `{globalDomain}/ous/api/v2/...` with header `ous-token-v2` (new token per file) | same |
| 3 | `POST /world/v1/reconstructions` with `resources[].url` from OUS | `src/app/api/reconstruct/route.ts` |
| 4 | Poll `GET /world/v1/{worldId}` until `SUCCEEDED` | `src/app/api/world/[worldId]` |
| 5 | Load `assets.splats.urls.plyPath` or `spzPath` in viewer | `/api/model?url=...&ext=ply` |

## Auth

- Header: `Authorization: <API key>` — **no** `Bearer` prefix
- Optional: `x-source: afterimage-prototype` via `AHOLO_X_SOURCE` in `.env.local`
- OUS upload host does **not** use `Authorization`; only `ous-token-v2`

## Reconstruction body (required fields)

```json
{
  "name": "Afterimage capture",
  "scene": "space",
  "taskQuality": "normal",
  "cover": "<first image OUS url>",
  "resources": [
    { "url": "<ous url>", "type": "image" }
  ]
}
```

- **≥ 20** image resources for reconstruction
- URLs must come from the **asset/OUS** upload module (not random HTTP links)
- Images must be valid JPEG/PNG (Aholo validates `imageInfo` server-side)

## Diagnostics

With the dev server running:

```text
GET http://localhost:3000/api/test
GET http://localhost:3000/api/aholo/diagnostics
GET http://localhost:3000/api/aholo/diagnostics?worldId=YOUR_WORLD_ID
```

## Common errors

| Message | Meaning |
|---------|---------|
| `文件链接不对` / invalid file links | URLs were not produced by OUS upload |
| `Token已被使用` | Reused a single-use `ousToken` (app uploads one token per file) |
| HTML 500 on `/reconstructions` | Aholo server error — often bad image URLs or overload; retry with fewer/smaller JPEGs |
| `SUCCEEDED` but empty viewer | No `plyPath`/`spzPath` yet, or splat load failed — check diagnostics `worldId` |
