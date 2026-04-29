#!/usr/bin/env bash
# Phase 42 verification harness — runs all 16 acceptance checks for plan 42-01.
#
# Usage:
#   bash packages/mcp-cli/scripts/verify.sh
#
# Exits non-zero on any failure. Prints PASS/FAIL per check.
# Run from the repo root (uses repo-relative paths).
#
# Wave 0 contract: this script is the contract; later tasks ratchet checks green
# one by one. Several checks WILL fail until tasks 2–5 land.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS_COUNT=0
FAIL_COUNT=0
FAILED_CHECKS=()

print_header() {
  echo "==============================================================="
  echo " Phase 42 Verification Harness — viralslidemaker-mcp + docs"
  echo " Repo root: $REPO_ROOT"
  echo "==============================================================="
}

check() {
  local num="$1"
  local label="$2"
  local cmd="$3"
  if bash -c "$cmd" > /dev/null 2>&1; then
    echo "[PASS] $num. $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[FAIL] $num. $label"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_CHECKS+=("$num. $label")
  fi
}

print_header

# 1. JS syntax of bin/cli.js
check 1 "node --check packages/mcp-cli/bin/cli.js" \
  "node --check packages/mcp-cli/bin/cli.js"

# 2. bin/cli.js executable bit set
check 2 "test -x packages/mcp-cli/bin/cli.js" \
  "test -x packages/mcp-cli/bin/cli.js"

# 3. shebang present on line 1
check 3 "shebang #!/usr/bin/env node on line 1" \
  "head -1 packages/mcp-cli/bin/cli.js | grep -q '^#!/usr/bin/env node'"

# 4. spawn args correct: mcp-remote + Authorization:Bearer + /api/mcp
check 4 "bridge spawn args (mcp-remote + Authorization:Bearer + /api/mcp)" \
  "grep -q 'mcp-remote' packages/mcp-cli/bin/cli.js && grep -q 'Authorization:Bearer' packages/mcp-cli/bin/cli.js && grep -q '/api/mcp' packages/mcp-cli/bin/cli.js"

# 5. missing-key error points to /settings/api-keys
check 5 "missing-key error points to /settings/api-keys" \
  "grep -q '/settings/api-keys' packages/mcp-cli/bin/cli.js"

# 6. base URL override + default present
check 6 "VIRALSLIDEMAKER_BASE_URL override + viralslidemaker.com default" \
  "grep -q 'VIRALSLIDEMAKER_BASE_URL' packages/mcp-cli/bin/cli.js && grep -q 'https://viralslidemaker.com' packages/mcp-cli/bin/cli.js"

# 7. missing-key produces non-zero exit + helpful stderr
check 7 "running with no API key exits 1 and mentions VIRALSLIDEMAKER_API_KEY + /settings/api-keys" \
  "(unset VIRALSLIDEMAKER_API_KEY; out=\$(node packages/mcp-cli/bin/cli.js 2>&1); rc=\$?; printf '%s\nexit=%s' \"\$out\" \"\$rc\") | grep -q 'VIRALSLIDEMAKER_API_KEY' && (unset VIRALSLIDEMAKER_API_KEY; node packages/mcp-cli/bin/cli.js 2>&1; echo exit=\$?) | grep -q '/settings/api-keys' && (unset VIRALSLIDEMAKER_API_KEY; node packages/mcp-cli/bin/cli.js 2>&1; echo exit=\$?) | grep -q 'exit=1'"

# 8. package metadata correct (name, version, bin path, mcp-remote dep, README in files)
check 8 "package.json metadata (name, version, bin, mcp-remote ^0.1.38, README in files)" \
  "jq -e '.name == \"viralslidemaker-mcp\" and .version == \"0.1.0\" and .bin[\"viralslidemaker-mcp\"] == \"bin/cli.js\" and .dependencies[\"mcp-remote\"] == \"^0.1.38\" and (.files | index(\"README.md\")) != null' packages/mcp-cli/package.json"

# 9. all 4 client sections present in setup guide
check 9 "MCP-GUIDE.md contains Claude Desktop, Cursor, Windsurf, ChatGPT sections" \
  'for c in "Claude Desktop" "Cursor" "Windsurf" "ChatGPT"; do grep -q "$c" docs/MCP-GUIDE.md || exit 1; done'

# 10. install snippet present in setup guide
check 10 "MCP-GUIDE.md includes 'npx -y viralslidemaker-mcp' install snippet" \
  "grep -q 'npx -y viralslidemaker-mcp' docs/MCP-GUIDE.md"

# 11. ChatGPT workspace-tier gate documented
check 11 "MCP-GUIDE.md documents ChatGPT workspace-tier gate (Pro|Plus|Business|Enterprise|Edu) + developer mode" \
  "grep -qE 'Pro\\|Plus\\|Business\\|Enterprise\\|Edu' docs/MCP-GUIDE.md && grep -qi 'developer mode' docs/MCP-GUIDE.md"

# 12. render-URL browser-session limitation documented
check 12 "MCP-GUIDE.md documents render_carousel browser-session limitation" \
  "grep -qi 'render_carousel' docs/MCP-GUIDE.md && grep -qi 'browser' docs/MCP-GUIDE.md"

# 13. automation-guide.tsx has 4+ cards
check 13 "automation-guide.tsx renders 4+ <GuideCard> instances" \
  '[ "$(grep -c "<GuideCard" src/components/api-keys/automation-guide.tsx)" -ge 4 ]'

# 14. MCP referenced in automation-guide.tsx
check 14 "automation-guide.tsx mentions MCP" \
  "grep -q 'MCP' src/components/api-keys/automation-guide.tsx"

# 15. setup-guide link present in automation-guide.tsx
check 15 "automation-guide.tsx links to MCP-GUIDE setup guide" \
  "grep -q 'MCP-GUIDE' src/components/api-keys/automation-guide.tsx"

# 16. README links to setup guide
check 16 "packages/mcp-cli/README.md links to MCP-GUIDE setup guide" \
  "grep -q 'MCP-GUIDE' packages/mcp-cli/README.md"

echo "==============================================================="
echo " Results: $PASS_COUNT passed, $FAIL_COUNT failed"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo " STATUS: PASS"
  echo "==============================================================="
  exit 0
else
  echo " STATUS: FAIL"
  echo " Failed checks:"
  for c in "${FAILED_CHECKS[@]}"; do
    echo "   - $c"
  done
  echo "==============================================================="
  exit 1
fi
