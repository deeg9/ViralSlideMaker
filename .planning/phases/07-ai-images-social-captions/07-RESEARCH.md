# Phase 7: AI Images & Social Captions - Research

**Researched:** 2026-03-25
**Domain:** AI image generation (Google Imagen), social media caption generation (Gemini), editor integration
**Confidence:** HIGH

## Summary

Phase 7 integrates two AI features into the existing carousel editor: (1) Google Imagen 4 Fast for generating AI slide backgrounds, gated behind the credit system built in Phase 5, and (2) Gemini 2.5 Flash-powered social media caption generation. Both features use the already-installed `@google/genai` SDK (v1.46.0) -- zero new npm dependencies are needed.

The Imagen integration is the higher-complexity feature. It requires a new "AI Generate" tab in the existing image picker panel, a server action that performs atomic credit deduction before calling the Imagen API, upload of generated images to the existing `slide-backgrounds` Supabase Storage bucket, and proper handling of safety filter rejections (refund credits when Imagen blocks a prompt). The SDK's `ai.models.generateImages()` method is confirmed to work with the same `GEMINI_API_KEY` already in use for Gemini text generation -- no separate Google Cloud project or Vertex AI setup is required.

Caption generation is straightforward: a new server action calls Gemini 2.5 Flash with structured JSON output (same pattern as the existing `generateSlideContent`), producing platform-specific captions for TikTok, Instagram, and LinkedIn from actual slide content. No credits are consumed, no database writes occur, and the UI is a simple panel with copy-to-clipboard buttons.

**Primary recommendation:** Build Imagen integration first (it is the premium feature gated behind credits), then caption generation second (simpler, no billing dependency). Reuse the existing `slide-backgrounds` Supabase Storage bucket for Imagen-generated images.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMAGEN-01 | User can generate AI slide backgrounds via Google Imagen 4 Fast | `ai.models.generateImages()` on existing `@google/genai` SDK, same `GEMINI_API_KEY`, native 9:16 aspect ratio support |
| IMAGEN-02 | Imagen prompts auto-generate from slide content (hook, body, topic) | Use Gemini 2.5 Flash to generate descriptive image prompts from slide text -- same structured output pattern as existing `regenerateSlideText` |
| IMAGEN-03 | Free users see "Upgrade to AI" button as upsell | Existing `UpgradePrompt` component with `feature_gate` context + `getUserTier()` check |
| IMAGEN-04 | User can preview and edit auto-generated prompt before spending credit | UI shows editable textarea with auto-generated prompt; credit deduction happens only on "Generate" click |
| CAPTION-01 | User can generate captions for TikTok, Instagram, LinkedIn | Gemini 2.5 Flash structured output with platform-specific schemas; no credits consumed |
| CAPTION-02 | Captions reference actual slide content, not just topic | Server action fetches full `slide_data` and passes hook texts, body texts, and CTA to the prompt |
</phase_requirements>

## Standard Stack

### Core (already installed -- zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.46.0 | Imagen 4 Fast image generation + Gemini 2.5 Flash captions | Already installed, unified SDK for all Google GenAI models |
| `@supabase/supabase-js` | 2.99.3 | Storage upload for generated images, credit deduction via RPC | Already installed, existing `slide-backgrounds` bucket |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | (installed) | Validate caption output schema | For type-safe parsing of Gemini caption responses |
| Supabase Admin Client | via `createAdminClient()` | Service-role writes for credit refunds | When Imagen fails and credit needs refunding |

### No Alternatives Needed

This phase adds zero npm packages. Everything uses the existing SDK.

**Installation:**
```bash
# Nothing to install. All dependencies are already present.
```

## Architecture Patterns

### Recommended New Files

```
src/
├── lib/
│   ├── imagen/
│   │   └── generate-image.ts         # Imagen API wrapper with credit deduction + refund
│   └── captions/
│       └── generate-captions.ts       # Gemini caption generation with structured output
├── components/
│   ├── editor/
│   │   └── image-picker-panel.tsx     # MODIFY: add "AI Generate" tab
│   └── captions/
│       └── caption-panel.tsx          # NEW: caption generation UI with copy buttons
├── app/(dashboard)/project/[id]/
│   ├── editor-actions.ts             # MODIFY: add generateAIImage server action
│   └── caption-actions.ts            # NEW: server action for caption generation
```

