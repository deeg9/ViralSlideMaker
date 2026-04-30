import { describe, test, expect } from 'vitest'
import { readableTextColor } from '@/lib/color/readable-text-color'

describe('readableTextColor', () => {
  test('returns white for the brand-dark primary', () => {
    expect(readableTextColor('#3d0000')).toBe('#fff')
  })

  test('returns black for bright yellows and limes', () => {
    expect(readableTextColor('#ffeb3b')).toBe('#000')
    expect(readableTextColor('#cddc39')).toBe('#000')
  })

  test('returns white for full black, black for full white', () => {
    expect(readableTextColor('#000000')).toBe('#fff')
    expect(readableTextColor('#ffffff')).toBe('#000')
  })

  test('accepts 3-digit hex shorthand', () => {
    expect(readableTextColor('#fff')).toBe('#000')
    expect(readableTextColor('#000')).toBe('#fff')
  })

  test('accepts 8-digit hex (alpha channel ignored)', () => {
    // #3d0000 with arbitrary alpha — base luminance unchanged.
    expect(readableTextColor('#3d000099')).toBe('#fff')
  })

  test('falls back to white on unparseable input', () => {
    expect(readableTextColor('not-a-color')).toBe('#fff')
    expect(readableTextColor('')).toBe('#fff')
  })
})
