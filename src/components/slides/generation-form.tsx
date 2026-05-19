'use client'

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from 'react'
import { generateCarousel } from '@/app/(dashboard)/project/[id]/actions'
import { regenerateAction } from '@/app/(dashboard)/style-from-reference/actions'
import { createUploadUrl } from '@/app/(dashboard)/project/[id]/editor-actions'
import { validateImageFile } from '@/lib/upload-validation'
import { TemplatePicker } from './template-picker'
import { CategorySelector } from './category-selector'
import { DEFAULT_CATEGORY, getCategory } from '@/lib/ai/categories'
import { Icon } from '@/components/ui/icon'
import { LetterCircleLoader } from '@/components/ui/letter-circle-loader'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import { useRouter } from 'next/navigation'
import { FONT_CATALOG } from '@/lib/fonts/font-catalog'
import { StyleFromReferenceShell } from '@/components/style-from-reference/style-from-reference-shell'
import type { SpecPreviewState } from '@/components/style-from-reference/state-machine'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { PickerDbTemplate } from '@/lib/render/templates/registry'

export type ImageSource = 'stock' | 'ai' | 'none'

const MAX_UPLOADS = 20

interface GenerationFormProps {
  projectId: string
  currentTopic?: string
  currentTemplateId?: string
  /** Phase 82 (R1): persisted content category — rehydrates the selector
   *  so Regenerate reuses the project's category. */
  currentCategory?: string
  hasSlides: boolean
  userTier?: 'free' | 'pro' | 'plus'
  brandKit?: BrandKit | null
  /** quick-260514-g7y: ToS clickwrap state for the inlined style-from-
   *  reference collapsible. Forwarded into the embedded
   *  StyleFromReferenceShell so the modal fires only when the user has
   *  not yet accepted the current ToS version. Defaults to true so
   *  callers that never render the references collapsible (legacy
   *  contexts, tests) don't accidentally surface the modal. */
  tosAlreadyAccepted?: boolean
  acceptTosAction?: () => Promise<{ ok: true } | { ok: false; error: string }>
  /** Phase 87 (WIRE-01): DB-backed templates fetched server-side by the
   *  project page and threaded into the picker. Defaults to [] so callers
   *  that don't pass it (tests, legacy contexts) are unaffected. */
  dbTemplates?: PickerDbTemplate[]
}