### Pattern 1: Imagen Generation with Pre-Deduction and Refund

**What:** Deduct credit atomically BEFORE calling Imagen API. If Imagen fails or safety filter blocks, insert a refund credit transaction.

**When to use:** Every Imagen generation call.

**Example:**
```typescript
// Source: @google/genai SDK types + existing deductCredit pattern
import { GoogleGenAI } from '@google/genai'
import { deductCredit } from '@/lib/credits/check-credits'
import { createAdminClient } from '@/lib/supabase/admin'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function generateImagenBackground(
  userId: string,
  prompt: string,
  projectId: string,
  slideIndex: number,
): Promise<{ url: string } | { error: string; refunded?: boolean }> {
  // 1. Pre-deduct credit atomically
  const deducted = await deductCredit(userId, 'imagen_generation', `AI image: ${prompt}`, projectId)
  if (!deducted) return { error: 'Insufficient credits' }

  try {
    // 2. Call Imagen API
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '9:16',
        includeRaiReason: true,
      },
    })

    // 3. Check for safety filter -- generatedImages may be empty or image may be null
    const generated = response.generatedImages?.[0]
    if (!generated?.image?.imageBytes) {
      // Safety filter blocked -- refund the credit
      const reason = generated?.raiFilteredReason ?? 'Content filtered by safety policy'
      await refundCredit(userId, projectId)
      return { error: reason, refunded: true }
    }

    // 4. Upload to Supabase Storage (existing bucket)
    const buffer = Buffer.from(generated.image.imageBytes, 'base64')
    const path = `${userId}/${projectId}/ai-${slideIndex}-${Date.now()}.png`
    const supabase = createAdminClient()
    await supabase.storage.from('slide-backgrounds').upload(path, buffer, {
      contentType: 'image/png',
    })
    const { data: publicData } = supabase.storage.from('slide-backgrounds').getPublicUrl(path)

    return { url: publicData.publicUrl }
  } catch (err) {
    // API error -- refund the credit
    await refundCredit(userId, projectId)
    return { error: 'Image generation failed. Credit refunded.', refunded: true }
  }
}

async function refundCredit(userId: string, projectId: string) {
  const supabase = createAdminClient()
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: 1,
    description: 'Imagen generation failed or filtered',
    reference_id: projectId,
  })
}
```

### Pattern 2: Auto-Prompt Generation from Slide Content

**What:** Use Gemini 2.5 Flash to convert slide text (hook, body, topic) into a descriptive Imagen prompt. This runs before showing the prompt to the user for editing.

**When to use:** When user clicks "AI Generate" tab for a slide, auto-populate the prompt field.

**Example:**
```typescript
// Source: existing regenerateSlideText pattern in editor-actions.ts
export async function generateImagePrompt(
  topic: string,
  hookText: string,
  bodyText: string,
  isCta: boolean,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a concise image prompt for a TikTok carousel slide background.
Topic: "${topic}"
Hook text: "${hookText}"
Body text: "${bodyText}"
${isCta ? 'This is the closing CTA slide.' : ''}

The image should be a mood/aesthetic background photo that complements the text overlay.
Do NOT include text in the image. Focus on atmosphere, colors, and visual mood.
Keep the prompt under 100 words. Be specific and descriptive.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'Imagen prompt for slide background' },
        },
        required: ['prompt'],
      },
    },
  })
  return JSON.parse(response.text!).prompt
}
```

### Pattern 3: Caption Generation with Platform-Specific Output

**What:** Generate captions for TikTok, Instagram, and LinkedIn from actual slide content using Gemini 2.5 Flash structured output.

**When to use:** After carousel is complete, on demand.

