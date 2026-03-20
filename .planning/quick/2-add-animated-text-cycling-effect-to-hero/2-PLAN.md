---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/landing/animated-word.tsx
  - src/app/page.tsx
autonomous: true
requirements: [QUICK-2]
must_haves:
  truths:
    - "Hero heading cycles through words with smooth vertical slide animation"
    - "Words rotate every 2 seconds automatically"
    - "Animation uses spring physics for natural motion"
  artifacts:
    - path: "src/components/landing/animated-word.tsx"
      provides: "Client component with animated word cycling"
      exports: ["AnimatedWord"]
    - path: "src/app/page.tsx"
      provides: "Updated hero using AnimatedWord component"
  key_links:
    - from: "src/app/page.tsx"
      to: "src/components/landing/animated-word.tsx"
      via: "import and render AnimatedWord"
      pattern: "AnimatedWord"
---

<objective>
Add an animated text cycling effect to the hero heading so the word "automated" cycles through multiple words with a smooth vertical slide animation.

Purpose: Makes the landing page hero more dynamic and engaging.
Output: AnimatedWord client component + updated page.tsx hero section.
</objective>

<execution_context>
@/Users/deeg/.claude/get-shit-done/workflows/execute-plan.md
@/Users/deeg/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/page.tsx
@src/components/landing/testimonials-columns.tsx (motion/react import pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create AnimatedWord client component</name>
  <files>src/components/landing/animated-word.tsx</files>
  <action>
Create a new client component at src/components/landing/animated-word.tsx:

- Add "use client" directive at top
- Import { motion, AnimatePresence } from "motion/react" (matches existing pattern in testimonials-columns.tsx)
- Import { useState, useEffect, useMemo } from "react"
- Create and export function AnimatedWord
- useMemo for words array: ["automated", "effortless", "intelligent", "instant", "seamless"]
- useState for titleNumber (index into words), initialized to 0
- useEffect with setInterval at 2000ms that increments titleNumber mod words.length, return cleanup
- Render structure:
  - Outer span with className "relative inline-flex overflow-hidden" and a non-breaking space for consistent height
  - Inside, use AnimatePresence mode="wait"
  - Render a motion.span keyed by titleNumber with:
    - className="italic absolute inset-0" (inherits font styling from parent h1)
    - initial={{ opacity: 0, y: -150 }}
    - animate={{ opacity: 1, y: 0 }}
    - exit={{ opacity: 0, y: 150 }}
    - transition={{ type: "spring", stiffness: 50 }}
    - Content: {words[titleNumber]}.  (append period after the word)
  </action>
  <verify>
    <automated>npx tsc --noEmit src/components/landing/animated-word.tsx 2>&1 | head -20</automated>
  </verify>
  <done>AnimatedWord component exists, exports correctly, no TypeScript errors</done>
</task>

<task type="auto">
  <name>Task 2: Wire AnimatedWord into hero heading</name>
  <files>src/app/page.tsx</files>
  <action>
Update src/app/page.tsx:

1. Add import at top: import { AnimatedWord } from '@/components/landing/animated-word'
2. On line 28, replace:
   `<span className="italic">automated.</span>`
   with:
   `<AnimatedWord />`

The page remains a server component (async function). AnimatedWord is a client component that renders within it -- this is standard Next.js composition.
  </action>
  <verify>
    <automated>npx tsc --noEmit src/app/page.tsx 2>&1 | head -20</automated>
  </verify>
  <done>Hero heading renders AnimatedWord component, page compiles without errors</done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- Landing page at / shows the hero heading with words cycling every 2 seconds
- Animation slides words vertically with spring physics
</verification>

<success_criteria>
Hero heading displays "The future of narrative is [word]." where [word] animates through: automated, effortless, intelligent, instant, seamless on a 2-second cycle with smooth vertical spring animation.
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-animated-text-cycling-effect-to-hero/2-SUMMARY.md`
</output>
