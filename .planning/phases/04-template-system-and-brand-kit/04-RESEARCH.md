# Phase 4: Template System and Brand Kit - Research

**Researched:** 2026-03-19
**Domain:** Template switching, brand kit persistence, Supabase schema design
**Confidence:** HIGH

## Summary

Phase 4 is a small, well-scoped phase with 3 requirements. The existing codebase already has strong template infrastructure: 5 templates as typed CSS property objects, a `getTemplate()` lookup, `buildSlideHtml()` for server rendering, and `SlidePreview` for client-side WYSIWYG previews. The `SlideEditor` currently receives `templateId` as a prop from the server and calls `getTemplate()` once -- it does NOT support switching templates after mount.

The work breaks into two distinct features: (1) post-generation template switching (TMPL-03), which requires making `templateId` mutable state in the editor and persisting changes, and (2) brand kit (TMPL-04 + TMPL-05), which requires a new `brand_kits` DB table, a settings UI, and integration into the generation flow. Both features are straightforward extensions of existing patterns.

**Primary recommendation:** Add template switching as local state in `SlideEditor` with a server action to persist, and create a `brand_kits` table with RLS that auto-applies during carousel generation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-03 | User can switch templates after generation and slides re-render in the new style | Editor already renders via `getTemplate(templateId)` -- make `templateId` mutable state, add TemplatePicker to editor, persist via server action |
| TMPL-04 | User can save a brand kit (custom colors, fonts, logo) to their account | New `brand_kits` table in Supabase with RLS, new settings page at `/settings/brand-kit`, logo upload to existing Supabase Storage |
| TMPL-05 | Brand kit settings apply automatically when generating new slideshows | Modify `generateCarousel` action to fetch user's brand kit, merge brand kit overrides into template before rendering |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.13 | App Router, server actions, server components | Project framework |
| @supabase/ssr + supabase-js | 0.9.0 / 2.99.3 | DB, auth, storage, RLS | Project database |
| Tailwind CSS | 4.x | Styling | Project styling |
| Vitest | 4.1.0 | Testing | Project test framework |

### Supporting (no new dependencies needed)
This phase requires NO new npm packages. Everything needed is already in the project:
- `TemplatePicker` component exists
- Supabase client utilities exist (`createClient` for server/client)
- Supabase Storage bucket `slide-backgrounds` already configured (reuse pattern for logo uploads)
- `revalidatePath` for cache invalidation after updates

## Architecture Patterns

### TMPL-03: Post-Generation Template Switching

**Current flow (immutable):**
```
ProjectPage (server) --> reads project.template_id --> passes to SlideEditor
SlideEditor --> calls getTemplate(templateId) ONCE --> passes template to all children
```

**New flow (mutable):**
```
SlideEditor --> useState(templateId) --> getTemplate(currentTemplateId)
  TemplatePicker in editor toolbar/sidebar --> onSelect updates state
  State change --> all SlidePreview/SlideList/SlideCanvas re-render with new template
  Persist --> server action updates projects.template_id
```

**Key insight:** Because `getTemplate()` returns a `SlideTemplate` object and all preview components accept `template` as a prop, switching templates is purely a matter of changing the `templateId` state. No slide data changes -- templates are applied at render time, not stored in slide_data. Per-slide `style_overrides` (font_size, text_color, text_position) are preserved and continue to override template defaults.

**Implementation pattern:**
```typescript
// In SlideEditor: make templateId mutable
const [currentTemplateId, setCurrentTemplateId] = useState(templateId)
const template = getTemplate(currentTemplateId)

// Add template picker to editor UI (e.g., in toolbar or as a panel)
// On template change: update state + persist to DB
async function handleTemplateChange(newId: string) {
  setCurrentTemplateId(newId)
  await saveTemplateId(projectId, newId) // new server action
}
```