**Example:**
```typescript
// Source: existing generateSlideContent pattern
const captionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tiktok: { type: Type.STRING, description: 'TikTok caption with hashtags' },
    instagram: { type: Type.STRING, description: 'Instagram caption with hashtags and line breaks' },
    linkedin: { type: Type.STRING, description: 'LinkedIn post, professional tone' },
  },
  required: ['tiktok', 'instagram', 'linkedin'],
}

export async function generateCaptions(slides: Slide[], topic: string) {
  const slidesSummary = slides.map((s, i) =>
    `Slide ${i + 1}: Hook: "${s.hook_text}" Body: "${s.body_text}"`
  ).join('\n')

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate social media captions for a carousel about "${topic}".
The carousel has ${slides.length} slides with this content:
${slidesSummary}

For each platform, reference specific points from the slides (not just the topic).
TikTok: Short, punchy, 2-3 sentences + 5-8 hashtags. Under 2200 chars.
Instagram: Engaging, can be longer, 3-5 sentences + 20-30 hashtags. Line breaks for readability.
LinkedIn: Professional, thought-leadership tone. 2-3 paragraphs. 3-5 hashtags.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: captionSchema,
    },
  })
  return JSON.parse(response.text!)
}
```

### Pattern 4: Free User Gating with Existing UpgradePrompt

**What:** Show UpgradePrompt component in the "AI Generate" tab for free-tier users instead of the generation UI.

**When to use:** When `getUserTier()` returns `'free'`.

**Example:**
```typescript
// In the image-picker-panel.tsx AI tab
// Tier check passed from parent or fetched via server action
{userTier === 'free' ? (
  <UpgradePrompt context="feature_gate" />
) : (
  <AIGenerateForm ... />
)}
```

### Anti-Patterns to Avoid

- **Calling Imagen without pre-deduction:** Never call the API first and deduct after. Concurrent requests can double-spend credits. Pre-deduct and refund on failure.
- **Storing Imagen base64 in slide_data JSONB:** Upload to Supabase Storage and store the public URL in `background_url`, same as Pexels photos.
- **Generating captions on page load:** Only generate when user explicitly clicks "Generate Captions". Captions are ephemeral and do not need DB storage.
- **Hard-coding Imagen prompt text:** Always auto-generate prompts from slide content, then let the user edit. This satisfies both IMAGEN-02 (auto-generate) and IMAGEN-04 (edit before spending).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image prompt generation | Manual prompt templates per topic | Gemini 2.5 Flash structured output | Slide content is dynamic; AI adapts to any topic |
| Safety filter detection | Custom error parsing from HTTP response | `includeRaiReason: true` + check `raiFilteredReason` field on `GeneratedImage` | SDK provides this natively |
| Image upload to storage | Custom file handling, temp files | `supabase.storage.from('slide-backgrounds').upload()` with Buffer | Existing pattern in `editor-actions.ts` |
| Credit refund logic | Custom balance recalculation | Insert `+1` row with type `'refund'` into `credit_transactions` | Ledger pattern already supports this -- SUM(amount) auto-corrects |
| Platform-specific caption formatting | Per-platform template strings | Gemini structured output with platform-specific instructions | AI handles hashtag style, tone, and length per platform |

## Common Pitfalls

### Pitfall 1: Safety Filter Credit Loss
**What goes wrong:** User generates an Imagen image, credit is deducted, but safety filter blocks the output. User loses a credit with no image.
**Why it happens:** Imagen's safety filter can reject prompts or outputs that are not obviously objectionable (false positives on certain descriptive terms).
**How to avoid:** Always set `includeRaiReason: true` in the config. Check if `generatedImages[0]?.image?.imageBytes` exists. If absent, check `raiFilteredReason` for the reason and insert a `'refund'` credit transaction. Show the specific filter reason to the user so they can modify their prompt.
**Warning signs:** User complaints about "wasted credits", credit balance going down without images appearing.

### Pitfall 2: Imagen Response with Empty generatedImages Array
**What goes wrong:** The API returns successfully (HTTP 200) but `response.generatedImages` is an empty array or the image field is null.
**Why it happens:** When ALL requested images are filtered, the array can be empty rather than throwing an error. This is documented behavior for Google Imagen.
**How to avoid:** Always check `response.generatedImages?.length > 0` AND `generatedImages[0]?.image?.imageBytes` before processing. Treat both empty array and null image as "filtered" and refund.
**Warning signs:** Server action returns success but no image URL.

### Pitfall 3: Vercel Function Timeout
**What goes wrong:** Imagen 4 Fast takes 3-8 seconds (occasionally up to 15s). On Vercel Hobby plan (10s timeout), this can intermittently fail.
**Why it happens:** Vercel Hobby plan has a 10-second serverless function timeout. Imagen generation time varies.
**How to avoid:** If on Vercel Hobby, increase the `maxDuration` export on the server action (Vercel Pro supports up to 300s). Or set `export const maxDuration = 60` on the route/action. Alternatively, ensure deployment is on Vercel Pro (60s default timeout).
**Warning signs:** Intermittent 504 errors on image generation.

