# Phase 3: Slide Editor - Research

**Researched:** 2026-03-19
**Domain:** Interactive slide editing, drag-and-drop reordering, undo/redo state management, image upload, Pexels search integration
**Confidence:** HIGH

## Summary

Phase 3 transforms the current read-only slide viewer into a full interactive editor. The existing codebase has a clean foundation: slides are stored as a JSONB array (`Slide[]`) in Supabase, rendered via CSS-based `SlidePreview` components, and the `SlideTemplate` system provides typed style properties. The editor needs to add: slide CRUD operations (add/remove/duplicate/reorder), inline text editing with font/color/position controls, image swapping via Pexels search and user upload, single-slide AI regeneration, undo/redo, and responsive layout for desktop/tablet.

The key architectural decision is managing editor state client-side with a `useReducer`-based approach that naturally supports undo/redo via a `past/present/future` history stack. All mutations happen in-memory first, then persist to Supabase on explicit save or auto-save. For drag-and-drop reordering, `@dnd-kit/core` + `@dnd-kit/sortable` is the standard choice -- mature, lightweight, React 19 compatible, and purpose-built for sortable lists. Image uploads should go through Supabase Storage with a server action creating a signed upload URL to bypass Next.js's 1MB body size limit.

**Primary recommendation:** Build the editor as a single client component tree with `useReducer` for state + undo/redo history, `@dnd-kit` for drag-and-drop, server actions for persistence and AI regeneration, and Supabase Storage for user image uploads.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | Add new slides to existing slideshow | Reducer action `ADD_SLIDE` inserting a blank slide into `Slide[]` array |
| EDIT-02 | Remove slides from slideshow | Reducer action `REMOVE_SLIDE` by index, with undo support |
| EDIT-03 | Reorder slides via drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` with `arrayMove` utility |
| EDIT-04 | Duplicate an existing slide | Reducer action `DUPLICATE_SLIDE` deep-cloning slide at index |
| EDIT-05 | Edit text overlay content | Controlled inputs bound to `hook_text` / `body_text` via reducer dispatch |
| EDIT-06 | Change text font size, color, position | Extend `Slide` type with per-slide style overrides; property panel UI |
| EDIT-07 | Search Pexels and swap background | Reuse existing `searchPhotos()` via server action; update `background_url` + `pexels_photo_id` |
| EDIT-08 | Upload own images as backgrounds | Supabase Storage bucket + signed upload URL pattern; update `background_url` |
| EDIT-09 | Undo and redo editing actions | `useReducer` with `past/present/future` history stack pattern |
| EDIT-10 | Preview all slides in sequence | Carousel/filmstrip view component cycling through slides |
| AIGEN-04 | Regenerate single slide text | Server action calling Gemini for one slide, updating only that slide's text fields |
| AIGEN-05 | Regenerate single slide image query | Server action calling Gemini for image query, then Pexels search for new background |
| UIUX-02 | Responsive on desktop and tablet | Responsive layout: sidebar editor panel on desktop, stacked on tablet |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 | Drag-and-drop engine | Lightweight (12KB gzip), React 16-19 compatible, accessible, 60fps |
| @dnd-kit/sortable | ^10.0.0 | Sortable list preset | Purpose-built for reordering lists, provides `useSortable` + `arrayMove` |
| @dnd-kit/utilities | ^3.2.2 | CSS transform helpers | `CSS.Transform.toString()` for smooth drag animations |
| React useReducer | built-in | State management + undo/redo | No extra dependency; natural fit for command-based undo/redo pattern |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @google/genai | ^1.46.0 | Single-slide text/query regeneration | AIGEN-04, AIGEN-05 |
| pexels | ^1.4.0 | Stock photo search for background swap | EDIT-07 |
| @supabase/supabase-js | ^2.99.3 | Storage upload, database persistence | EDIT-08, save actions |
| lucide-react | ^0.577.0 | Editor toolbar icons | All editor UI icons |
| zod | ^4.3.6 | Validation of slide data shapes | Validate on save |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | @hello-pangea/dnd | hello-pangea is higher-level but heavier; dnd-kit is more modular and better for grid layouts |
| useReducer undo/redo | zustand + temporal middleware | Adds dependency; useReducer is sufficient for single-component editor state |
| Supabase Storage | Cloudinary / S3 | Supabase already in stack; free tier is generous; no new service needed |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── editor/
│       ├── slide-editor.tsx        # Main editor shell (client component)
│       ├── slide-list.tsx          # Sortable slide thumbnail strip
│       ├── sortable-slide.tsx      # Individual draggable slide thumbnail
│       ├── slide-canvas.tsx        # Active slide large preview
│       ├── text-editor-panel.tsx   # Text content + style editing controls
│       ├── image-picker-panel.tsx  # Pexels search + upload UI
│       └── editor-toolbar.tsx      # Add/duplicate/delete/undo/redo buttons
├── lib/
│   ├── editor/
│   │   ├── use-slide-editor.ts     # useReducer hook with undo/redo history
│   │   ├── editor-actions.ts       # Action type definitions
│   │   └── editor-reducer.ts       # Pure reducer with history wrapper
│   └── types/
│       └── slide.ts                # Extended Slide type with style overrides
├── app/
│   └── (dashboard)/
│       └── project/
│           └── [id]/
│               ├── page.tsx        # Server component (fetches project, renders editor)
│               └── actions.ts      # Server actions (save, regenerate, upload URL)
```

