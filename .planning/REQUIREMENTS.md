# Requirements: ViralSlideMaker v2.2 Public REST API

**Defined:** 2026-04-08
**Core Value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.

## v2.2 Requirements

Requirements for Public REST API milestone. Each maps to roadmap phases.

### API Key Management

- [ ] **KEY-01**: User can create an API key with a name, receiving a `vsl_` prefixed token shown once
- [ ] **KEY-02**: API key is stored as SHA-256 hash in Supabase with RLS policies
- [ ] **KEY-03**: User can list their API keys showing name, prefix (`vsl_abc1...`), created date, and last used timestamp
- [ ] **KEY-04**: User can revoke an API key, immediately invalidating it
- [ ] **KEY-05**: Settings page displays quick-start code snippets (curl/JS/Python) after key creation

### API Authentication

- [ ] **AUTH-01**: API routes accept `Authorization: Bearer vsl_...` header and authenticate via SHA-256 hash lookup
- [ ] **AUTH-02**: Hash comparison uses `crypto.timingSafeEqual` to prevent timing attacks
- [ ] **AUTH-03**: Middleware skips Supabase session auth for `/api/v1/*` routes
- [ ] **AUTH-04**: Route handlers use Supabase admin client (service role) with manual user_id filtering

### Rate Limiting

- [ ] **RATE-01**: API requests are rate limited per key using Upstash Redis sliding window
- [ ] **RATE-02**: Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) included in all responses
- [ ] **RATE-03**: Rate-limited requests return 429 with `Retry-After` header

### Credit Enforcement

- [ ] **CRED-01**: Credit-consuming endpoints (carousel generation, AI images) deduct via existing atomic RPC
- [ ] **CRED-02**: Insufficient credits return 402 with `x-credits-remaining` header
- [ ] **CRED-03**: All responses include `x-credits-remaining` and `x-credits-used` headers

### REST Endpoints

- [ ] **API-01**: `POST /api/v1/carousel` — Generate carousel from topic (1 credit)
- [ ] **API-02**: `GET /api/v1/templates` — List available templates
- [ ] **API-03**: `GET /api/v1/projects` — List user's projects
- [ ] **API-04**: `POST /api/v1/projects` — Create empty project
- [ ] **API-05**: `GET /api/v1/projects/{id}` — Get project with slides
- [ ] **API-06**: `DELETE /api/v1/projects/{id}` — Delete project
- [ ] **API-07**: `GET /api/v1/projects/{id}/slides/{index}` — Get single slide
- [ ] **API-08**: `PATCH /api/v1/projects/{id}/slides/{index}` — Update slide fields
- [ ] **API-09**: `POST /api/v1/projects/{id}/render` — Get download URLs for all slides
- [ ] **API-10**: `GET /api/v1/projects/{id}/download` — Download all slides as ZIP

### API Infrastructure

- [ ] **INFRA-01**: Structured JSON error responses with codes matching OpenAPI spec
- [ ] **INFRA-02**: CORS headers for cross-origin browser-based API consumers
- [ ] **INFRA-03**: Service extraction — shared logic between server actions and route handlers

## Future Requirements

### API Enhancements

- **APIX-01**: Scoped key permissions (read-only, generate-only)
- **APIX-02**: Test mode / sandbox environment
- **APIX-03**: API key rotation with grace period
- **APIX-04**: Official SDK packages (npm/pip)
- **APIX-05**: `GET /api/v1/projects/{id}/download/{index}` — Download single slide as PNG

## Out of Scope

| Feature | Reason |
|---------|--------|
| Scoped key permissions | 10-endpoint API doesn't need per-resource scopes yet |
| Test/sandbox mode | Free tier credits serve as sandbox |
| Key rotation with grace period | Manual create-new + delete-old sufficient at this scale |
| Official SDK packages | Defer until API surface stabilizes |
| Webhook notifications | No events to push yet |
| API usage analytics dashboard | Defer to later milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KEY-01 | Phase 22 | Pending |
| KEY-02 | Phase 22 | Pending |
| KEY-03 | Phase 22 | Pending |
| KEY-04 | Phase 22 | Pending |
| KEY-05 | Phase 22 | Pending |
| AUTH-01 | Phase 22 | Pending |
| AUTH-02 | Phase 22 | Pending |
| AUTH-03 | Phase 22 | Pending |
| AUTH-04 | Phase 22 | Pending |
| RATE-01 | Phase 23 | Pending |
| RATE-02 | Phase 23 | Pending |
| RATE-03 | Phase 23 | Pending |
| CRED-01 | Phase 23 | Pending |
| CRED-02 | Phase 23 | Pending |
| CRED-03 | Phase 23 | Pending |
| INFRA-01 | Phase 23 | Pending |
| INFRA-02 | Phase 23 | Pending |
| INFRA-03 | Phase 23 | Pending |
| API-01 | Phase 25 | Pending |
| API-02 | Phase 24 | Pending |
| API-03 | Phase 24 | Pending |
| API-04 | Phase 25 | Pending |
| API-05 | Phase 24 | Pending |
| API-06 | Phase 24 | Pending |
| API-07 | Phase 24 | Pending |
| API-08 | Phase 25 | Pending |
| API-09 | Phase 25 | Pending |
| API-10 | Phase 25 | Pending |

**Coverage:**
- v2.2 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