### Pitfall 4: Prompt Too Long for Imagen
**What goes wrong:** Auto-generated prompts from slide content exceed Imagen's 480-token limit.
**Why it happens:** Gemini may generate verbose prompts if not constrained. Combined hook + body text can be long.
**How to avoid:** In the Gemini prompt-generation call, explicitly instruct "Keep the prompt under 100 words." Also truncate the final prompt to 480 tokens (approximately 350 words) as a safety net before calling Imagen.
**Warning signs:** Imagen API errors mentioning prompt length.

### Pitfall 5: Double-Click Generating Multiple Images
**What goes wrong:** User double-clicks "Generate" button, two server action calls fire, two credits deducted, two images generated.
**Why it happens:** No client-side debouncing, and the credit pre-deduction allows both calls to proceed (each deducts independently).
**How to avoid:** Disable the generate button immediately on click (set loading state). Use `useTransition` or a `pending` state to prevent concurrent calls. The atomic `deduct_credits` RPC already prevents overspend beyond balance, but UI should prevent double-fire for UX.
**Warning signs:** Credit balance drops by 2 on a single click.

## Code Examples

### Verified: Imagen API Call Pattern
```typescript
// Source: https://ai.google.dev/gemini-api/docs/imagen + @google/genai@1.46.0 type definitions
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const response = await ai.models.generateImages({
  model: 'imagen-4.0-fast-generate-001',
  prompt: 'Minimalist gradient background in warm sunset tones',
  config: {
    numberOfImages: 1,
    aspectRatio: '9:16',       // Native support for carousel slides
    includeRaiReason: true,    // Get filter reason if blocked
    // safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE', // default, can lower to BLOCK_ONLY_HIGH
  },
})

// Response structure:
// response.generatedImages[0].image.imageBytes -- base64 encoded PNG
// response.generatedImages[0].raiFilteredReason -- string if filtered
```

### Verified: Existing Credit Deduction
```typescript
// Source: src/lib/credits/check-credits.ts (Phase 5 output)
import { deductCredit, getUserTier, getCreditBalance } from '@/lib/credits/check-credits'

// Already supports 'imagen_generation' as a credit type (defined in types.ts)
const deducted = await deductCredit(userId, 'imagen_generation', 'AI background', projectId)
// Returns true if sufficient balance and deduction succeeded
// Returns false if insufficient balance (atomic via FOR UPDATE lock)
```

### Verified: Supabase Storage Upload
```typescript
// Source: src/app/(dashboard)/project/[id]/editor-actions.ts (existing upload pattern)
// Uses existing 'slide-backgrounds' bucket
const supabase = createAdminClient() // service role for server-side upload
const { error } = await supabase.storage
  .from('slide-backgrounds')
  .upload(path, buffer, { contentType: 'image/png' })
const { data } = supabase.storage
  .from('slide-backgrounds')
  .getPublicUrl(path)
// data.publicUrl is the CDN URL to store in slide.background_url
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Imagen 3 | Imagen 4 Fast (GA) | 2025 | Lower cost ($0.02), faster generation, better quality |
| `@google/generative-ai` (old SDK) | `@google/genai` (unified SDK) | 2025 | Single SDK for Gemini + Imagen + Veo; `generateImages()` method |
| Vertex AI required for Imagen | Gemini Developer API supports Imagen | 2025 | Same API key works for text and images; no Google Cloud project needed |

**Confirmed:** The `GEMINI_API_KEY` (Gemini Developer API key) works for both `generateContent()` (text) and `generateImages()` (Imagen). No separate Vertex AI or Google Cloud service account is needed. This resolves the blocker flagged in STATE.md.

## Open Questions

1. **Vercel plan timeout**
   - What we know: Imagen 4 Fast takes 3-8s typically, up to 15s. Vercel Hobby = 10s timeout, Pro = 60s.
   - What's unclear: Which Vercel plan the project currently deploys on.
   - Recommendation: Add `export const maxDuration = 60` to the Imagen server action. This works on Vercel Pro. If on Hobby, the action will still timeout at 10s -- in that case, upgrade to Pro or implement a polling pattern. Given this is a monetized SaaS with Stripe, Vercel Pro is likely needed anyway.

2. **Caption credit cost**
   - What we know: Research recommends captions be free (cost is ~$0.001/request). CAPTION-01/02 do not mention credits.
   - What's unclear: Whether captions should cost credits.
   - Recommendation: Make captions free for all tiers. The cost is negligible and it increases perceived value. No credit deduction in the caption server action.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` | Imagen + Captions | Yes | 1.46.0 | -- |
