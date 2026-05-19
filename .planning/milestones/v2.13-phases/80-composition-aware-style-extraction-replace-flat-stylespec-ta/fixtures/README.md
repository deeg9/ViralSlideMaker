# Phase 80 Fixtures — Reference Images for Archetype Classification

This directory holds 3-5 curated reference images used by the Phase 80
verification flow to confirm that `extractStyleSpec` classifies each reference
into the expected archetype.

**Scope:** Fixtures live **phase-scoped** (here under `.planning/phases/80-…/fixtures/`),
NOT in the test bundle. The integration test
(`src/lib/ai/__tests__/composition-aware-extraction.integration.test.ts`) reads
images from this directory at runtime; when an image is missing the test emits
a warning and skips rather than failing the suite.

**Pass threshold (per 80-CONTEXT.md §Verification, Fixtures, and Migration Mechanics):**
3 of 5 references must classify correctly. Two of the five are **MUST-PASS** —
both `meta-workers.png` (`caption-bar-bottom`) and `chip-sales.png`
(`full-bleed-text-overlay`) MUST classify correctly for Phase 80 to be
considered complete. The remaining three are pass-or-flag.

## Fixture Catalog

| Filename                | Expected Archetype          | Expected Slot Params                                         | MUST-PASS? | Notes                                                                                       |
| ----------------------- | --------------------------- | ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------- |
| `meta-workers.png`      | `caption-bar-bottom`        | `caption.background=solid`, `caption.heightFraction=0.40`    | **YES**    | Triggering observation for Phase 80 — photo top + solid black caption bottom + yellow highlights |
| `chip-sales.png`        | `full-bleed-text-overlay`   | (none)                                                       | **YES**    | Single full-bleed circuit-board photo + text floating mid-frame; no caption container        |
| `editorial-magazine.png`| `editorial-serif`           | (none)                                                       | NO         | Editorial / magazine layout featuring large serif typography                                 |
| `notes-app-pink.png`    | `notes-sticker`             | (none)                                                       | NO         | iOS Notes / sticker / paper-aesthetic with pink highlight stickers                           |
| `collage-2up-bw.png`    | `photo-collage-2up`         | `split.direction=horizontal`, `split.ratio=50-50`            | NO         | Two-photo horizontal collage, 50/50 ratio, B&W treatment                                     |

## Fixture File Format

- **Format:** PNG or JPG (no HEIC, no WebP).
- **Aspect:** close to 9:16 (slide aspect). Square is acceptable for `editorial-magazine` only.
- **Size cap:** ≤ 2 MB each (the integration test loads bytes into memory).
- **Filename rule:** lowercase kebab-case, matching the catalog column **verbatim**.
  The integration test reads `fs.readFileSync(path.join(fixturesDir, '<filename>'))`;
  a typo in either place silently skips the case.

## Sibling Spec Files (optional)

A future enhancement supports a sibling YAML spec per fixture (e.g.
`meta-workers.expected.yaml`):

```yaml
expected_archetype: caption-bar-bottom
expected_slot_params:
  caption:
    background: solid
    heightFraction: 0.40
must_pass: true
```

If present, the integration test reads from the YAML instead of the catalog
table. For v1 the catalog table above is authoritative.

## How fixtures are added

1. Save the image as `<kebab-case-name>.<png|jpg>` in this directory.
2. Update the **Fixture Catalog** table above with one row (filename, expected
   archetype, expected slot params, MUST-PASS flag, notes).
3. Run the integration test with the env-var gate:
   ```bash
   PHASE80_LIVE_FIXTURES=1 GEMINI_API_KEY=<key> \
     npx vitest run src/lib/ai/__tests__/composition-aware-extraction.integration.test.ts
   ```
   When `PHASE80_LIVE_FIXTURES` is unset the test skips cleanly.

## Out of scope

Fixtures are **local-only reference material** per Phase 79 LEGAL-05's
user-assumed-liability clickwrap. Do NOT commit licensed photos or
right-of-publicity-protected images. The Phase 80 phase scope keeps the catalog
small (5 images) and the directory phase-isolated so the audit boundary is
clear.