**Server action for template persistence:**
```typescript
// In editor-actions.ts
export async function saveTemplateId(projectId: string, templateId: string) {
  const supabase = await createClient()
  await supabase.from('projects').update({ template_id: templateId }).eq('id', projectId)
  revalidatePath(`/project/${projectId}`)
}
```

### TMPL-04: Brand Kit Database Schema

**New table: `brand_kits`**
```sql
CREATE TABLE brand_kits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'My Brand',
  primary_color text,        -- hex color e.g. '#FF5733'
  secondary_color text,      -- hex color
  text_color text,           -- hex color
  background_color text,     -- hex color
  font_family text,          -- Google Font name e.g. 'Playfair Display'
  logo_url text,             -- Supabase Storage public URL
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)            -- one brand kit per user for v1
);

-- RLS policies (match existing projects pattern)
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand kit"
  ON brand_kits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brand kit"
  ON brand_kits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brand kit"
  ON brand_kits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brand kit"
  ON brand_kits FOR DELETE USING (auth.uid() = user_id);
```

**Design decisions:**
- One brand kit per user (UNIQUE constraint on user_id) -- simplest for v1, matches requirements
- All fields nullable except user_id and name -- users fill in what they want
- Logo stored in Supabase Storage, URL saved in table (same pattern as slide-backgrounds)
- `font_family` is a string matching Google Fonts names (same as template `fontFamily`)

### TMPL-05: Brand Kit Auto-Apply During Generation

**Integration point:** The `generateCarousel` server action in `actions.ts` already receives `templateId`. After generation, brand kit overrides should be applied to the template before slides are rendered.

**Pattern:**
```typescript
// In generateCarousel or a helper:
async function getEffectiveTemplate(templateId: string, userId: string): Promise<SlideTemplate> {
  const base = getTemplate(templateId)
  const supabase = await createClient()
  const { data: brandKit } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!brandKit) return base

  // Merge brand kit overrides onto template
  return {
    ...base,
    ...(brandKit.text_color && { textColor: brandKit.text_color }),
    ...(brandKit.background_color && { backgroundColor: brandKit.background_color }),
    ...(brandKit.font_family && { fontFamily: `'${brandKit.font_family}', sans-serif` }),
    // primary_color and secondary_color can map to overlayColor or other template props
  }
}
```

**Where brand kit applies:**
1. **New generation:** When `generateCarousel` runs, fetch brand kit and save overrides. The template_id still controls the base layout; brand kit overrides colors/fonts.
2. **Editor preview:** When loading the editor, fetch brand kit and apply to template before passing to components.
3. **Server-side render (PNG export):** The render API route already uses `getTemplate()` -- it should also apply brand kit if the user has one.

### Brand Kit Settings Page

**Route:** `/settings/brand-kit` (new page under dashboard layout)

**UI components needed:**
- Color pickers for primary, secondary, text, and background colors
- Font family selector (dropdown of Google Fonts or text input)
- Logo upload (reuse existing Supabase Storage upload pattern from `createUploadUrl`)
- Save button with server action
- Preview showing how brand kit looks on a sample slide

### Recommended File Structure (new files only)
```
src/
  app/(dashboard)/
    settings/
      brand-kit/
        page.tsx          # Brand kit settings page (server component)
        actions.ts        # Server actions: saveBrandKit, deleteBrandKit, uploadLogo
  components/
    brand-kit/
      brand-kit-form.tsx  # Client component: color/font/logo form
  lib/
    types/
      brand-kit.ts        # BrandKit interface
    brand-kit/
      get-effective-template.ts  # Merge brand kit onto SlideTemplate
supabase/
  migrations/
    003_create_brand_kits.sql  # New migration
```

