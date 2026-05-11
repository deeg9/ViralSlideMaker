# DMCA Takedown — Style-from-Reference Uploads

> **Operator action required:** before this document goes live, replace the
> placeholder contact address (`dmca@example.com`) with the operator's
> dedicated DMCA alias (e.g. `dmca@viralslidemaker.com` or the equivalent for
> your deployment).

## Scope

This document covers takedown requests for content related to the
**style-from-reference** feature — specifically, reference images that a
user uploaded to the private `slide-references` Storage bucket and any
generated carousels whose visual style was derived from those references.

For takedown of other Service content (AI-generated text from prompts,
stock imagery sourced from Pexels, account profile data), please follow
the general contact procedure in the platform Terms of Service.

## Framing

ViralSlideMaker generates carousels **inspired by** the aesthetic patterns
(palette, typography, layout) in user-supplied reference images. Generated
slides are not reproductions of the source images, brands depicted, or
individuals shown in them. The audit-log architecture described below is
designed to support takedown forensics in the rare case where a complainant
believes a specific upload should not have happened.

## Contact

**DMCA Designated Agent (placeholder — operator must edit):**
`dmca@example.com`

A complete takedown notice should include:

1. **Identification of the copyrighted work** alleged to be infringed
   (a description, URL, or attached image).
2. **Identification of the material** to be removed and information
   reasonably sufficient for us to locate it. For style-from-reference
   matters, please include either (a) the SHA-256 fingerprint of the
   reference image bytes if known, or (b) the user account email or
   project URL where the suspect generation appears.
3. **Your contact information** — full legal name, mailing address,
   telephone number, and email.
4. **A statement** that you have a good-faith belief that use of the
   material in the manner complained of is not authorized by the
   copyright owner, its agent, or the law.
5. **A statement** that the information in the notice is accurate and,
   under penalty of perjury, that you are authorized to act on behalf of
   the owner of an exclusive right that is allegedly infringed.
6. **A physical or electronic signature** of the authorized person.

## Audit-Log Lookup Procedure

The Service records one row in the `style_reference_uploads` table per
accepted reference image with the following columns:

| Column         | Meaning                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `user_id`      | The Supabase auth.users.id of the uploading account                      |
| `sha256`       | SHA-256 hex digest of the (preprocessed) reference image bytes           |
| `tos_version`  | The Style-from-Reference clause version the user accepted at upload time |
| `accepted_at`  | UTC timestamp of acceptance                                              |

Rows are retained for **twelve (12) months** and then deleted automatically
by a daily `pg_cron` sweep (see
`supabase/migrations/20260510_v213_style_reference_uploads_audit.sql`). After
twelve months, no historical record of the upload remains in this table.

Operator lookup query (run as `service_role` against Supabase):

```sql
SELECT user_id, tos_version, accepted_at
FROM style_reference_uploads
WHERE sha256 = '<sha256-from-complainant>'
ORDER BY accepted_at DESC
LIMIT 50;
```

If the complainant supplies an account email instead of a SHA-256:

```sql
SELECT u.email, l.sha256, l.tos_version, l.accepted_at
FROM style_reference_uploads l
JOIN auth.users u ON u.id = l.user_id
WHERE u.email = '<email-from-complainant>'
ORDER BY l.accepted_at DESC
LIMIT 100;
```

After identifying the matching upload(s), the operator should:

1. Locate the underlying Storage object in the `slide-references` bucket
   (path is recorded on the corresponding `projects.reference_assets`
   JSONB entry — query `projects` filtered by `user_id` and any project
   URL the complainant supplied).
2. Delete the Storage object via the Supabase Storage API.
3. Delete the corresponding entry from the project's
   `reference_assets` JSONB array.
4. Optionally delete the audit row itself, although the audit row is the
   record that proves we acted on the takedown — many operators retain
   it with an annotation column added (TODO: future schema change if a
   structured `removed_at` becomes useful).

## Service-Level Agreement

We aim to respond to a complete takedown notice within **five (5) business
days** of receipt at the DMCA contact address. Incomplete notices may
require a follow-up exchange before the SLA clock starts.

## Counter-Notification

If you are an account holder whose upload was removed in response to a
DMCA takedown and you believe the removal was a mistake, you may submit a
counter-notification to the same DMCA contact address. Counter-
notifications must include the elements specified at
17 U.S.C. § 512(g)(3).

## References

- Style-from-Reference clause: see Section 7a of the Terms of Service
  (`src/app/terms/page.tsx`).
- Audit table schema:
  `supabase/migrations/20260510_v213_style_reference_uploads_audit.sql`.
- Audit-log helpers:
  `src/lib/legal/audit-log.ts` —
  `recordStyleFromReferenceTosAcceptance` (writer),
  `hasUserAcceptedCurrentTos` (reader).
- ToS version constant: `src/lib/legal/tos-version.ts` —
  `STYLE_FROM_REFERENCE_TOS_VERSION`.