export function GenerationForm({
  projectId,
  currentTopic,
  currentTemplateId,
  currentCategory,
  hasSlides,
  userTier = 'free',
  brandKit,
  tosAlreadyAccepted,
  acceptTosAction,
  dbTemplates = [],
}: GenerationFormProps) {
  const [topic, setTopic] = useState(currentTopic ?? '')
  // Phase 82 (R6): the selected content category drives Gemini's copy.
  // Defaults to News (the reported pain point + primary deliverable).
  const [category, setCategory] = useState<string>(
    currentCategory && getCategory(currentCategory) ? currentCategory : DEFAULT_CATEGORY,
  )
  // Phase 82 (R7): seed the template from the category's curated set so the
  // picker never starts on the legacy 'highlight-bar' fallback. If a saved
  // project's templateId is in the category's templateIds, keep it; else snap
  // to the category default.
  const [templateId, setTemplateId] = useState(() => {
    const mod = getCategory(
      currentCategory && getCategory(currentCategory) ? currentCategory : DEFAULT_CATEGORY,
    )!
    return currentTemplateId && mod.templateIds.includes(currentTemplateId)
      ? currentTemplateId
      : mod.templateIds[0]
  })
  const [imageSource, setImageSource] = useState<ImageSource>('stock')
  const isPaidUser = userTier !== 'free'
  const sliderMax = 10
  const [slideCount, setSlideCount] = useState(7)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  // Phase 82 (R6): the Content Category collapsible defaults open so the new
  // capability is discoverable on first paint.
  const [showCategory, setShowCategory] = useState(true)
  const [showVisualStyle, setShowVisualStyle] = useState(true)
  const [showSlideCount, setShowSlideCount] = useState(true)
  const [showBackgroundImages, setShowBackgroundImages] = useState(true)
  // quick-260514-g7y: new collapsible hosting the inlined style-from-
  // reference shell. Default closed so the form's first-paint is
  // unchanged for users who don't use the references flow.
  const [showInspiredByRefs, setShowInspiredByRefs] = useState(false)
  // Mirrors the embedded shell's reducer state. Populated via
  // <StyleFromReferenceShell onSpecChange>. handleSubmit reads this to
  // route generation through regenerateAction when a spec is present.
  const [inlineSpec, setInlineSpec] = useState<SpecPreviewState | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedFont, setAdvancedFont] = useState<string>('')
  const [advancedFontColor, setAdvancedFontColor] = useState<string>('')
  const [advancedImagePrompt, setAdvancedImagePrompt] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const fontsByCategory = useMemo(() => {
    const groups: Record<string, typeof FONT_CATALOG> = {}
    for (const font of FONT_CATALOG) {
      if (!groups[font.category]) groups[font.category] = []
      groups[font.category].push(font)
    }
    return groups
  }, [])

  const previewUrls = useMemo(
    () => selectedFiles.map((f) => URL.createObjectURL(f)),
    [selectedFiles]
  )
  useEffect(() => {
    return () => {
      previewUrls.forEach(URL.revokeObjectURL)
    }
  }, [previewUrls])

  const busy = isPending || uploading

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length === 0) return

    const valid: File[] = []
    let firstError: string | null = null
    for (const file of picked) {
      const err = validateImageFile(file)
      if (err) {
        if (!firstError) firstError = err
        continue
      }
      valid.push(file)
    }

    if (firstError) setError(firstError)
    else setError(null)

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid].slice(0, MAX_UPLOADS))
    }
    e.target.value = ''
  }

  function removeFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // Phase 82 (R6, R7): switching the category re-aligns the template picker.
  // When the currently-selected templateId is not in the new category's
  // curated templateIds list, snap to the category's default (templateIds[0])
  // so the picker never sits on a template the category does not allow.
  function handleCategoryChange(id: string) {
    setCategory(id)
    const mod = getCategory(id)
    if (mod && !mod.templateIds.includes(templateId)) {
      setTemplateId(mod.templateIds[0])
    }
  }

  async function uploadAll(files: File[]): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const { signedUrl, publicUrl } = await createUploadUrl(projectId, file.name)
      const res = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      urls.push(publicUrl)
    }
    return urls
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setError(null)
    setShowUpgradePrompt(false)
    const effectiveSlideCount = slideCount

    // quick-260514-g7y: branch on the inlined style-from-reference state.
    // When the user has uploaded references and extraction reached the
    // 'preview' status, the extracted spec drives generation (locked
    // decision: "extracted spec wins" — template_id is ignored in this
    // branch). Otherwise fall through to the template-based path.
    //
    // quick-260515-dwu: harden the predicate to ALSO require at least
    // one reference row. The reducer shouldn't emit status='preview'
    // with an empty references[] (UPLOAD_RESET → references=[] sets
    // status back to idle), but the bug-report DB evidence shows the
    // arrow routed wrong somewhere — belt-and-braces. A Copy Style
    // generation without references can't populate reference_assets
    // anyway, and the user clearly didn't complete the Copy Style flow,
    // so falling back to the topic flow is the correct behavior.
    const useReferenceSpec =
      inlineSpec?.spec != null &&
      inlineSpec.status === 'preview' &&
      inlineSpec.references.length > 0

    startTransition(async () => {
      if (useReferenceSpec && inlineSpec?.spec) {
        // quick-260514-images: forward the form's BACKGROUND IMAGES
        // selection + slide-count slider into the references emit so
        // the generated carousel honors the user's choice instead of
        // shipping text-only-on-white. Originally the references path
        // was text-only by design; user feedback flipped that.
        const result = await regenerateAction({
          projectId,
          spec: inlineSpec.spec,
          aspects: inlineSpec.aspects,
          useBrandKitRemix: inlineSpec.useBrandKitRemix,
          brandKit: brandKit ?? null,
          content: { mode: 'ai-copy', topic: topic.trim() },
          imageSource,
          slideCount: effectiveSlideCount,
          // quick-260515-dwu: forward the extracted reference rows end-
          // to-end so the project row's reference_assets column gets
          // populated alongside style_spec. Without this the row carries
          // style_spec but null reference_assets and downstream
          // remix/fork (REMIX-04) has nothing to inherit.
          references: inlineSpec.references,
        })
        if (!result.ok) {
          setError(`Generation failed (${result.error}): ${result.detail ?? 'no detail'}`)
        } else {
          router.refresh()
        }
        return
      }

      let uploadedImageUrls: string[] = []
      if (selectedFiles.length > 0) {
        try {
          setUploading(true)
          uploadedImageUrls = await uploadAll(selectedFiles)
        } catch (err) {
          setError((err as Error).message || 'Upload failed. Please try again.')
          setUploading(false)
          return
        }
        setUploading(false)
      }

      const result = await generateCarousel(
        projectId,
        topic.trim(),
        templateId,
        imageSource,
        effectiveSlideCount,
        {
          font: advancedFont || undefined,
          fontColor: advancedFontColor || undefined,
          imagePrompt: advancedImagePrompt || undefined,
          uploadedImageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
        },
        // Phase 82 (R1): the selected content category drives generation.
        category
      )
      if (!result.success) {
        setError(result.error)
        if ('upgradeEligible' in result && result.upgradeEligible) {
          setShowUpgradePrompt(true)
        }
      } else {
        router.refresh()
      }
    })
  }

  const loaderText = uploading
    ? 'Uploading'
    : imageSource === 'ai'
      ? 'Generating'
      : 'Building'

  return (
    <>
      {busy && (
        <div role="status" aria-live="polite" aria-busy="true">
          <LetterCircleLoader text={loaderText} />
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Textarea */}
      <div>
        <label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-3 ml-1">
          Presentation Prompt
        </label>
        <div className="relative">
          <textarea
            data-onboarding-id="topic-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 5 tips for growing your Instagram following, benefits of morning routines, how to start investing..."
            rows={6}
            disabled={busy}
            maxLength={2000}
            className="w-full bg-white pt-6 px-6 pb-16 rounded-xl border-b-2 border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-0 transition-all text-lg resize-none placeholder:text-[#dbc1bc] disabled:opacity-50"
          />

          {/* Bottom action row inside textarea container */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || selectedFiles.length >= MAX_UPLOADS}
              className="pointer-events-auto flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-[#fff0f0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Attach photos for the slideshow"
              title="Attach photos for the slideshow"
            >
              <Icon name="attach_file" size="lg" className="text-[#7d6161] -rotate-45" />
              {selectedFiles.length > 0 && (
                <span className="text-xs font-semibold text-[#3d0000]">
                  {selectedFiles.length}
                </span>
              )}
            </button>

            <span
              className="pointer-events-none text-[0.65rem] tracking-wide text-[#7d6161]/60 tabular-nums"
              aria-live="polite"
            >
              {topic.length} / 2000
            </span>

            <button
              type="submit"
              disabled={busy || !topic.trim()}
              className="pointer-events-auto w-10 h-10 rounded-full bg-white border-2 border-[#3d0000] flex items-center justify-center hover:bg-[#3d0000] hover:text-white text-[#3d0000] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white disabled:text-[#3d0000]"
              aria-label="Generate carousel"
              title="Generate carousel"
            >
              <Icon name="arrow_upward" size="md" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleFilesPicked}
            className="hidden"
          />
        </div>

        {/* Selected photos thumbnail strip */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 ml-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#dbc1bc]/40 bg-[#fff0f0]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrls[idx]}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  disabled={busy}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] leading-none flex items-center justify-center hover:bg-black/90 disabled:opacity-50"
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </div>
            ))}
            {(() => {
              const photos = selectedFiles.length
              const slides = slideCount
              if (photos === slides) {
                return (
                  <p className="basis-full text-[10px] text-[#7d6161] mt-1">
                    All {photos} photo{photos === 1 ? '' : 's'} will be matched to your {slides} slide{slides === 1 ? '' : 's'} by content.
                  </p>
                )
              }
              if (photos < slides) {
                const remaining = slides - photos
                return (
                  <p className="basis-full text-[10px] text-[#7d6161] mt-1">
                    {photos} photo{photos === 1 ? '' : 's'} will be placed on the most relevant slide{photos === 1 ? '' : 's'}; the remaining {remaining} will {imageSource === 'none' ? 'be text-only on the template background' : `use ${imageSource === 'ai' ? 'AI' : 'stock'}`}.
                  </p>
                )
              }
              const ignored = photos - slides
              return (
                <p className="basis-full text-[10px] text-red-700 mt-1">
                  Only {slides} of your {photos} photos will be used (carousel limited to {slides} slide{slides === 1 ? '' : 's'}). Increase the slide count or remove {ignored} photo{ignored === 1 ? '' : 's'}.
                </p>
              )
            })()}
          </div>
        )}
      </div>

      {/* Copy style — collapsible (quick-260514-g7y + 260514-g7y-followup).
          Inlines the style-from-reference flow: upload 1–3 reference
          images, click Extract style, review the spec, toggle Apply
          aspects. handleSubmit reads inlineSpec on the Generate
          Carousel click and routes through regenerateAction when a
          spec is present (overriding the selected template — locked
          decision: "extracted spec wins"). Positioned ABOVE Select
          Visual Style so users encounter the "copy a style" option
          before the manual template picker. */}
      <div>
        <button
          type="button"
          onClick={() => setShowInspiredByRefs(!showInspiredByRefs)}
          className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] ml-1"
          aria-expanded={showInspiredByRefs}
        >
          Copy style
          {inlineSpec?.spec && (
            <span className="text-[10px] font-bold text-[#3d0000] uppercase tracking-wider">
              · Style extracted
            </span>
          )}
          <Icon
            name="expand_more"
            size="sm"
            className={`transition-transform ${showInspiredByRefs ? 'rotate-180' : ''}`}
          />
        </button>
        {showInspiredByRefs && (
          <div className="mt-4">
            <StyleFromReferenceShell
              projectId={projectId}
              targetProjectId={projectId}
              currentTopic={topic}
              brandKit={brandKit ?? null}
              brandKitAvailable={brandKit != null}
              tosAlreadyAccepted={tosAlreadyAccepted}
              acceptTosAction={acceptTosAction}
              hideGenerateCta
              onSpecChange={setInlineSpec}
            />
          </div>
        )}
      </div>

      {/* Content Category — collapsible (Phase 82 R6). Inserted above Select
          Visual Style: the user picks WHAT KIND of content before WHAT it
          looks like. The category drives Gemini's copy; it also filters the
          template picker below to the category's curated subset. */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => setShowCategory(!showCategory)}
            className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] ml-1"
            aria-expanded={showCategory}
          >
            Content Category
            <Icon
              name="expand_more"
              size="sm"
              className={`transition-transform ${showCategory ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {showCategory && (
          <div className="mt-4">
            <CategorySelector
              selected={category}
              onSelect={handleCategoryChange}
              disabled={isPending}
            />
          </div>
        )}
      </div>

      {/* Template Picker — collapsible. (quick-260514-g7y: the References
          pill was removed from this header. The style-from-reference flow
          now lives in its own "Copy style" collapsible above, and the
          standalone /style-from-reference/new page is gone.) */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => setShowVisualStyle(!showVisualStyle)}
            className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161]"
            aria-expanded={showVisualStyle}
          >
            Select Visual Style
            <Icon
              name="expand_more"
              size="sm"
              className={`transition-transform ${showVisualStyle ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {showVisualStyle && (
          <div className="mt-4">
            {/* Phase 82 (R7/R8): picker filtered to the selected category's
                curated templateIds subset. */}
            <TemplatePicker
              selectedId={templateId}
              onSelect={setTemplateId}
              brandKit={brandKit}
              category={category}
              dbTemplates={dbTemplates}
            />
          </div>
        )}
      </div>

      {/* Slide Count — collapsible */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => setShowSlideCount(!showSlideCount)}
            className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] ml-1"
            aria-expanded={showSlideCount}
          >
            Number of Slides
            <Icon
              name="expand_more"
              size="sm"
              className={`transition-transform ${showSlideCount ? 'rotate-180' : ''}`}
            />
          </button>
          <span className="text-sm font-bold text-[#3d0000]">{slideCount}</span>
        </div>
        {showSlideCount && (
          <div className="mt-2">
            <input
              type="range"
              min={3}
              max={sliderMax}
              step={1}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              disabled={isPending}
              className="w-full h-1.5 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000] disabled:opacity-50"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#7d6161]">3</span>
              <span className="text-[10px] text-[#7d6161]">{sliderMax}</span>
            </div>
          </div>
        )}
      </div>

      {/* Image Source Toggle — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setShowBackgroundImages(!showBackgroundImages)}
          className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-4 ml-1"
          aria-expanded={showBackgroundImages}
        >
          Background Images
          <Icon
            name="expand_more"
            size="sm"
            className={`transition-transform ${showBackgroundImages ? 'rotate-180' : ''}`}
          />
        </button>
        {showBackgroundImages && (
        <>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setImageSource('stock')}
            disabled={isPending}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              imageSource === 'stock'
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon name="image" size="lg" className={imageSource === 'stock' ? 'text-[#3d0000]' : 'text-[#7d6161]'} />
            <span className={`text-sm font-semibold ${imageSource === 'stock' ? 'text-[#3d0000]' : 'text-[#7d6161]'}`}>
              Stock Photos
            </span>
            <span className="text-[10px] text-[#7d6161]">Included free</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isPaidUser) {
                setShowUpgradePrompt(true)
                return
              }
              setImageSource('ai')
            }}
            disabled={isPending}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              imageSource === 'ai'
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon name="auto_awesome" size="lg" className={imageSource === 'ai' ? 'text-[#3d0000]' : 'text-[#7d6161]'} />
            <span className={`text-sm font-semibold ${imageSource === 'ai' ? 'text-[#3d0000]' : 'text-[#7d6161]'}`}>
              AI Generated
            </span>
            <span className="text-[10px] text-[#7d6161]">
              {isPaidUser ? '1 credit per slide' : 'Hobbyist / Creator only'}
            </span>
          </button>
          {/* No-Photos: text-only slides on the template's flat background.
              Pairs best with color-only templates like Paper Essay or
              Brutalist Grid; on photo-designed templates the slide falls
              back to the template's solid backgroundColor. */}
          <button
            type="button"
            onClick={() => setImageSource('none')}
            disabled={isPending}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              imageSource === 'none'
                ? 'border-[#3d0000] bg-[#fff0f0]'
                : 'border-[#dbc1bc]/20 bg-white hover:border-[#dbc1bc]/40'
            } disabled:opacity-50`}
          >
            <Icon name="text_fields" size="lg" className={imageSource === 'none' ? 'text-[#3d0000]' : 'text-[#7d6161]'} />
            <span className={`text-sm font-semibold ${imageSource === 'none' ? 'text-[#3d0000]' : 'text-[#7d6161]'}`}>
              No Photos
            </span>
            <span className="text-[10px] text-[#7d6161]">Text only</span>
          </button>
        </div>
        {imageSource === 'ai' && (
          <p className="text-[10px] text-[#7d6161] mt-2 ml-1">
            Uses ~{slideCount} credits for AI backgrounds. Takes ~{Math.ceil(slideCount / 2) * 10}-{Math.ceil(slideCount / 2) * 15}s. Slides that fail will use stock photos instead.
          </p>
        )}
        {imageSource === 'none' && (
          <p className="text-[10px] text-[#7d6161] mt-2 ml-1">
            Pure typography on the template&apos;s flat background. Pairs best with Paper Essay, Brutalist Grid, or Editorial Serif.
          </p>
        )}
        </>
        )}
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] ml-1"
        >
          Advanced Options
          <Icon
            name="expand_more"
            size="sm"
            className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-5">
            {/* Font */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2 ml-1">
                Font
              </label>
              <select
                value={advancedFont}
                onChange={(e) => setAdvancedFont(e.target.value)}
                disabled={isPending}
                className="w-full bg-white rounded-xl border-b-2 border-[#dbc1bc]/30 px-4 py-3 text-sm text-[#3d0000] focus:border-[#3d0000] focus:ring-0 disabled:opacity-50"
              >
                <option value="">Template Default</option>
                {Object.entries(fontsByCategory).map(([category, fonts]) => (
                  <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                    {fonts.map((font) => (
                      <option key={font.family} value={font.family}>
                        {font.family}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Font Color */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2 ml-1">
                Font Color
              </label>
              <div className="flex items-center gap-2">
                {['#ffffff', '#3d0000', '#000000', '#7d6161'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAdvancedFontColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      advancedFontColor === color
                        ? 'border-[#3d0000] scale-110'
                        : 'border-[#dbc1bc]/30 hover:border-[#dbc1bc]'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <input
                  type="color"
                  value={advancedFontColor || '#000000'}
                  onChange={(e) => setAdvancedFontColor(e.target.value)}
                  className="w-8 h-8 rounded-full border-2 border-[#dbc1bc]/30 cursor-pointer"
                  title="Custom color"
                />
                {advancedFontColor && (
                  <button
                    type="button"
                    onClick={() => setAdvancedFontColor('')}
                    className="text-[10px] text-[#7d6161] hover:text-[#3d0000] ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* AI Image Prompt */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7d6161] mb-2 ml-1">
                AI Image Style Hint
              </label>
              <textarea
                value={advancedImagePrompt}
                onChange={(e) => setAdvancedImagePrompt(e.target.value)}
                placeholder="e.g. minimalist watercolor illustrations, dark moody photography..."
                rows={2}
                disabled={isPending}
                className="w-full bg-white rounded-xl border-b-2 border-[#dbc1bc]/30 px-4 py-3 text-sm text-[#3d0000] focus:border-[#3d0000] focus:ring-0 resize-none placeholder:text-[#dbc1bc] disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {showUpgradePrompt && (
        <UpgradePrompt context="generation" />
      )}

      {/* Submit */}
      <div className="flex flex-col items-center gap-6">
        <button
          type="submit"
          data-onboarding-id="generate-button"
          disabled={busy || !topic.trim()}
          className="w-full bg-[#3d0000] text-white py-5 rounded-xl font-semibold tracking-wide flex items-center justify-center gap-3 shadow-[0px_20px_40px_rgba(61,0,0,0.1)] hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {uploading
                ? `Uploading ${selectedFiles.length} photo${selectedFiles.length === 1 ? '' : 's'}...`
                : imageSource === 'ai'
                  ? 'Generating with AI images (~30s)...'
                  : 'Generating slides...'}
            </>
          ) : (
            <>
              {hasSlides ? 'Regenerate Carousel' : 'Generate Carousel'}
              <Icon name="bolt" />
            </>
          )}
        </button>
        {!hasSlides && (
          <p className="text-[10px] text-[#7d6161] uppercase tracking-widest font-bold">
            {imageSource === 'ai' ? 'Estimated time: 30-45 seconds' : 'Estimated time: 15 seconds'}
          </p>
        )}
      </div>
    </form>
    </>
  )
}
