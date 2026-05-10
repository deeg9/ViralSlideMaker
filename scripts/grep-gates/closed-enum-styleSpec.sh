#!/usr/bin/env bash
# Phase 74 PARITY-05: Closed-enum invariant grep gate.
#
# Defends against legal exposure (no reference_artist free-text) AND
# prompt-injection (no free-text landing zone for adversarial directive
# payloads embedded in image text). Failing this gate means someone
# introduced a free-text field that bypasses the closed-enum architectural
# defense. DO NOT silence this gate — fix the field.
#
# See .planning/phases/74-schema-foundation-closed-enum-reference-upload-ptf-baseline/
# 74-CONTEXT.md decisions D-01 (closed-enum invariant) +
# .planning/research/PITFALLS.md Pitfalls 1 + 3.
set -euo pipefail

FORBIDDEN_PATTERN='reference_artist|reference_brand|copy_exactly|style_freetext'

# Search production source ONLY:
#   - Anchored to src/ (never node_modules, .next, .planning).
#   - Excludes test files (validator tests legitimately PASS forbidden tokens
#     as INPUT to verify they are stripped — that's the point of the test).
#   - Includes UNTRACKED files (`--untracked`) so a freshly-introduced .ts
#     containing a forbidden token trips the gate at PR time, not after merge.
#   - Strips line-prefix comments (// or # or *) so commentary about the gate
#     in production source files (e.g. style-spec.ts header) does not trip
#     the gate. This is the "self-invalidating grep gate" anti-pattern
#     defense from gsd planner rules.
MATCHES=$(git grep --untracked -nE "$FORBIDDEN_PATTERN" -- 'src/' \
  ':(exclude)src/**/__tests__/**' \
  ':(exclude)src/**/*.test.*' \
  ':(exclude)src/**/*.spec.*' \
  2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|#)' \
  || true)

if [[ -n "$MATCHES" ]]; then
  echo "PARITY-05 closed-enum gate FAILED — forbidden free-text fields detected:" >&2
  echo "$MATCHES" >&2
  echo "" >&2
  echo "Closed-enum invariant: every StyleSpec string field MUST be a closed enum" >&2
  echo "imported from an existing constants module." >&2
  echo "See .planning/research/PITFALLS.md Pitfalls 1 + 3." >&2
  exit 1
fi

echo "PARITY-05: zero free-text closed-enum violations in src/"
