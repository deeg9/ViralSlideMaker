---
phase: 07-ai-images-social-captions
plan: 02
subsystem: editor-ui
tags: [imagen, captions, ui, editor, free-user-gate]
dependency_graph:
  requires: [07-01]
  provides: [ai-generate-tab, caption-panel, editor-imagen-integration]
  affects: [image-picker-panel, slide-editor, project-page]
tech_stack:
  added: []
  patterns: [useTransition-double-click-prevention, hooks-before-conditional-return, clipboard-api, platform-tabs]
key_files:
  created:
    - src/components/editor/ai-generate-tab.tsx
    - src/components/captions/caption-panel.tsx
  modified:
    - src/components/editor/image-picker-panel.tsx
    - src/components/editor/slide-editor.tsx
    - src/app/(dashboard)/project/[id]/page.tsx
decisions:
  - "Hooks before conditional return: all useState/useEffect/useTransition declared before free-user gate early return to comply with Rules of Hooks"
  - "Caption panel renders below editor grid div, not as modal, matching UI-SPEC layout contract"
  - "userTier flows from server component (project page) through SlideEditor to ImagePickerPanel to AIGenerateTab"
metrics:
  duration: "4 min"
  completed: "2026-03-26"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 3
---

# Phase 07 Plan 02: AI Generate Tab & Caption Panel UI Summary

AI image generation tab with free-user gate, auto-prompt editing, credit badge, and multi-platform caption panel with clipboard copy

## What Was Built

### AIGenerateTab (`src/components/editor/ai-generate-tab.tsx`)
- Free user gate: renders UpgradePrompt with `context="feature_gate"` for free-tier users (IMAGEN-03)
- Auto-generates image prompt on mount via `generateImagePromptAction` with skeleton pulse loading state
- Editable textarea with auto-populated prompt (IMAGEN-04), credit cost badge ("1 credit")
- Generate button using `useTransition` for double-click prevention with spinner and progress text
- All error states: safety-filtered (with refund message), insufficient credits (with subscription link), API error (with refund message)
- Success state: applies generated image URL to slide background via `onUpdate`

### CaptionPanel (`src/components/captions/caption-panel.tsx`)
- Three platform tabs: TikTok (tag icon), Instagram (photo_camera icon), LinkedIn (work icon)
- Proper ARIA: role="tablist", role="tab", role="tabpanel"
- Copy-to-clipboard per platform with icon feedback (content_copy -> check for 2 seconds)
- Regenerate captions button with loading spinner
- Close button, skeleton loading, error state with retry
- No credits consumed for captions (no credit badge)

### Editor Integration
- ImagePickerPanel: third "AI Generate" tab alongside Search and Upload
- SlideEditor: "Generate Captions" button in footer, CaptionPanel renders below editor grid
- Project page: fetches `userTier` via `getUserTier` and passes through component tree

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | AI Generate tab + caption panel components | 2b2ce4f | ai-generate-tab.tsx, caption-panel.tsx |
| 2 | Wire AI tab and caption panel into editor | adc6fe7 | image-picker-panel.tsx, slide-editor.tsx, page.tsx |
| 3 | Visual verification checkpoint | -- | Awaiting human verification |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React Rules of Hooks violation in AIGenerateTab**
- **Found during:** Task 1
- **Issue:** Initial implementation had early return for free-user gate before useEffect hook, violating React's Rules of Hooks (hooks must not be called conditionally)
- **Fix:** Moved all hooks (useState, useEffect, useTransition) before the conditional return; added `userTier === 'free'` guard inside useEffect to skip prompt generation for free users
- **Files modified:** src/components/editor/ai-generate-tab.tsx
- **Commit:** 2b2ce4f

## Verification Results

- TypeScript: compiles without errors (no errors in new/modified files)
- Plan 01 backend tests: 12/12 passing (imagen + captions)
- All acceptance criteria grep checks pass

## Known Stubs

None -- all components are wired to real server actions from Plan 01.

## Self-Check: PASSED

- FOUND: src/components/editor/ai-generate-tab.tsx
- FOUND: src/components/captions/caption-panel.tsx
- FOUND: commit 2b2ce4f
- FOUND: commit adc6fe7
- Task 3 checkpoint awaiting human verification