### Pattern 1: Undo/Redo with useReducer
**What:** Wrap slide state in a `{ past: Slide[][], present: Slide[], future: Slide[][] }` structure
**When to use:** Any editor action that should be undoable

```typescript
// src/lib/editor/editor-reducer.ts
interface EditorHistory {
  past: Slide[][]
  present: Slide[]
  future: Slide[][]
}

type EditorAction =
  | { type: 'UPDATE_SLIDE'; index: number; updates: Partial<Slide> }
  | { type: 'ADD_SLIDE'; index: number }
  | { type: 'REMOVE_SLIDE'; index: number }
  | { type: 'DUPLICATE_SLIDE'; index: number }
  | { type: 'REORDER_SLIDES'; from: number; to: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_SLIDES'; slides: Slide[] } // For AI regeneration results

function editorReducer(state: EditorHistory, action: EditorAction): EditorHistory {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    }
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
    }
  }
  // All other actions: compute new present, push old to past, clear future
  const newPresent = applyAction(state.present, action)
  return {
    past: [...state.past, state.present],
    present: newPresent,
    future: [],
  }
}
```

### Pattern 2: Sortable Slide List with @dnd-kit
**What:** Drag-and-drop slide reordering in thumbnail strip
**When to use:** EDIT-03 slide reordering

```typescript
// src/components/editor/slide-list.tsx
'use client'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

function SlideList({ slides, onReorder, selectedIndex, onSelect }) {
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }, // Prevent accidental drags
  }))

  function handleDragEnd(event) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((_, i) => `slide-${i}` === active.id)
      const newIndex = slides.findIndex((_, i) => `slide-${i}` === over.id)
      onReorder(oldIndex, newIndex)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={slides.map((_, i) => `slide-${i}`)} strategy={verticalListSortingStrategy}>
        {slides.map((slide, i) => (
          <SortableSlide key={`slide-${i}`} id={`slide-${i}`} slide={slide} index={i} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
```

### Pattern 3: Signed Upload URL for Images
**What:** Create signed URL server-side, upload client-side directly to Supabase Storage
**When to use:** EDIT-08 user image uploads

