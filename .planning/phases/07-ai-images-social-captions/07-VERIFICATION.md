---
phase: 07-ai-images-social-captions
verified: 2026-03-25T20:12:00Z
status: human_needed
score: 8/9 must-haves verified
human_verification:
  - test: "Generate AI slide background in editor"
    expected: "Imagen API called, image appears applied to slide background within 15 seconds, credit deducted"
    why_human: "External Imagen API call; Playwright blocked by browser auth issue; cannot mock in integration"
  - test: "Auto-prompt quality — open AI Generate tab for any slide"
    expected: "Prompt textarea auto-populates with content referencing that slide's hook/body text, not generic filler"
    why_human: "IMAGEN-02 quality gate: programmatic checks confirm wiring exists, but Gemini output quality requires human judgment"
  - test: "Editable prompt before credit spend (IMAGEN-04)"
    expected: "Prompt textarea is editable; changing text and clicking Generate uses the edited prompt, not the original auto-generated one"
    why_human: "UI interaction flow; TypeScript compiles but runtime behavior requires browser"
  - test: "Free-user upgrade gate (IMAGEN-03)"
    expected: "Sign in as free tier user, open any project, click Images > AI Generate — UpgradePrompt renders instead of the generate form"
    why_human: "Requires authenticated session with free-tier account"
  - test: "Caption generation produces platform-differentiated output (CAPTION-02)"
    expected: "TikTok caption has hashtags + 2-3 sentences, LinkedIn is professional paragraphs, Instagram has 20-30 hashtags; all reference specific slide hooks"
    why_human: "Content quality judgment; unit tests verify wiring but not output quality"
  - test: "Copy Caption clipboard behavior"
    expected: "Clicking Copy Caption puts the correct platform caption in clipboard; icon changes to check for 2 seconds"
    why_human: "Clipboard API behavior requires browser runtime"
---

# Phase 7: AI Images & Social Captions — Verification Report

**Phase Goal:** Users can generate AI-powered slide backgrounds and get ready-to-post social media captions for their carousels
**Verified:** 2026-03-25T20:12:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Imagen API wrapper pre-deducts credit, calls API, uploads to Supabase Storage, returns public URL | VERIFIED | `generate-image.ts` L9-64: deductCredit → generateImages → Buffer.from → storage.from('slide-backgrounds').upload → publicUrl returned |
| 2 | If Imagen safety-filters or errors, credit is refunded via insert into credit_transactions | VERIFIED | L43-45 (safety filter path), L59-62 (catch path): both call `refundCredit()` which inserts into `credit_transactions` with type='refund' |
| 3 | Gemini auto-generates an image prompt from slide content (hook, body, topic) | VERIFIED | `generate-prompt.ts`: passes hook_text, body_text, topic, isCta to gemini-2.5-flash with structured JSON output; unit tests pass |
| 4 | Gemini generates platform-specific captions from actual slide content | VERIFIED | `generate-captions.ts` L19-25: builds slidesSummary from hook_text + body_text for every slide; passes to Gemini with platform-specific instructions; unit test verifies slide content appears in prompt |
| 5 | User can generate an AI slide background from the editor image picker AI Generate tab | VERIFIED (wired) / HUMAN (runtime) | `image-picker-panel.tsx` L211-220: third tab 'ai' renders AIGenerateTab; AIGenerateTab calls generateAIImageAction; actual Imagen call needs human verification |
| 6 | Auto-generated prompt appears in editable textarea before user spends a credit | VERIFIED (wired) / HUMAN (runtime) | `ai-generate-tab.tsx` L45-74: useEffect calls generateImagePromptAction on mount; result sets prompt state; textarea is editable (onChange at L128); isPending guard prevents double-spend |
| 7 | Free users see UpgradePrompt instead of the AI generate form | VERIFIED | `ai-generate-tab.tsx` L77-83: `if (userTier === 'free') return <UpgradePrompt context="feature_gate" />`; hooks declared before guard (Rules of Hooks compliant) |
| 8 | User can generate TikTok, Instagram, LinkedIn captions from a button in the editor | VERIFIED | `slide-editor.tsx` L294-300: "Generate Captions" button toggles showCaptions; L313-319: CaptionPanel rendered when showCaptions=true; CaptionPanel calls generateCaptionsAction on mount |
| 9 | User can copy generated captions to clipboard | VERIFIED | `caption-panel.tsx` L62-71: handleCopy calls navigator.clipboard.writeText(captions[platform]); setCopiedPlatform for 2s icon feedback; Copy Caption button per platform |

