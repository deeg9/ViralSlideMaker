# Deferred items — quick task 260518-jhg

Out-of-scope discoveries logged during execution. NOT fixed by this task.

## Pre-existing test failure: `src/__tests__/ai/prompts.test.ts`

- **Test:** `prompts > buildSystemPrompt returns string containing all 6 hook patterns`
- **Status:** Failing at the original base commit `e47e07530c38223714d1c46464eb8cb066914fc2`
  (verified by `git checkout <base> -- .` then running the suite — fails identically
  with zero changes from this task applied).
- **Why deferred:** Not caused by the news-cyan -> news-oracle swap. The test asserts
  `buildSystemPrompt()` (no args) contains all 6 hook-pattern strings; the no-arg /
  base-prompt path was not touched by this task. Fixing it would alter prompt text,
  which is explicitly OUT OF SCOPE for this quick task (the AI generation recipe is
  deferred to a future roadmap phase).
- **Note:** The two news-prompt-branch tests this task DOES affect both pass —
  `buildSystemPrompt('news-cyan') still contains 'NEWS DROP TEMPLATE'` and
  `buildSystemPrompt('news-drop') still contains 'NEWS DROP TEMPLATE (active):'`.

## Pre-existing snapshot failures: legacy template byte-identical guards

- **Files:** `src/__tests__/render/legacy-templates-byte-identical.test.ts`,
  `src/__tests__/render/legacy-templates-regression.test.tsx`
- **Failing cases:** `news-drop`, `highlight-bar`, `y2k-pop`, `bold-yellow`
  (4 mismatched legacy snapshots + the news-drop JSON-hash fixture).
- **Status:** Failing identically at the original base commit
  `e47e07530c38223714d1c46464eb8cb066914fc2` (verified — 5 failed there with
  zero changes from this task applied).
- **Why deferred:** Not caused by this task. The failing templates
  (news-drop, highlight-bar, y2k-pop, bold-yellow) were NOT modified — only
  `news-cyan` is in scope for the TPLREND-05 invariant, and `news-cyan`
  PASSES both legacy guards (byte-identical hash + render snapshot). The
  pre-existing drift on the other 4 templates is an unrelated stale-snapshot
  issue and out of scope (SCOPE BOUNDARY — only auto-fix issues caused by
  this task's changes).
- **TPLREND-05 status:** SATISFIED. `git diff --exit-code <base> HEAD --
  src/lib/render/templates/news-cyan.ts` is clean (byte-identical), and the
  news-cyan legacy byte-identical + regression snapshot cases both pass.
