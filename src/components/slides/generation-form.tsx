'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { generateCarousel } from '@/app/(dashboard)/project/[id]/actions'
import { createUploadUrl } from '@/app/(dashboard)/project/[id]/editor-actions'
import { validateImageFile } from '@/lib/upload-validation'
import { TemplatePicker } from './template-picker'
import { CategorySelector } from './category-selector'
import { FilePreviewCard, PastedContentCard } from './prompt-attachment-cards'
import { ToolPill } from './prompt-toolbar'
import { DEFAULT_CATEGORY, getCategory } from '@/lib/ai/categories'
import { Icon } from '@/components/ui/icon'
import { LetterCircleLoader } from '@/components/ui/letter-circle-loader'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'
import { useRouter } from 'next/navigation'
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
  userTier?: 'free' | 'pro' | 'plus'
  /** Phase 87 (WIRE-01): DB-backed templates fetched server-side by the
   *  project page and threaded into the picker. Defaults to [] so callers
   *  that don't pass it (tests, legacy contexts) are unaffected. */
  dbTemplates?: PickerDbTemplate[]
  /** When the form is hosted somewhere that can't render the editor itself
   *  (the dashboard), navigate to /project/{projectId} on a successful
   *  generation instead of refreshing the current route. Defaults to false
   *  so the /project/[id] page keeps its in-place refresh-into-editor flow. */
  redirectToEditorOnSuccess?: boolean
}

