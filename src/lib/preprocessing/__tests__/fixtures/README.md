# preprocessing test fixtures

Test fixtures are constructed in-memory via `sharp.create()` — no binary
fixtures are committed to the repo.

HEIC support depends on the libvips build that `sharp` was compiled
against. The HEIC test self-skips with `it.todo` (with a documented reason)
if HEIC encode is unavailable in the active libvips build, instead of
silently `skip`ping. The non-trivial path we care about is the HEIC DECODE
path (HEIC input → JPEG output via `prepareForVision`); if encode is
unavailable, the failure message in the `it.todo` notes that this is a
Phase 75 readiness checklist item and must be re-verified in CI before
Phase 75 ships.