```typescript
// Server action: create signed upload URL
'use server'
export async function createUploadUrl(projectId: string, fileName: string) {
  const supabase = await createClient()
  const path = `${projectId}/${Date.now()}-${fileName}`
  const { data, error } = await supabase.storage
    .from('slide-backgrounds')
    .createSignedUploadUrl(path)
  if (error) throw error
  return { signedUrl: data.signedUrl, path, publicUrl: supabase.storage.from('slide-backgrounds').getPublicUrl(path).data.publicUrl }
}

// Client: upload directly to Supabase Storage
async function handleUpload(file: File) {
  const { signedUrl, publicUrl } = await createUploadUrl(projectId, file.name)
  await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  dispatch({ type: 'UPDATE_SLIDE', index: selectedIndex, updates: { background_url: publicUrl } })
}
```

### Pattern 4: Single-Slide AI Regeneration
**What:** Regenerate text or image query for one slide without affecting others
**When to use:** AIGEN-04, AIGEN-05

```typescript
// Server action
'use server'
export async function regenerateSlideText(projectId: string, slideIndex: number, topic: string, currentSlide: Slide) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Rewrite this carousel slide about "${topic}". Current hook: "${currentSlide.hook_text}". Current body: "${currentSlide.body_text}". Generate a fresh alternative.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: singleSlideSchema,
    },
  })
  return JSON.parse(response.text!)
}
```

### Anti-Patterns to Avoid
- **Storing editor state in URL/searchParams:** Too much data for slide arrays; use client state with explicit save
- **Server-side state for every keystroke:** Latency kills UX; batch saves with debouncing
- **Using array index as sole drag-and-drop ID:** Indices shift during reorder; use stable IDs or index-prefixed strings within a single render
- **Direct Supabase calls from client components:** Always go through server actions for database writes to keep keys server-side
- **Unbounded undo history:** Cap `past` array at ~50 entries to prevent memory bloat

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom mouse/touch event handlers | @dnd-kit/sortable | Accessibility (keyboard, screen readers), touch support, animation, edge cases |
| Array reordering | Manual splice/index logic | `arrayMove` from @dnd-kit/sortable | Handles edge cases, immutable operation |
| Undo/redo state | Custom state tracking | useReducer + past/present/future pattern | Well-established pattern, trivial to implement correctly with reducer |
| Image upload to cloud | Custom multipart upload handling | Supabase Storage signed URLs | Handles auth, CORS, chunking, CDN |
| Stock photo search | Custom Pexels API wrapper | Existing `searchPhotos()` in project | Already built, tested, handles pagination |

**Key insight:** The editor's complexity is in state management and UX polish, not in novel algorithms. Lean on battle-tested libraries for interactions (drag-and-drop) and infrastructure (storage, AI), and focus engineering effort on the reducer logic and UI responsiveness.

## Common Pitfalls

### Pitfall 1: Slide Type Extension Breaking Existing Data
**What goes wrong:** Adding new fields to `Slide` type (e.g., `font_size`, `text_color`) breaks existing projects that don't have these fields.
**Why it happens:** Existing `slide_data` in Supabase won't have the new fields.
**How to avoid:** Make all new fields optional with sensible defaults. When loading slides, merge with defaults: `{ ...defaultSlideStyles, ...savedSlide }`.
**Warning signs:** TypeScript errors on accessing new properties from old data.

### Pitfall 2: Next.js Server Action Body Size Limit
**What goes wrong:** Image uploads via server action FormData fail for files > 1MB.
**Why it happens:** Next.js defaults `bodySizeLimit` to 1MB for server actions.
**How to avoid:** Use signed upload URLs -- server action creates the URL, client uploads directly to Supabase Storage, bypassing Next.js entirely.
**Warning signs:** 413 errors on file upload.

### Pitfall 3: Undo History Memory Bloat
**What goes wrong:** Storing full slide array copies in undo history consumes excessive memory.
**Why it happens:** Each undo step stores a deep copy of all slides.
**How to avoid:** Cap history at ~50 entries. For MVP, full copies are fine (slides are small JSON, typically < 10 slides). Only optimize with structural sharing if profiling shows issues.
**Warning signs:** Sluggish performance after many edits.