**Score:** 9/9 truths confirmed wired; 6 require human runtime verification for full sign-off

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/imagen/generate-image.ts` | Imagen API wrapper with credit pre-deduction and refund | VERIFIED | 76 lines; exports generateImagenBackground + ImagenResult type; all 4 code paths implemented |
| `src/lib/imagen/generate-prompt.ts` | Auto-prompt generation from slide content | VERIFIED | 40 lines; exports generateImagePrompt; calls gemini-2.5-flash with structured output; fallback on parse error |
| `src/lib/captions/generate-captions.ts` | Multi-platform caption generation | VERIFIED | 69 lines; exports generateCaptions + CaptionResult type; handles 0-slides edge case |
| `src/app/(dashboard)/project/[id]/imagen-actions.ts` | Server actions for Imagen generation | VERIFIED | `'use server'` + maxDuration=60; both generateAIImageAction and generateImagePromptAction exported with auth check |
| `src/app/(dashboard)/project/[id]/caption-actions.ts` | Server action for caption generation | VERIFIED | `'use server'`; generateCaptionsAction exported; fetches slide_data + topic from DB before calling generateCaptions |
| `src/__tests__/imagen/generate-image.test.ts` | Tests for Imagen wrapper | VERIFIED | 5 tests passing: success, insufficient credits, safety filter refund, API error refund, prompt truncation |
| `src/__tests__/imagen/generate-prompt.test.ts` | Tests for auto-prompt generation | VERIFIED | 3 tests passing: prompt generation, CTA context, parse error fallback |
| `src/__tests__/captions/generate-captions.test.ts` | Tests for caption generation | VERIFIED | 4 tests passing: platform output, slide content in prompt, 0-slide edge case, parse error |
| `src/components/editor/ai-generate-tab.tsx` | AI Generate tab with free-user gate, editable prompt, all states | VERIFIED | 211 lines (min 80 required); all states implemented: loading-prompt, prompt-ready, generating, success, safety-filtered, insufficient-credits, error |
| `src/components/captions/caption-panel.tsx` | Caption panel with platform tabs, copy buttons, regenerate | VERIFIED | 173 lines (min 60 required); tablist/tab/tabpanel ARIA; copy-to-clipboard with icon feedback; regenerate; close |
| `src/components/editor/image-picker-panel.tsx` | Modified image picker with third AI Generate tab | VERIFIED | Contains "AI Generate" at L144; activeTab state includes 'ai'; renders AIGenerateTab at L211-220 |
| `src/components/editor/slide-editor.tsx` | Modified editor with Generate Captions button and caption panel | VERIFIED | "caption" present throughout; showCaptions state; CaptionPanel imported and rendered conditionally |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `generate-image.ts` | deductCredit RPC | import from @/lib/credits/check-credits | WIRED | L2 import; L16-21 call with 'imagen_generation' type |
| `generate-image.ts` | slide-backgrounds bucket | createAdminClient().storage.from('slide-backgrounds').upload | WIRED | L52-54: upload call confirmed |
| `generate-image.ts` | credit_transactions table | refundCredit insert on failure | WIRED | L66-75: refundCredit() inserts into credit_transactions with type='refund' |
| `generate-captions.ts` | Gemini structured output | ai.models.generateContent with captionSchema | WIRED | L37: responseMimeType: 'application/json'; schema has tiktok/instagram/linkedin required fields |
| `ai-generate-tab.tsx` | imagen-actions.ts | import generateAIImageAction, generateImagePromptAction | WIRED | L7-9 import; L51 and L93 call sites |
| `ai-generate-tab.tsx` | upgrade-prompt.tsx | UpgradePrompt context='feature_gate' for free users | WIRED | L5 import; L80 render with context="feature_gate" |
| `caption-panel.tsx` | caption-actions.ts | import generateCaptionsAction | WIRED | L5 import; L40 call site inside fetchCaptions |
| `slide-editor.tsx` | caption-panel.tsx | CaptionPanel rendered below editor grid | WIRED | L11 import; L314-318 render after main grid div |
| `project/[id]/page.tsx` | check-credits.ts | getUserTier fetched server-side, passed to SlideEditor | WIRED | L7 import; L35 getUserTier(user.id); L43 userTier={tier} prop |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ai-generate-tab.tsx` | `prompt` state | generateImagePromptAction → generateImagePrompt → Gemini API | Yes — Gemini structured output with fallback | FLOWING |
| `ai-generate-tab.tsx` | result.url | generateAIImageAction → generateImagenBackground → Supabase Storage publicUrl | Yes — storage upload + getPublicUrl | FLOWING |
| `caption-panel.tsx` | `captions` state | generateCaptionsAction → DB query (projects.slide_data) → generateCaptions → Gemini | Yes — real DB select then Gemini API | FLOWING |
| `caption-actions.ts` | `slides` | supabase.from('projects').select('slide_data, topic') | Yes — actual DB query, not static | FLOWING |
| `project/[id]/page.tsx` | `tier` | getUserTier(user.id) → check-credits.ts | Yes — reads from auth/subscription state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| generateImagenBackground exported | `node -e "const m=require('./src/lib/imagen/generate-image.ts')"` | N/A (TS source) | SKIPPED — verified via grep + unit tests |
| Unit tests pass | `npx vitest run src/__tests__/imagen/ src/__tests__/captions/` | 36/36 passing | PASS |
| TypeScript compiles (phase-7 files) | `npx tsc --noEmit` grep for phase-7 paths | 0 errors in phase-7 files | PASS |
| All 4 commits exist in git log | `git log --oneline` | 20e672a, 4748173, 2b2ce4f, adc6fe7 confirmed | PASS |

