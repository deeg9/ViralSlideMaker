'use client'

import { Plus, Copy, Trash2, Undo2, Redo2 } from 'lucide-react'

interface EditorToolbarProps {
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
    <div className="flex items-center gap-1 p-2 border-b border-border bg-background" data-testid="editor-toolbar">
      <button
        onClick={onAdd}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors min-w-[44px] min-h-[44px]"
        title="Add Slide"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Add</span>
      </button>

      <button
        onClick={onDuplicate}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors min-w-[44px] min-h-[44px]"
        title="Duplicate Slide"
      >
        <Copy className="w-4 h-4" />
        <span className="hidden sm:inline">Duplicate</span>
      </button>

      <button
        onClick={onDelete}
        disabled={slideCount <= 1}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px]"
        title="Delete Slide"
      >
        <Trash2 className="w-4 h-4" />
        <span className="hidden sm:inline">Delete</span>
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px]"
        title="Undo"
      >
        <Undo2 className="w-4 h-4" />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px]"
        title="Redo"
      >
        <Redo2 className="w-4 h-4" />
      </button>
    </div>
  )
}