### Anti-Patterns to Avoid
- **Storing brand kit in template objects:** Brand kit is user data, templates are app data. Keep them separate and merge at runtime.
- **Duplicating template data in slide_data:** Template and brand kit are applied at render time. Slide data should NOT bake in resolved styles -- only `style_overrides` for per-slide user customization.
- **Complex font management:** For v1, use Google Fonts font names as strings. No need for font file uploads or custom font management.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color picker UI | Custom color picker component | HTML `<input type="color">` + text input for hex | Native color picker works everywhere, hex input for precision |
| Font loading in previews | Custom font loader | Google Fonts `<link>` tag in `buildSlideHtml` (already exists) | Google Fonts handles loading, caching, and fallbacks |
| Logo file upload | Custom upload endpoint | Supabase Storage + `createSignedUploadUrl` (existing pattern) | Same pattern already working for slide backgrounds |
| Database migrations | Manual SQL via Supabase dashboard | Migration file in `supabase/migrations/` | Existing project pattern, version controlled |

## Common Pitfalls

### Pitfall 1: Template Switch Not Re-rendering Server-Rendered PNGs
**What goes wrong:** User switches template in editor, previews update (CSS), but downloaded PNGs still use old template because render API caches or uses stale template_id.
**Why it happens:** The render API route reads `template_id` from the project DB row. If the template switch server action hasn't completed before download is triggered, PNGs render with old template.
**How to avoid:** Ensure `saveTemplateId` completes and revalidates before download. The render API already reads template_id from DB per-request, so once saved, subsequent renders use the new template.

### Pitfall 2: Brand Kit Overrides vs Style Overrides Conflict
**What goes wrong:** User has brand kit with text_color=#FF0000, but also has per-slide style_overrides with text_color=#0000FF. Which wins?
**How to avoid:** Establish clear precedence: per-slide style_overrides > brand kit > template defaults. The existing `buildSlideHtml` already handles style_overrides over template; brand kit sits in the middle.
**Resolution order:** `template defaults --> brand kit overrides --> per-slide style_overrides`

### Pitfall 3: Logo Rendering in Slides
**What goes wrong:** Logo URL from Supabase Storage doesn't load in server-side Puppeteer rendering because of CORS or network issues.
**How to avoid:** Use public URLs from Supabase Storage (same approach as background images). The `buildSlideHtml` function already handles external image URLs. Add logo as an `<img>` element positioned in a corner.

### Pitfall 4: Google Fonts Not Loading for Custom Font Family
**What goes wrong:** User picks a font in brand kit, but it doesn't render because the Google Fonts `<link>` tag only loads Inter currently.
**How to avoid:** Dynamically generate the Google Fonts URL in `buildSlideHtml` based on the effective template's `fontFamily`. Parse the font name and add it to the link tag.

## Code Examples

### Template Switch in Editor (client-side)
```typescript
// SlideEditor modification
const [currentTemplateId, setCurrentTemplateId] = useState(templateId)
const template = getTemplate(currentTemplateId)

// Template picker callback
async function handleTemplateChange(newId: string) {
  setCurrentTemplateId(newId)
  // Optimistic: UI updates immediately via state
  // Persist in background
  await saveTemplateId(projectId, newId)
}
```

### Brand Kit Type
```typescript
export interface BrandKit {
  id: string
  user_id: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  text_color: string | null
  background_color: string | null
  font_family: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}
```

### Migration SQL
```sql
CREATE TABLE brand_kits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'My Brand',
  primary_color text,
  secondary_color text,
  text_color text,
  background_color text,
  font_family text,
  logo_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand kit" ON brand_kits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brand kit" ON brand_kits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brand kit" ON brand_kits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brand kit" ON brand_kits FOR DELETE USING (auth.uid() = user_id);
```

### Effective Template Merge
```typescript
export function mergeWithBrandKit(
  template: SlideTemplate,
  brandKit: BrandKit | null
): SlideTemplate {
  if (!brandKit) return template
  return {
    ...template,
    ...(brandKit.text_color && { textColor: brandKit.text_color }),
    ...(brandKit.background_color && { backgroundColor: brandKit.background_color }),
    ...(brandKit.font_family && { fontFamily: `'${brandKit.font_family}', sans-serif` }),
    ...(brandKit.primary_color && { overlayColor: brandKit.primary_color }),
  }
}
```

