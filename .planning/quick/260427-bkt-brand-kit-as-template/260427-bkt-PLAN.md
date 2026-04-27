---
phase: 260427-bkt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260427_brand_kit_template.sql
  - src/lib/types/brand-kit.ts
  - src/lib/brand-kit/get-effective-template.ts
  - src/lib/render/templates/index.ts
  - src/lib/render/render-slide-satori.tsx
  - src/components/slides/slide-preview.tsx
  - src/components/slides/template-picker.tsx
  - src/components/slides/generation-form.tsx
  - src/app/(dashboard)/project/[id]/page.tsx
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/components/editor/slide-editor.tsx
  - src/components/brand-kit/brand-kit-form.tsx
  - src/app/(dashboard)/settings/brand-kit/actions.ts
autonomous: true
requirements:
  - QUICK-260427-bkt
must_haves:
  truths:
    - "Brand kit data model supports heading_font_family, body_font_family, accent_color, text_align, text_position, hook_style, overlay_opacity_pct"
    - "Brand kit form lets the user edit all new fields with live SlidePreview preview"
    - "Template picker shows 'Your Brand Kit' as the FIRST tile when user has a brand kit"
    - "Template picker shows 'Build your brand kit' empty-state tile when user has no brand kit configured"
    - "Picking the brand-kit template generates slides using brand-kit values"
    - "Per-slide PNG and ZIP exports honor template_id='brand-kit' on the server"
    - "Editor preview honors template_id='brand-kit'"
    - "Existing built-in templates render unchanged"
  artifacts:
    - path: src/lib/brand-kit/get-effective-template.ts
      provides: synthesizeBrandKitTemplate + BRAND_KIT_TEMPLATE_ID
      contains: synthesizeBrandKitTemplate
    - path: supabase/migrations/20260427_brand_kit_template.sql
      provides: 7 new columns + 4 CHECK constraints + backfill
      contains: heading_font_family
---

<objective>
Make brand kit a first-class selectable template in the visual-style picker AND expand the brand-kit data model + form so users can lock down their full visual identity (font pairings, accent, alignment, position, hook style, overlay opacity).
</objective>
