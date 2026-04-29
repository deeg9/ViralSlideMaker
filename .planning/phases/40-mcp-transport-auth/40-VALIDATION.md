---
phase: 40
slug: mcp-transport-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm vitest run src/__tests__/mcp/` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~10 seconds (mcp/) / ~60s (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/__tests__/mcp/`
- **After every plan wave:** Run `pnpm vitest run` + `pnpm build`
- **Before `/gsd-verify-work`:** Full suite + `pnpm build` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Filled in by the planner during plan generation. The following slots track expected coverage; planner replaces with concrete task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-XX | 01 | 1 | MCP-TRANS-01 | — | `/api/mcp` accepts JSON-RPC 2.0 | integration | `pnpm vitest run src/__tests__/mcp/route.test.ts` | ❌ W0 | ⬜ pending |
| 40-01-XX | 01 | 1 | MCP-TRANS-02 | T-40-01 | invalid token → MCP-spec error | integration | `pnpm vitest run src/__tests__/mcp/auth.test.ts` | ❌ W0 | ⬜ pending |
| 40-01-XX | 01 | 1 | MCP-TRANS-03 | T-40-02 | per-key Upstash rate limit | integration | `pnpm vitest run src/__tests__/mcp/rate-limit.test.ts` | ❌ W0 | ⬜ pending |
| 40-01-XX | 01 | 1 | MCP-TRANS-04 | — | stateless transport configured | unit | grep `sessionIdGenerator: undefined` route file | ❌ W0 | ⬜ pending |
| 40-01-XX | 01 | 1 | MCP-TRANS-05 | T-40-03 | shared auth-core helper | unit | `pnpm vitest run src/__tests__/api/auth-core.test.ts` | ❌ W0 | ⬜ pending |
| 40-01-XX | 01 | 1 | MCP-TRANS-06 | — | build fails on missing mcp-handler | smoke | `pnpm vitest run src/__tests__/mcp/import-gate.test.ts` + `pnpm build` | ❌ W0 | ⬜ pending |
| 40-01-XX | 01 | 1 | MCP-TRANS-07 | — | middleware bypasses /api/mcp | unit | grep `/api/mcp` in src/middleware.ts | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/mcp/route.test.ts` — JSON-RPC 2.0 handshake smoke test (MCP-TRANS-01)
- [ ] `src/__tests__/mcp/auth.test.ts` — Bearer token verification + invalid-token error response (MCP-TRANS-02, MCP-TRANS-05)
- [ ] `src/__tests__/mcp/rate-limit.test.ts` — per-key sliding window (MCP-TRANS-03)
- [ ] `src/__tests__/mcp/import-gate.test.ts` — assert `mcp-handler` exports `createMcpHandler` and `withMcpAuth` as functions (MCP-TRANS-06 belt-and-braces)
- [ ] `src/__tests__/api/auth-core.test.ts` — verify shared SHA-256 → DB lookup helper (MCP-TRANS-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MCP Inspector handshake | MCP-TRANS-01 | Full protocol round-trip needs running dev server | `pnpm dev` then `npx @modelcontextprotocol/inspector` → connect to `http://localhost:3000/api/mcp` with header `Authorization: Bearer vsl_<test_key>` → `initialize` succeeds |
| Production smoke after deploy | MCP-TRANS-01, MCP-TRANS-06 | Validates the build-gate caught any missing dep on real Vercel build | `curl -X POST https://viralslidemaker.com/api/mcp -H "Authorization: Bearer vsl_..." -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'` → returns server capabilities |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once task IDs are concrete)

**Approval:** pending
