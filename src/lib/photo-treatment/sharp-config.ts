// Phase 54 (D-04, TREAT-03): sharp memory configuration. Must be imported
// FIRST by every module that uses sharp, before any sharp() call. Disables
// sharp's libvips cache + pins concurrency to 1 — prevents serverless
// memory fragmentation and OOM kills on Vercel hot lambdas (Pitfall #5,
// sharp issue #3052).
import sharp from 'sharp'

sharp.cache(false)
sharp.concurrency(1)

export { sharp }