export function GenerationForm({
  projectId,
  currentTopic,
  currentTemplateId,
  currentCategory,
  userTier = 'free',
  dbTemplates = [],
  redirectToEditorOnSuccess = false,
}: GenerationFormProps) {
  // Phase 87 (WIRE-02): an id belongs to a category if it is a code template
  // in that category's curated templateIds OR a DB template (from dbTemplates)
  // whose row category matches. Used by both snap sites so they stay in sync —
  // a DB template id of the matching category is no longer discarded.
  function idBelongsToCategory(id: string, categoryId: string): boolean {
    const mod = getCategory(categoryId)
    if (mod && mod.templateIds.includes(id)) return true
    return dbTemplates.some((d) => d.template.id === id && d.category === categoryId)
  }

  const [topic, setTopic] = useState(currentTopic ?? '')
  // Phase 82 (R6): the selected content category drives Gemini's copy.
  // Defaults to News (the reported pain point + primary deliverable).
  const [category, setCategory] = useState<string>(
    currentCategory && getCategory(currentCategory) ? currentCategory : DEFAULT_CATEGORY,
  )
  // Phase 82 (R7): seed the template from the category's curated set so the
  // picker never starts on the legacy 'highlight-bar' fallback.
  // Phase 87 (WIRE-02): keep a saved project's templateId when it belongs to
  // the effective category — a code template in the category OR a DB template
  // (from dbTemplates) whose row category matches. Else snap to the category
  // default. A selected DB template id is no longer silently discarded.
  const [templateId, setTemplateId] = useState(() => {
    const effectiveCategory =
      currentCategory && getCategory(currentCategory) ? currentCategory : DEFAULT_CATEGORY
    const mod = getCategory(effectiveCategory)!
    return currentTemplateId && idBelongsToCategory(currentTemplateId, effectiveCategory)
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
  // Which tool-pill panel is expanded below the prompt card (null = none).
  const [activePanel, setActivePanel] = useState<'visual' | 'slides' | 'images' | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  // Long text pastes are captured as removable cards instead of flooding the
  // prompt field; their content is folded back into the topic on submit.
  const [pastedContent, setPastedContent] = useState<{ id: string; content: string }[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  const previewUrls = useMemo(
    () => selectedFiles.map((f) => URL.createObjectURL(f)),
    [selectedFiles]
  )
  useEffect(() => {
    return () => {
      previewUrls.forEach(URL.revokeObjectURL)
    }
  }, [previewUrls])

  // Auto-grow the prompt textarea with its content, up to a max height.
  useEffect(() => {
    const el = promptRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 384)}px`
  }, [topic])

  const busy = isPending || uploading
  const canSubmit = !busy && (topic.trim().length > 0 || pastedContent.length > 0)

  function addFiles(picked: File[]) {
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
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!busy) setIsDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (!busy) addFiles(Array.from(e.dataTransfer.files ?? []))
  }

  // Image pastes attach as files; a long text paste is captured as a card
  // rather than dumped into the prompt field. Short pastes fall through.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pastedFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((f): f is File => f != null)
    if (pastedFiles.length > 0) {
      e.preventDefault()
      addFiles(pastedFiles)
      return
    }
    const text = e.clipboardData.getData('text')
    if (text.length > 300) {
      e.preventDefault()
      setPastedContent((prev) => [
        ...prev,
        { id: Math.random().toString(36).slice(2, 11), content: text },
      ])
    }
  }

  function removeFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // Phase 82 (R6, R7): switching the category re-aligns the template picker.
  // Phase 87 (WIRE-02): snap to the category default ONLY when the current
  // templateId does not belong to the new category — a code template in the
  // category OR a DB template whose row category matches. A DB id of the
  // newly-selected category is kept (the snap fires only for genuinely
  // cross-category ids).
  function handleCategoryChange(id: string) {
    setCategory(id)
    const mod = getCategory(id)
    if (mod && !idBelongsToCategory(templateId, id)) {
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

  // On a successful generation: the /project/[id] page refreshes in place
  // (it re-renders into the editor); a host that can't render the editor
  // (the dashboard) navigates to the project route instead.
  function handleGenerationSuccess() {
    if (redirectToEditorOnSuccess) {
      router.push(`/project/${projectId}`)
    } else {
      router.refresh()
    }
  }

  function submitGeneration() {
    // Fold any pasted-content cards back into the topic; cap at the 2000-char
    // generation budget.
    const effectiveTopic = [topic.trim(), ...pastedContent.map((c) => c.content)]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2000)
    if (!effectiveTopic.trim() || busy) return

    setError(null)
    setShowUpgradePrompt(false)
    const effectiveSlideCount = slideCount

    startTransition(async () => {
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
        effectiveTopic,
        templateId,
        imageSource,
        effectiveSlideCount,
        {
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
        handleGenerationSuccess()
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitGeneration()
  }

  // Enter submits; Shift+Enter inserts a newline.
  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitGeneration()
    }
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
      {/* Prompt input — chat-style card */}
      <div>
        <div
          className="relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col rounded-2xl border border-[#dbc1bc]/40 bg-white shadow-[0_2px_15px_rgba(61,0,0,0.06)] hover:shadow-[0_2px_20px_rgba(61,0,0,0.09)] focus-within:shadow-[0_2px_24px_rgba(61,0,0,0.12)] focus-within:border-[#3d0000]/40 transition-shadow">
            <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
              {/* Attachments — pasted snippets then files */}
              {(pastedContent.length > 0 || selectedFiles.length > 0) && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 px-1">
                  {pastedContent.map((c) => (
                    <PastedContentCard
                      key={c.id}
                      content={c.content}
                      onRemove={() =>
                        setPastedContent((prev) => prev.filter((p) => p.id !== c.id))
                      }
                    />
                  ))}
                  {selectedFiles.map((file, idx) => (
                    <FilePreviewCard
                      key={`${file.name}-${idx}`}
                      file={file}
                      previewUrl={previewUrls[idx] ?? null}
                      uploading={uploading}
                      onRemove={() => removeFile(idx)}
                    />
                  ))}
                </div>
              )}

              {/* Prompt textarea — auto-resizing */}
              <div className="max-h-96 overflow-y-auto hide-scrollbar px-1">
                <textarea
                  ref={promptRef}
                  data-onboarding-id="topic-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={handlePromptKeyDown}
                  placeholder="e.g. 5 tips for growing your Instagram following, benefits of morning routines, how to start investing..."
                  rows={1}
                  disabled={busy}
                  maxLength={2000}
                  className="w-full bg-transparent border-0 outline-none resize-none text-[#3d0000] text-base placeholder:text-[#dbc1bc] py-1.5 leading-relaxed min-h-[3rem] disabled:opacity-50"
                />
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || selectedFiles.length >= MAX_UPLOADS}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-[#7d6161] hover:text-[#3d0000] hover:bg-[#fff0f0] transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Attach photos for the slideshow"
                  title="Attach photos for the slideshow"
                >
                  <Icon name="add" size="lg" />
                </button>

                <button
                  type="submit"
                  data-onboarding-id="generate-button"
                  disabled={!canSubmit}
                  className={`flex items-center justify-center h-8 w-8 rounded-xl transition-all active:scale-95 ${
                    canSubmit
                      ? 'bg-[#3d0000] text-white hover:opacity-90 shadow-sm'
                      : 'bg-[#3d0000]/25 text-white/70 cursor-not-allowed'
                  }`}
                  aria-label="Generate carousel"
                  title="Generate carousel"
                >
                  <Icon name="arrow_upward" size="md" />
                </button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
            className="hidden"
          />

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-[#fff0f0]/90 border-2 border-dashed border-[#3d0000] rounded-2xl z-20 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
              <Icon name="upload" size="xl" className="text-[#3d0000] mb-1" />
              <p className="text-[#3d0000] font-medium text-sm">Drop images to attach</p>
            </div>
          )}
        </div>

        {/* Photo / slide-count helper */}
        {selectedFiles.length > 0 && (() => {
          const photos = selectedFiles.length
          const slides = slideCount
          if (photos === slides) {
            return (
              <p className="text-[10px] text-[#7d6161] mt-2 px-1">
                All {photos} photo{photos === 1 ? '' : 's'} will be matched to your {slides} slide{slides === 1 ? '' : 's'} by content.
              </p>
            )
          }
          if (photos < slides) {
            const remaining = slides - photos
            return (
              <p className="text-[10px] text-[#7d6161] mt-2 px-1">
                {photos} photo{photos === 1 ? '' : 's'} will be placed on the most relevant slide{photos === 1 ? '' : 's'}; the remaining {remaining} will {imageSource === 'none' ? 'be text-only on the template background' : `use ${imageSource === 'ai' ? 'AI' : 'stock'}`}.
              </p>
            )
          }
          const ignored = photos - slides
          return (
            <p className="text-[10px] text-red-700 mt-2 px-1">
              Only {slides} of your {photos} photos will be used (carousel limited to {slides} slide{slides === 1 ? '' : 's'}). Increase the slide count or remove {ignored} photo{ignored === 1 ? '' : 's'}.
            </p>
          )
        })()}
      </div>

      {/* Tool pills — open one option panel at a time */}
      <div>
        <div className="flex flex-wrap justify-center gap-2">
          <ToolPill
            icon="palette"
            label="Visual Style"
            active={activePanel === 'visual'}
            onClick={() => setActivePanel((p) => (p === 'visual' ? null : 'visual'))}
          />
          <ToolPill
            icon="tag"
            label="Slide Number"
            active={activePanel === 'slides'}
            onClick={() => setActivePanel((p) => (p === 'slides' ? null : 'slides'))}
          />
          <ToolPill
            icon="image"
            label="Images"
            active={activePanel === 'images'}
            onClick={() => setActivePanel((p) => (p === 'images' ? null : 'images'))}
          />
        </div>

        {activePanel && (
          <div className="mt-4 rounded-xl border border-[#dbc1bc]/40 bg-white p-4">
            {/* Visual Style — content category + template grid */}
            {activePanel === 'visual' && (
              <div className="space-y-6">
                <CategorySelector
                  selected={category}
                  onSelect={handleCategoryChange}
                  disabled={isPending}
                />
                {/* Phase 82 (R7/R8): picker filtered to the selected category's
                    curated templateIds subset. */}
                <TemplatePicker
                  selectedId={templateId}
                  onSelect={setTemplateId}
                  category={category}
                  dbTemplates={dbTemplates}
                />
              </div>
            )}

            {/* Slide Number */}
            {activePanel === 'slides' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161]">
                    Number of Slides
                  </span>
                  <span className="text-sm font-bold text-[#3d0000]">{slideCount}</span>
                </div>
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

            {/* Images — background image source */}
            {activePanel === 'images' && (
              <div>
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
                  {/* No-Photos: text-only slides on the template's flat
                      background. Pairs best with color-only templates. */}
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
              </div>
            )}
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
    </form>
    </>
  )
}
