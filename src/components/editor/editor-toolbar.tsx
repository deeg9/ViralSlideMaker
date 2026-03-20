'use client'

import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

interface EditorToolbarProps {
  title?: string
  saveStatus?: 'idle' | 'saving' | 'saved'
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  slideCount: number
}

export function EditorToolbar({
  title,
  saveStatus = 'idle',
  onAdd,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  slideCount,
}: EditorToolbarProps) {
  return (
    <div
      className="flex items-center justify-between w-full px-4 py-2 bg-[#fff8f7] border-b border-[#dbc1bc]/10"
      data-testid="editor-toolbar"
    >
      {/* Left: back + title + slide actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 text-[#795e5e] hover:bg-[#fadbdb] rounded-xl transition-colors"
          title="Back to dashboard"
        >
          <Icon name="arrow_back" size="sm" />
        </Link>
        {title && (
          <span className="text-sm font-semibold text-[#3d0000] truncate max-w-[200px] hidden sm:block">
            {title}
          </span>
        )}
        {saveStatus !== 'idle' && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        )}
        <div className="h-5 w-px bg-[#dbc1bc]/30 mx-1" />
        <button
          onClick={onAdd}
          className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95"
          title="Add Slide"
        >
          <Icon name="add" size="sm" />
        </button>
        <button
          onClick={onDuplicate}
          className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95"
          title="Duplicate Slide"
        >
          <Icon name="content_copy" size="sm" />
        </button>
        <button
          onClick={onDelete}
          disabled={slideCount <= 1}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete Slide"
        >
          <Icon name="delete" size="sm" />
        </button>
      </div>

      {/* Right: undo/redo + export */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo"
        >
          <Icon name="undo" size="sm" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 text-[#795e5e] hover:bg-[#fadbdb] rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo"
        >
          <Icon name="redo" size="sm" />
        </button>
        <div className="h-5 w-px bg-[#dbc1bc]/30 mx-1" />
        <button className="px-4 py-1.5 bg-[#3d0000] text-white rounded-xl font-medium flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all text-sm">
          <Icon name="download" size="sm" />
          <span>Export</span>
        </button>
      </div>
    </div>
  )
}