### Pitfall 4: Drag-and-Drop Conflicting with Click Selection
**What goes wrong:** Clicking a slide to select it triggers a drag instead.
**Why it happens:** PointerSensor activates on any pointer down.
**How to avoid:** Set `activationConstraint: { distance: 8 }` on PointerSensor so drag only starts after 8px of movement.
**Warning signs:** Can't select slides without accidentally dragging them.

### Pitfall 5: Race Conditions on Auto-Save
**What goes wrong:** Multiple rapid edits create overlapping save requests; older state overwrites newer state in database.
**Why it happens:** Debounced saves fire out of order.
**How to avoid:** Use a single debounced save function that always saves the latest state. Cancel pending saves before starting a new one. Consider optimistic UI with a "saving..." indicator.
**Warning signs:** Edits disappearing after page refresh.

### Pitfall 6: Stale Closure in Reducer Dispatch
**What goes wrong:** Callbacks capture old state when dispatching updates.
**Why it happens:** React closures capture state at render time.
**How to avoid:** Always dispatch actions with just the data needed (index, updates), never compute new state outside the reducer.
**Warning signs:** Edits reverting to old values randomly.

## Code Examples

### Extending the Slide Type
```typescript
// src/lib/types/slide.ts (extended)
export interface SlideStyleOverrides {
  hook_font_size?: number    // px, default from template
  body_font_size?: number    // px, default from template
  text_color?: string        // hex, default from template
  text_position?: 'top' | 'center' | 'bottom'  // default from template
}

export interface Slide {
  hook_text: string
  body_text: string
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  // New optional style overrides (Phase 3)
  style_overrides?: SlideStyleOverrides
}
```

### Debounced Auto-Save
```typescript
// In the editor component
const saveTimeoutRef = useRef<NodeJS.Timeout>()

useEffect(() => {
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
  saveTimeoutRef.current = setTimeout(async () => {
    await saveSlideData(projectId, slides)
    setLastSaved(new Date())
  }, 2000) // Save 2s after last edit
  return () => clearTimeout(saveTimeoutRef.current)
}, [slides, projectId])
```

