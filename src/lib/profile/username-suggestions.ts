export function suggestFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const cleaned = local
    .toLowerCase()
    .replace(/\+.*$/, '')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/^[._]+|[._]+$/g, '')
    .replace(/[._]{2,}/g, '_')
    .slice(0, 24)
  if (cleaned.length >= 3) return cleaned
  return `${cleaned}user`.slice(0, 24)
}

export function suffixedSuggestions(base: string, count = 3): string[] {
  const trimmed = base.replace(/[._]+$/, '').slice(0, 21)
  return Array.from({ length: count }, () => {
    const n = Math.floor(Math.random() * 900 + 100)
    return `${trimmed}${n}`
  })
}
