// Phase 88 (WIRE-05): the fork route inherits the source published carousel's
// template_id instead of hardcoding a template.
//
// Until Phase 88 the fork route at src/app/api/v1/explore/[slug]/fork/route.ts
// hardcoded `template_id: 'highlight-bar'` in the projects INSERT — so a DB
// template (or any non-default) carousel forked into the wrong look. This
// suite pins the contract: the captured INSERT payload's template_id must be
// the source row's template_id, with a 'bold-minimal' COALESCE-style fallback
// for legacy rows where the column is NULL (matching the
// fork_published_carousel RPC).
//
// Strategy: mock `@/lib/api/with-api-auth` so `withApiAuth(handler)` returns a
// thin wrapper that invokes the handler with an injected ctx carrying a
// hand-rolled chainable Supabase stub. The stub resolves the fixture published
// row and CAPTURES the `projects` INSERT payload.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Captured INSERT payload for the `projects` table — populated by the stub.
let capturedProjectInsert: Record<string, unknown> | null = null
// The fixture published row the stub resolves for `published_carousels`.
let publishedFixture: Record<string, unknown> = {}

// A chainable query-builder stub. `.from('projects').insert(p)...` captures p;
// `.from('published_carousels').select(...)...maybeSingle()` resolves the
// fixture; `.update(...)` is a no-op resolve.
function makeSupabaseStub() {
  return {
    from(table: string) {
      if (table === 'projects') {
        return {
          insert(payload: Record<string, unknown>) {
            capturedProjectInsert = payload
            return {
              select() {
                return {
                  single: async () => ({
                    data: { id: 'new-project-id' },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }
      // published_carousels
      return {
        select() {
          return {
            eq() {
              return {
                is() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: publishedFixture,
                          error: null,
                        }),
                      }
                    },
                  }
                },
              }
            },
          }
        },
        update() {
          return {
            eq: async () => ({ data: null, error: null }),
          }
        },
      }
    },
  }
}

// withApiAuth(handler) -> a wrapper that calls handler(req, injected ctx).
vi.mock('@/lib/api/with-api-auth', () => ({
  withApiAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => {
    return async (req: unknown) =>
      handler(req, {
        userId: 'forker-user-id',
        keyId: 'key-id',
        supabase: makeSupabaseStub(),
        creditBalance: 100,
      })
  },
}))

// Import AFTER the mock so the route's `withApiAuth` resolves to the stub.
import { POST } from '@/app/api/v1/explore/[slug]/fork/route'

function makeRequest(): { url: string } {
  // The route's extractSlug() reads URL.pathname segment [4].
  return { url: 'https://app.test/api/v1/explore/some-slug/fork' }
}

beforeEach(() => {
  capturedProjectInsert = null
  publishedFixture = {}
})

describe('Phase 88 WIRE-05: fork route inherits the source carousel template_id', () => {
  it('inherits a non-default code template_id into the projects insert', async () => {
    publishedFixture = {
      id: 'pub-1',
      title: 'Source Carousel',
      description: null,
      slide_data: [],
      remix_count: 3,
      template_id: 'magazine-bold',
    }
    await POST(makeRequest() as never)
    expect(capturedProjectInsert).not.toBeNull()
    expect(capturedProjectInsert?.template_id).toBe('magazine-bold')
    expect(capturedProjectInsert?.template_id).not.toBe('highlight-bar')
  })

  it('inherits a DB template id verbatim', async () => {
    publishedFixture = {
      id: 'pub-2',
      title: 'DB Template Carousel',
      description: null,
      slide_data: [],
      remix_count: 0,
      template_id: 'db-some-uuid-1234',
    }
    await POST(makeRequest() as never)
    expect(capturedProjectInsert?.template_id).toBe('db-some-uuid-1234')
  })

  it('falls back to bold-minimal when the source template_id is NULL', async () => {
    publishedFixture = {
      id: 'pub-3',
      title: 'Legacy Carousel',
      description: null,
      slide_data: [],
      remix_count: 1,
      template_id: null,
    }
    await POST(makeRequest() as never)
    expect(capturedProjectInsert?.template_id).toBe('bold-minimal')
  })
})
