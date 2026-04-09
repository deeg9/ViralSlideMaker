import { describe, it, expect } from 'vitest'
import { corsHeaders } from '@/lib/api/cors'

describe('corsHeaders', () => {
  it('returns object with Access-Control-Allow-Origin: *', () => {
    const headers = corsHeaders()
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
  })

  it('includes Access-Control-Allow-Methods with GET, POST, PATCH, DELETE, OPTIONS', () => {
    const headers = corsHeaders()
    const methods = headers['Access-Control-Allow-Methods']
    expect(methods).toContain('GET')
    expect(methods).toContain('POST')
    expect(methods).toContain('PATCH')
    expect(methods).toContain('DELETE')
    expect(methods).toContain('OPTIONS')
  })

  it('includes Access-Control-Allow-Headers with Authorization, Content-Type', () => {
    const headers = corsHeaders()
    const allowHeaders = headers['Access-Control-Allow-Headers']
    expect(allowHeaders).toContain('Authorization')
    expect(allowHeaders).toContain('Content-Type')
  })

  it('includes Access-Control-Expose-Headers listing custom headers', () => {
    const headers = corsHeaders()
    const exposed = headers['Access-Control-Expose-Headers']
    expect(exposed).toContain('X-RateLimit-Limit')
    expect(exposed).toContain('X-RateLimit-Remaining')
    expect(exposed).toContain('x-credits-remaining')
    expect(exposed).toContain('x-credits-used')
    expect(exposed).toContain('Retry-After')
  })
})
