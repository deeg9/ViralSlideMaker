---
phase: 39-brand-kit-profile
status: complete
shipped: 2026-04-28
requirements_closed: [API-18, API-19, API-20, API-21, DOC-01, DOC-02]
---

# Phase 39 — SUMMARY

## What shipped

5 endpoints (4 entity + 1 logo-upload helper) that expose brand-kit and profile management to API customers, plus the milestone close-out docs.

| Endpoint | Method | Notes |
|---|---|---|
| Get brand kit | `GET /me/brand-kit` | returns null when not yet created |
| Upsert brand kit | `PUT /me/brand-kit` | partial body OK; unknown fields dropped |
| Create logo upload URL | `POST /me/brand-kit/logo-upload-url` | signed PUT URL to brand-kit-logos bucket |
| Get profile | `GET /me/profile` | reads public.profiles |
| Update profile | `PATCH /me/profile` | display_name, bio, avatar_url, website_url, social_links |

Plus matching OpenAPI entries (with new `BrandKit` and `Profile` schemas).

## Files

- **New** `src/app/api/v1/me/brand-kit/route.ts` — GET + PUT
- **New** `src/app/api/v1/me/brand-kit/logo-upload-url/route.ts` — POST
- **New** `src/app/api/v1/me/profile/route.ts` — GET + PATCH

## Decisions (defaults applied)

- **Brand kit upsert:** uses `upsert()` keyed on `user_id`. First call creates; subsequent calls merge. Default `name = "My Brand Kit"` when creating from scratch.
- **Brand kit field whitelist:** 17 documented fields. Unknown fields are silently dropped server-side (lenient — same pattern as existing slide PATCH).
- **Logo upload pattern:** signed PUT URL to `brand-kit-logos` bucket. Caller uploads directly with the returned `uploadUrl + token + Content-Type` headers, then PUTs `/me/brand-kit` with the resulting `publicUrl` as `logo_url`. Avoids streaming binary through our app.
- **Logo MIME whitelist:** PNG / JPEG / WebP / SVG. Filename is sanitized to `[a-zA-Z0-9_.-]` and capped at 80 chars to prevent path traversal.
- **Profile username:** intentionally NOT updateable via PATCH /me/profile. Username has its own one-shot `claim_username` RPC + the `/onboarding/username` flow; allowing PATCH here would let API callers squat on usernames.
- **Profile social_links:** flattens to a fixed key set (tiktok / instagram / x / youtube), strips leading `@`, caps each handle at 64 chars. Matches the existing server-action's behavior.

## Verification

- `npx tsc --noEmit | grep -E "brand-kit|profile"` → empty (no new type errors)
- All 4 routes return 401 to unauthenticated curls (expected)
- New schemas (BrandKit, Profile) added to OpenAPI components

## Out of scope

- Avatar upload via signed URL — re-uses the existing `avatars` bucket but ships a separate signed-upload endpoint in v2.6 if there's customer demand. For now, set `avatar_url` to any HTTPS URL the caller controls.
- Username claim/update via API — defer to v2.6.