| `GEMINI_API_KEY` env var | Imagen + Captions | Yes (existing) | -- | -- |
| Supabase Storage (`slide-backgrounds` bucket) | Imagen image upload | Yes (existing) | -- | -- |
| Credit system (`deduct_credits` RPC) | Imagen gating | Yes (Phase 5) | -- | -- |
| `getUserTier()` | Free user gating | Yes (Phase 5) | -- | -- |
| `UpgradePrompt` component | Free user upsell | Yes (Phase 6) | -- | -- |
| Stripe subscription tiers | Tier-based gating | Yes (Phase 6) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMAGEN-01 | Imagen API called, image uploaded, URL returned | unit | `npx vitest run src/__tests__/imagen/generate-image.test.ts -x` | Wave 0 |
| IMAGEN-02 | Auto-prompt generated from slide content | unit | `npx vitest run src/__tests__/imagen/generate-prompt.test.ts -x` | Wave 0 |
| IMAGEN-03 | Free users see UpgradePrompt in AI tab | unit | `npx vitest run src/__tests__/imagen/free-gate.test.ts -x` | Wave 0 |
| IMAGEN-04 | Prompt shown in editable field before generation | unit | `npx vitest run src/__tests__/imagen/prompt-edit.test.ts -x` | Wave 0 |
| CAPTION-01 | Captions generated for 3 platforms | unit | `npx vitest run src/__tests__/captions/generate-captions.test.ts -x` | Wave 0 |
| CAPTION-02 | Caption content references slide hooks/body, not just topic | unit | `npx vitest run src/__tests__/captions/generate-captions.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/imagen/generate-image.test.ts` -- covers IMAGEN-01 (mock `ai.models.generateImages`, mock Supabase storage upload, mock `deductCredit`)
- [ ] `src/__tests__/imagen/generate-prompt.test.ts` -- covers IMAGEN-02 (mock `ai.models.generateContent` for prompt auto-generation)
- [ ] `src/__tests__/captions/generate-captions.test.ts` -- covers CAPTION-01, CAPTION-02 (mock Gemini, verify slide content in prompt)
- Test infrastructure (Vitest, setup file, mocking patterns) already exists from prior phases

## Sources

### Primary (HIGH confidence)
- [Google Imagen API docs](https://ai.google.dev/gemini-api/docs/imagen) -- model names, API params, aspect ratios, JS code examples
- `@google/genai@1.46.0` type definitions (`genai.d.ts`) -- `GenerateImagesResponse`, `GeneratedImage.raiFilteredReason`, `SafetyFilterLevel` enum, `includeRaiReason` config option
- [@google/genai npm v1.46.0](https://www.npmjs.com/package/@google/genai) -- confirmed `generateImages()` method available
- Existing codebase: `src/lib/ai/generate-slides.ts`, `src/lib/credits/check-credits.ts`, `src/app/(dashboard)/project/[id]/editor-actions.ts` -- verified patterns for Gemini calls, credit deduction, storage upload

### Secondary (MEDIUM confidence)
- [Google Cloud Imagen safety filter docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/configure-responsible-ai-safety-settings) -- `safetyFilterLevel` values, filter behavior
- [Imagen 3 filter sensitivity discussion](https://discuss.google.dev/t/imagen-3-filter-sensitivity/173697) -- false positive reports (may differ for Imagen 4)

### Tertiary (LOW confidence)
- Vercel function timeout limits (need to confirm current deployment plan)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all APIs verified against installed SDK types
- Architecture: HIGH -- patterns directly extend existing codebase (same SDK, same storage bucket, same credit system)
- Pitfalls: HIGH -- safety filter behavior verified from SDK types; credit race conditions already solved by Phase 5 RPC

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- Imagen 4 is GA, SDK is mature)