### Dynamic Google Fonts Loading
```typescript
// In buildSlideHtml, replace static Inter link with dynamic:
function getFontLink(fontFamily: string): string {
  // Extract font name from CSS font-family string
  const match = fontFamily.match(/'([^']+)'/)
  const fontName = match ? match[1] : 'Inter'
  const encoded = fontName.replace(/\s+/g, '+')
  return `<link href="https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700;900&display=swap" rel="stylesheet">`
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Templates baked into slide data | Templates applied at render time | Phase 2 design decision | Enables template switching without data migration |
| Static template_id from server | (Phase 4) Mutable templateId in editor state | This phase | Allows post-generation switching |

## Open Questions

1. **Logo positioning in slides**
   - What we know: Logo needs to appear on slides when brand kit has one
   - What's unclear: Where exactly should the logo be placed (corner? which one? what size?)
   - Recommendation: Default to bottom-right corner, small (80x80px area), with opacity. Can be refined later.

2. **Font picker UX**
   - What we know: Brand kit needs a font_family field
   - What's unclear: Should we show a curated list of Google Fonts or allow free text input?
   - Recommendation: Curated list of 15-20 popular Google Fonts in a dropdown. Simpler UX, guaranteed to work with Google Fonts CDN.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-03 | Template switching re-renders slides | unit | `npx vitest run src/__tests__/editor/template-switch.test.ts -x` | No -- Wave 0 |
| TMPL-03 | saveTemplateId persists to DB | unit | `npx vitest run src/__tests__/editor/template-switch.test.ts -x` | No -- Wave 0 |
| TMPL-04 | Brand kit CRUD operations | unit | `npx vitest run src/__tests__/brand-kit/crud.test.ts -x` | No -- Wave 0 |
| TMPL-04 | Brand kit form renders and submits | unit | `npx vitest run src/__tests__/brand-kit/form.test.tsx -x` | No -- Wave 0 |
| TMPL-05 | Brand kit merges onto template | unit | `npx vitest run src/__tests__/brand-kit/merge.test.ts -x` | No -- Wave 0 |
| TMPL-05 | Generation uses brand kit when present | unit | `npx vitest run src/__tests__/brand-kit/generation.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/editor/template-switch.test.ts` -- covers TMPL-03
- [ ] `src/__tests__/brand-kit/crud.test.ts` -- covers TMPL-04 server actions
- [ ] `src/__tests__/brand-kit/form.test.tsx` -- covers TMPL-04 UI
- [ ] `src/__tests__/brand-kit/merge.test.ts` -- covers TMPL-05 merge logic
- [ ] `src/__tests__/brand-kit/generation.test.ts` -- covers TMPL-05 auto-apply

## Sources

### Primary (HIGH confidence)
- Project codebase direct inspection -- all template, rendering, editor, and DB code reviewed
- `src/lib/render/templates/index.ts` -- SlideTemplate interface and getTemplate()
- `src/lib/render/render-slide.ts` -- buildSlideHtml() HTML generation
- `src/components/editor/slide-editor.tsx` -- editor component structure
- `src/app/(dashboard)/project/[id]/actions.ts` -- generation flow
- `src/app/(dashboard)/project/[id]/editor-actions.ts` -- save/update patterns
- `supabase/migrations/002_add_template_and_topic.sql` -- existing migration pattern

### Secondary (MEDIUM confidence)
- Google Fonts dynamic loading pattern -- well-established, widely documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, fully understood existing codebase
- Architecture: HIGH - extending established patterns (templates, server actions, Supabase RLS)
- Pitfalls: HIGH - identified from direct code analysis of rendering and override systems

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no external dependency changes expected)
