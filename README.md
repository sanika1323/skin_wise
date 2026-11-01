# SkinWise AI — Your skin, understood.

**YouCam API Skin AI Hackathon entry.** SkinWise turns a real YouCam AI skin analysis into practical decisions — and checks the products you already own *before* recommending anything new.

> Signature feature — **Smart Skin-to-Shelf Engine**: analyse skin → understand goals → check the owned shelf → find genuine routine gaps → recommend only what's useful, or explicitly recommend **no purchase**.

## The journey

1. **Skin Analysis** — photo guidance, drag-and-drop or camera, client-side checks (JPG/PNG, ≤10 MB, shorter side ≥480 px), explicit consent, live status, refresh-safe resume.
2. **Results** — only metrics YouCam returned (`ui_score`, `raw_score`, mask links). Missing metrics are labelled "Not returned", never filled in.
3. **Skin Profile** — three visibly separate sources: AI-assessed (YouCam, read-only), self-reported (editable), SkinWise-derived priorities.
4. **My Routine** — generated AM/PM steps with owned products assigned and a reason for every step. Add, remove, reorder, reassign, mark optional, log daily completion.
5. **Skin-to-Shelf** — routine coverage %, covered vs. genuine gaps, live Open Beauty Facts search only for missing steps, transparent ranking (`0.35G + 0.25P + 0.20B + 0.20I`, missing inputs excluded — never guessed), save / dismiss / details. "You may not need to buy anything" is a first-class outcome.
6. **Discover & My Products** — real catalog records, barcode-verified shelf, compare 2–3 products, expiry/notes/remaining, duplicate prevention.
7. **Skin Journey** — dated history, like-for-like comparison of shared metrics only, trend chart, 14-day routine consistency, personal notes kept separate.
8. **Assistant** — rule-based, grounded only in saved SkinWise data; refuses diagnosis.

## YouCam integration (server-side only)

`POST /s2s/v2.0/file` → `PUT` pre-signed upload → `POST /s2s/v2.0/task/skin-analysis` (SD actions) → backend polls `GET /task/skin-analysis/:task_id` → normalised and saved. The browser only talks to Express. Provider errors (e.g. `error_src_face_too_small`, `error_lighting_dark`) are mapped to safe, actionable messages.

## Run locally (Windows)

1. `INSTALL-WINDOWS.bat` (or `npm install` in the root and in `server/`).
2. Copy `server/.env.example` → `server/.env` and set `YOUCAM_API_KEY`.
3. `START-SKINWISE.bat` (or `cd server && npm run dev`, then `npm run dev` in the root).
4. Open http://127.0.0.1:5173 — health check: http://127.0.0.1:4000/api/health (`youcamConfigured: true` when the key is set).

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Health + whether YouCam is configured |
| POST | /api/skin-analysis | Upload selfie (multipart `image`, `actions`, `consent=true`), create task |
| GET | /api/skin-analysis/history | Saved assessments |
| GET | /api/skin-analysis/:id | Status (polls YouCam while processing) |
| GET | /api/skin-analysis/:id/result | Completed result |
| PATCH / DELETE | /api/skin-analysis/:id | Personal note / delete record |
| GET / PUT | /api/profile | Self-reported profile (never overwritten by analysis) |
| GET / PUT | /api/routine | AM/PM routines |
| POST | /api/routine/log | Daily step completion |
| GET | /api/products/search?q= | Open Beauty Facts search |
| GET / POST | /api/shelf | Owned products (barcode-verified) |
| PATCH / DELETE | /api/shelf/:id | Edit role/usage/expiry/notes; remove (routine steps auto-unassigned) |

## Privacy & trust

- Selfies stay in memory and are never written to disk; consent is required per upload.
- API key is read from server env only.
- No fabricated scores, prices, products or images. Missing data is labelled.
- Cosmetic information only — not a diagnosis.

## Stack & limits

React 19 + TypeScript + Vite · Express · JSON persistence (`server/data`, configurable via `DATA_DIR`). Single-user prototype without auth; use a persistent disk or managed DB in production. Open Beauty Facts is community-maintained and has no reliable prices, so budget fit is shown as unavailable rather than estimated.
