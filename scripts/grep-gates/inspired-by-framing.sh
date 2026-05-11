#!/usr/bin/env bash
# Phase 79 Plan 02 Task 4 (LEGAL-03 + PARITY-05):
# Final close-out grep gate that locks "Inspired by" framing across every
# v2.13 user-facing UI surface file.
#
# The Phases 76, 77, and 78 plans incrementally enforced this framing per
# component (one Test 4-style assertion per file). This gate is the
# repo-wide net that catches drift in any newly added surface file at PR
# time — failing this gate means a new piece of UI shipped copy that
# misrepresents the style-from-reference feature as a clone / duplicate /
# exact reproduction. Fix the copy.
#
# Surfaces in scope (CONTEXT.md grounding):
#   - src/components/style-from-reference/
#   - src/components/projects/
#   - src/app/(dashboard)/style-from-reference/
#   - src/app/(dashboard)/dashboard/page.tsx
#
# Forbidden tokens:
#   exactly like, clone, copy this, duplicate the, stolen from, ripped from
#
# Excluded from the scan (intentional):
#   - Comment-prefixed lines (// or # or *) — discussion ABOUT the gate in a
#     production source file should not trip it (self-invalidating-grep
#     anti-pattern defense; mirrors the closed-enum gate's stance).
#   - Test files under __tests__/ — fixtures and grep-assertions legitimately
#     list forbidden tokens to prove the component does not output them
#     (e.g. src/components/projects/__tests__/from-references-badge.test.tsx).
#
# Wired into `npm run lint:gates` — exits 0 on success, exits 1 with the
# offending file:line on failure. CI-killing on failure.
set -euo pipefail

FORBIDDEN_PATTERN='exactly like|\bclone\b|copy this|duplicate the|stolen from|ripped from'

# Surface scope — anchored to the four paths CONTEXT.md grounds the gate to.
# `git grep` accepts multiple pathspecs after `--`; we list each surface
# explicitly so a drift to a NEW v2.13 path requires a deliberate edit here.
MATCHES=$(git grep --untracked -nEi "$FORBIDDEN_PATTERN" -- \
  'src/components/style-from-reference/' \
  'src/components/projects/' \
  'src/app/(dashboard)/style-from-reference/' \
  'src/app/(dashboard)/dashboard/page.tsx' \
  ':(exclude)src/**/__tests__/**' \
  ':(exclude)src/**/*.test.*' \
  ':(exclude)src/**/*.spec.*' \
  2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|#)' \
  || true)

if [[ -n "$MATCHES" ]]; then
  echo "LEGAL-03 inspired-by-framing gate FAILED — forbidden framing tokens detected:" >&2
  echo "$MATCHES" >&2
  echo "" >&2
  echo "All v2.13 UI surfaces MUST use 'Inspired by' framing — never 'exactly like'," >&2
  echo "'clone', 'copy this', 'duplicate the', 'stolen from', or 'ripped from'." >&2
  echo "Fix the copy in the offending file." >&2
  echo "See .planning/phases/79-legal-hardening-tos-clickwrap-audit-log-copy-review/79-CONTEXT.md (LEGAL-03)." >&2
  exit 1
fi

echo "PARITY-05 final close-out: zero forbidden framing tokens across v2.13 UI surfaces"
