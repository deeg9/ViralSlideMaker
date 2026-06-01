import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Guard: jsdom (and SSR) do not implement matchMedia. Falling back to
    // `false` (no match) keeps consumers on their default branch — e.g. the
    // slide editor renders its desktop layout in tests, byte-identical to
    // before this hook was introduced there.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [query])

  return matches
}
