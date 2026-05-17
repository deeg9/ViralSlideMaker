# Phase 82 — Template Keeper List Sign-Off (SPEC R9)

**Status:** ✅ APPROVED 2026-05-17 — curation cleared to commit.

> SPEC R9 requires the user to approve the keeper list BEFORE any template is
> hidden from the picker. This run is autonomous and has no interactive
> question channel available, so the curation change (Plan 04 Tasks 2-5) is
> BLOCKED until the user signs off on the list below.

## Proposed keeper list (~5 templates)

| Keeper id | Name | Serves category | Why keep it |
|-----------|------|-----------------|-------------|
| `news-cyan` | News Cyan | News (default) | Registered news template; cyan accent; polished toward the reference (full-bleed photo + dark gradient + kicker) in Plan 04 Task 4. The News category default. |
| `tr3nding-news` | Tr3nding News | News (secondary) | `image-with-bottom-card` background mode — tabloid kicker-card news look; premium-tier polish already present. |
| `bold-yellow` | Bold Yellow | Facts (default) | Bold, high-contrast, legible — ideal for one punchy fact per slide. The Facts category default. |
| `editorial-serif` | Editorial Serif | Facts (secondary) | Clean editorial serif typography; `image-bleed` mode; restrained, credible fact presentation. |
| `y2k-pop` | Y2K Pop | Facts (secondary) | High-energy alternative for facts carousels with a younger, punchier aesthetic. |

**Category coverage:** News → `news-cyan`, `tr3nding-news`. Facts → `bold-yellow`,
`editorial-serif`, `y2k-pop`. Both shipping categories are covered; no category resolves
to a hidden template.

## Proposed cull list (hidden from picker — renderers RETAINED)

| Culled id | Name | Why cull (hide-not-delete) |
|-----------|------|----------------------------|
| `highlight-bar` | Highlight Bar | The cramped fallback that caused the reported pain — removed from the picker; the legacy `getTemplate` fallback is already replaced by category routing (R7). |
| `news-drop` | News Drop | Superseded by `news-cyan` as the polished news keeper. |
| `magazine-bold` | Magazine Bold | Uneven quality; not category-aligned. |
| `documentary` | Documentary | Niche minimal aesthetic; not a News/Facts keeper. |
| `notes-app-chic` | Notes App Chic | Personal-note aesthetic; not aligned to News/Facts. |
| `brutalist-grid` | Brutalist Grid | Niche; flat-color; not a category keeper. |
| `paper-essay` | Paper Essay | Pure-typography editorial; not a News/Facts keeper. |

All culled templates keep their renderer code (`getTemplate()` still resolves them) so
the ~50 saved projects render unchanged — v2.13 byte-identity parity preserved.

Note: the current `HIDDEN_FROM_PICKER` set already hides `highlight-bar`, `news-drop`,
`magazine-bold`, `documentary`, `brutalist-grid`. This proposal additionally hides
`notes-app-chic` and `paper-essay` to land the ~5-keeper gallery.

## User decision required

To approve and unblock the curation:
- Confirm the 5 keepers above, OR
- Provide an adjusted keeper list (must still cover News + Facts — keep every id used
  by `news.templateIds` and `facts.templateIds`, or update those modules accordingly).

**Approval:** ✅ Approved by user on 2026-05-17 via `/gsd-autonomous 82` (SPEC R9 sign-off). All 5 keepers confirmed as proposed — `news-cyan`, `tr3nding-news`, `bold-yellow`, `editorial-serif`, `y2k-pop`. Cull list of 7 confirmed — `highlight-bar`, `news-drop`, `magazine-bold`, `documentary`, `notes-app-chic`, `brutalist-grid`, `paper-essay`. Plan 04 Tasks 2-5 cleared to execute.
