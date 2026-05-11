# Phase 79: Legal Hardening + ToS Clickwrap + Audit Log + Copy Review - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Smart-discuss — small phase; closes legal exposure surface; mirrors v2.4/v2.9 cron retention pattern + standard ToS clickwrap

<domain>
## Phase Boundary

Close the legal exposure surface with explicit user acknowledgement (ToS clickwrap), durable audit trail (`style_reference_uploads` table + 12-month pg_cron retention), public DMCA process docs, and a final copy review pass enforcing "Inspired by" framing across every UI surface.

7 reqs in scope: LEGAL-01..06 + PARITY-05 (final close-out check that closed-enum gate continues to pass).

**Final phase of v2.13.** After this ships, milestone is ready for audit + complete + cleanup.

</domain>

<decisions>
## Locked specs (REQUIREMENTS.md)
- **LEGAL-01:** ToS clickwrap modal on first style-from-reference upload — blocks submission until "I have rights to these images" explicitly checked; user_id + ToS version + timestamp recorded
- **LEGAL-02:** new `style_reference_uploads` audit table (sha256 + user_id + ToS_version + accepted_at); 12-month retention via pg_cron (mirror v2.4/v2.9 cron retention patterns)
- **LEGAL-03:** All UI copy uses "Inspired by" framing — final grep gate on shipped style-from-reference UI files; zero matches for `exactly like / clone / copy this / duplicate the` (already enforced incrementally Phases 76-78; this phase locks it as a CI gate)
- **LEGAL-04:** `docs/legal/dmca-style-references.md` documents takedown contact + audit-log lookup procedure + response SLA
- **LEGAL-05:** ToS document update — new section covering style-from-reference rights/responsibilities (mirror Canva AI Product Terms pattern); update in `src/app/terms/page.tsx`
- **LEGAL-06:** Closed-enum schema (covered structurally by Phase 74 STYLESPEC-03..09 + lint:gates) — verify-only in this phase
- **PARITY-05:** Final close-out: `npm run lint:gates` passes end-to-end across all v2.13 surfaces

### Claude's Discretion
- **Audit table location:** new migration `supabase/migrations/20260510_v213_style_reference_uploads_audit.sql` (separate file; mirrors existing audit/cron migration pattern)
- **ToS version constant:** new module `src/lib/legal/tos-version.ts` exports `STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-10-v1' as const` — single source of truth; bump on substantive ToS changes
- **Clickwrap component:** `src/components/style-from-reference/tos-clickwrap-modal.tsx` — shadcn `<Dialog>` + checkbox; intercepts the first upload click per user (check `style_reference_uploads` for prior accepted_at OR localStorage for performance + server-side enforcement)
- **Server-side enforcement:** `<ReferenceImageUploader>` upload handler reads ToS acceptance status; rejects upload if not accepted with `{ error: 'tos_required' }` — defense-in-depth alongside client-side modal
- **DMCA doc location:** `docs/legal/dmca-style-references.md` — single MD file with takedown contact + lookup procedure + SLA
- **ToS page update:** add a new H2 section "Style-from-Reference Generation" to `src/app/terms/page.tsx` with the standard rights/responsibilities clause (mirror Canva AI Product Terms language: user responsible for ensuring uploaded references don't infringe; we're not legal advisors; takedown via DMCA contact)
- **Final LEGAL-03 grep gate:** `scripts/grep-gates/inspired-by-framing.sh` — fails CI on any `exactly like|clone|copy this|duplicate the|stolen from|ripped from` token in style-from-reference UI surface files. Wire into `lint:gates` script.

</decisions>

<code_context>
## Reusable Assets
- `supabase/migrations/20260427_explore_remix_phase31_cron.sql` — existing pg_cron retention pattern (mirror)
- `supabase/migrations/20260501_treated_backgrounds_retention_cron.sql` — existing 30-day retention cron (mirror; we want 12-month for audit)
- `src/app/terms/page.tsx` — existing ToS page (extend, don't replace)
- shadcn `<Dialog>` + checkbox primitives for clickwrap modal
- `<ReferenceImageUploader>` from Phase 74-03 — extend with ToS check
- Phase 74 closed-enum grep gate (`scripts/grep-gates/closed-enum-styleSpec.sh`) — sibling pattern for the new "Inspired by" framing gate
- `package.json` `lint:gates` script (already wires closed-enum gate + token-budget gate from Phase 74-77; this phase appends one more)

## Established Patterns
- pg_cron retention: `SELECT cron.schedule('job-name', '0 9 * * *', $$DELETE FROM table WHERE created_at < now() - interval '12 months'$$);`
- Audit tables: insert-only, no updates; user_id FK to auth.users; sha256 indexed for lookup
- ToS clickwrap: dialog blocks submit until checkbox checked; persist acceptance in audit table; check on subsequent uploads to skip dialog (fast path)

## Integration Points
- New: `supabase/migrations/20260510_v213_style_reference_uploads_audit.sql` (table + RLS + 12-month cron)
- New: `src/lib/legal/tos-version.ts` (version constant + helpers `getStyleFromReferenceTosVersion()`)
- New: `src/components/style-from-reference/tos-clickwrap-modal.tsx`
- New: Server Action `acceptStyleFromReferenceTos` in `src/app/(dashboard)/style-from-reference/actions.ts`
- Modified: `src/components/dashboard/reference-image-uploader.tsx` — gate first upload behind ToS modal
- Modified: `src/app/terms/page.tsx` — add Style-from-Reference section
- New: `docs/legal/dmca-style-references.md`
- New: `scripts/grep-gates/inspired-by-framing.sh` (wired into `lint:gates`)
- Modified: `package.json` `lint:gates` script (append the new gate)

</code_context>

<specifics>
## Specifics
- ToS clickwrap fires on FIRST style-from-reference upload per user (subsequent uploads skip the dialog — checked against `style_reference_uploads` audit table)
- ToS version is recorded; bumping the version forces re-acceptance (existing accepted_at rows ≠ new version)
- Audit table is the single source of truth for "did this user accept?" — localStorage is a performance hint but not authoritative
- DMCA contact: use existing project support email or a dedicated alias (e.g., `dmca@viralslidemaker.com` — placeholder; operator can edit)
- LEGAL-03 grep gate runs on `src/components/style-from-reference/`, `src/components/projects/`, `src/app/(dashboard)/style-from-reference/`, `src/app/(dashboard)/dashboard/page.tsx` — the v2.13 UI surface files specifically (NOT all of src/, to avoid false positives in unrelated existing UI)

</specifics>

<deferred>
## Deferred
- Per-region legal compliance (EU GDPR specific clauses, etc.) — defer to v2.14+ if needed
- Automated DMCA workflow (in-app form) — defer; v2.13 uses email contact
- Right-of-publicity specific clause (face-in-reference) — defer; refusal pre-pass + Inspired-by framing covers initial posture
- Per-image rights metadata — defer

</deferred>