### Pexels Search in Image Picker
```typescript
// Server action for searching Pexels (reuses existing utility)
'use server'
export async function searchBackgroundPhotos(query: string) {
  const photos = await searchPhotos(query, { orientation: 'portrait', per_page: 12 })
  return photos.map(p => ({
    id: p.id,
    url: p.src.portrait,
    thumbnail: p.src.small,
    photographer: p.photographer,
  }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit or @hello-pangea/dnd | 2022 (r-b-d deprecated) | Must use maintained fork or dnd-kit |
| Redux for undo/redo | useReducer + history pattern | React 16.8+ (hooks) | No external state library needed |
| Server-side file upload | Signed upload URLs | 2023+ | Bypasses Next.js body limits, faster uploads |
| @dnd-kit/core+sortable (v6/v10) | @dnd-kit/react (v0.3.x) | 2024 (new pkg) | New API exists but pre-1.0; stable packages still recommended |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Unmaintained since 2022, forked as `@hello-pangea/dnd`
- Direct FormData server action uploads for images: Hit 1MB limit; use signed URLs instead

## Open Questions

1. **Supabase Storage Bucket Setup**
   - What we know: Need a `slide-backgrounds` bucket for user uploads
   - What's unclear: Whether the bucket already exists or needs creation via migration
   - Recommendation: Create bucket in Wave 0 setup task; add RLS policy scoped to authenticated users

2. **Per-Slide Style Overrides Granularity**
   - What we know: EDIT-06 requires font size, color, and position editing
   - What's unclear: Whether overrides apply to hook_text and body_text independently or together
   - Recommendation: Keep it simple -- one set of overrides per slide. Hook and body can share color/position but have independent font sizes.

3. **Slide Preview Sequencing (EDIT-10)**
   - What we know: Need to preview "all slides in sequence"
   - What's unclear: Auto-play slideshow vs manual navigation
   - Recommendation: Manual carousel navigation with optional auto-play; simple arrow buttons cycling through full-size previews

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (exists, jsdom environment) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Add slide inserts at correct position | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "ADD_SLIDE" -x` | Wave 0 |
| EDIT-02 | Remove slide removes correct index | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "REMOVE_SLIDE" -x` | Wave 0 |
| EDIT-03 | Reorder slides via drag produces correct order | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "REORDER" -x` | Wave 0 |
| EDIT-04 | Duplicate slide creates deep copy | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "DUPLICATE" -x` | Wave 0 |
| EDIT-05 | Update slide text fields | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "UPDATE_SLIDE" -x` | Wave 0 |
| EDIT-06 | Style overrides merge with template defaults | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "style" -x` | Wave 0 |
| EDIT-07 | Pexels search returns formatted results | unit | `npx vitest run src/__tests__/editor/image-search.test.ts -x` | Wave 0 |
| EDIT-08 | Upload URL creation returns valid signed URL | unit | `npx vitest run src/__tests__/editor/upload.test.ts -x` | Wave 0 |
| EDIT-09 | Undo restores previous state, redo restores future | unit | `npx vitest run src/__tests__/editor/reducer.test.ts -t "UNDO" -x` | Wave 0 |
| EDIT-10 | Slide preview renders all slides | integration | `npx vitest run src/__tests__/editor/slide-preview.test.tsx -x` | Wave 0 |
| AIGEN-04 | Regenerate text returns new content for single slide | unit | `npx vitest run src/__tests__/editor/regenerate.test.ts -t "text" -x` | Wave 0 |
| AIGEN-05 | Regenerate image query returns new query + fetches photo | unit | `npx vitest run src/__tests__/editor/regenerate.test.ts -t "image" -x` | Wave 0 |
| UIUX-02 | Editor layout responsive classes present | integration | `npx vitest run src/__tests__/editor/responsive.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/editor/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/editor/reducer.test.ts` -- covers EDIT-01 through EDIT-06, EDIT-09
- [ ] `src/__tests__/editor/image-search.test.ts` -- covers EDIT-07
- [ ] `src/__tests__/editor/upload.test.ts` -- covers EDIT-08
- [ ] `src/__tests__/editor/regenerate.test.ts` -- covers AIGEN-04, AIGEN-05
- [ ] `src/__tests__/editor/slide-preview.test.tsx` -- covers EDIT-10
- [ ] `src/__tests__/editor/responsive.test.tsx` -- covers UIUX-02
- [ ] Framework install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] Supabase Storage bucket `slide-backgrounds` creation

## Sources

### Primary (HIGH confidence)
- npm registry -- verified `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/react` 0.3.2 versions and peer dependencies
- npm registry -- verified `@hello-pangea/dnd` 18.0.1 supports React 19
- Project codebase -- `Slide` type, `SlideTemplate` interface, `searchPhotos()`, `generateSlideContent()`, project page structure

### Secondary (MEDIUM confidence)
- [dnd-kit official docs](https://dndkit.com/presets/sortable) -- sortable list setup pattern, `arrayMove`, `useSortable` API
- [Redux docs undo/redo pattern](https://redux.js.org/usage/implementing-undo-history) -- past/present/future history pattern (adapted for useReducer)
- [Supabase Storage signed URL docs](https://supabase.com/docs/reference/javascript/v1/storage-from-upload) -- upload pattern for Next.js

### Tertiary (LOW confidence)
- [WebSearch: Supabase signed URL upload pattern](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0) -- confirms signed URL approach bypasses Next.js body limits

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - libraries verified via npm, peer deps confirmed for React 19
- Architecture: HIGH - patterns are well-established (useReducer undo/redo, dnd-kit sortable)
- Pitfalls: HIGH - based on known Next.js limitations and common React state management issues

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, slow-moving libraries)