Note: TypeScript has 4 pre-existing errors in `src/__tests__/auth/` (middleware.test.ts, logout.test.ts) from a prior phase. These are unrelated to phase 7 and do not affect build output.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| IMAGEN-01 | 07-01, 07-02 | User can generate AI slide backgrounds via Google Imagen 4 Fast | SATISFIED | generate-image.ts calls imagen-4.0-fast-generate-001; wired through server action to AI Generate tab in editor |
| IMAGEN-02 | 07-01 | Imagen prompts auto-generate from slide content without manual input | SATISFIED | generate-prompt.ts passes hook_text, body_text, topic to Gemini; ai-generate-tab.tsx calls on mount via useEffect |
| IMAGEN-03 | 07-02 | Free users see "Upgrade to AI" button on slides as low-friction upsell | SATISFIED | ai-generate-tab.tsx L77-83: userTier === 'free' renders UpgradePrompt; userTier flows server → page → SlideEditor → ImagePickerPanel → AIGenerateTab |
| IMAGEN-04 | 07-02 | User can preview and edit the auto-generated Imagen prompt before spending a credit | SATISFIED | ai-generate-tab.tsx: prompt state populated by generateImagePromptAction; textarea is editable; generate button only fires with edited prompt value |
| CAPTION-01 | 07-01, 07-02 | User can generate social media captions (TikTok, Instagram, LinkedIn) | SATISFIED | generateCaptions returns tiktok/instagram/linkedin; CaptionPanel renders all 3 platform tabs; unit tests confirm output shape |
| CAPTION-02 | 07-01 | Captions reference actual slide content rather than just the topic | SATISFIED | generate-captions.ts L19-25: builds slidesSummary from every slide's hook_text + body_text; unit test "prompt includes actual slide hook_text and body_text" passes |

No orphaned requirements — all 6 IDs declared in plan frontmatter are accounted for and satisfied by implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `caption-panel.tsx` | 60 | `if (!visible) return null` | Info | Legitimate visibility guard — component renders fully when visible=true; not a stub |

No blockers or warnings found. No TODO/FIXME comments, no static empty returns in data-rendering paths.

### Human Verification Required

The automated checks all pass. The following 6 behaviors require a human to verify in a running browser because they involve external AI API calls, UI interaction flows, or authenticated sessions:

#### 1. Imagen Background Generation (IMAGEN-01 runtime)

**Test:** Open any project in the editor. Click Images tab. Click AI Generate. Wait for prompt to auto-populate. Click "Generate Image."
**Expected:** Button disables immediately with spinner. After up to 15 seconds, a generated image appears applied to the slide background. Credit balance decreases by 1.
**Why human:** Calls live Imagen API; Playwright blocked by browser auth; cannot verify without running app.

#### 2. Auto-Prompt Quality (IMAGEN-02 quality gate)

**Test:** Open several slides with different content. Switch to AI Generate tab on each.
**Expected:** Each auto-generated prompt reflects that slide's actual hook/body text, not generic fallback.
**Why human:** Gemini output quality cannot be asserted programmatically; unit tests verify wiring, not output quality.

#### 3. Prompt Preview and Edit Before Spend (IMAGEN-04)

**Test:** Open AI Generate tab. Note the auto-generated prompt. Edit the text. Click Generate Image.
**Expected:** The Imagen API uses the edited prompt text (not the original). The textarea accepts edits while not generating.
**Why human:** UI interaction and request payload inspection; cannot verify without browser devtools.

#### 4. Free User Upgrade Gate (IMAGEN-03)

**Test:** Sign in as a free-tier user. Open any project. Go to Images > AI Generate tab.
**Expected:** The AI Generate tab shows the UpgradePrompt component, not the textarea/generate button. No credits are mentioned.
**Why human:** Requires authenticated free-tier session.

#### 5. Caption Platform Differentiation (CAPTION-02 quality gate)

**Test:** Click "Generate Captions" in editor footer. Switch between TikTok, Instagram, LinkedIn tabs.
**Expected:** TikTok: 2-3 sentences + hashtags, punchy. Instagram: longer with 20-30 hashtags. LinkedIn: professional paragraphs. All mention specific slide hook phrases.
**Why human:** Output quality judgment; unit test verifies slide content appears in prompt but not Gemini's final output.

#### 6. Copy Caption Clipboard (CAPTION-01)

**Test:** Generate captions. Click "Copy Caption" on TikTok tab.
**Expected:** Clipboard contains the TikTok caption text. Icon changes from content_copy to check, reverts after 2 seconds.
**Why human:** Clipboard API requires browser secure context and cannot be tested statically.

### Gaps Summary

No structural gaps. All artifacts exist, are substantive, are wired to real data sources, and have passing unit tests. The phase is blocked from full sign-off only by the browser authentication issue preventing Playwright from verifying the 6 human-verification items above. All human checks are runtime/quality concerns, not missing implementation.

---

_Verified: 2026-03-25T20:12:00Z_
_Verifier: Claude (gsd-verifier)_
