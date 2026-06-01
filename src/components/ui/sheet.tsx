'use client'

// Phase 93 (EDIT-03): bottom Sheet primitive built on @radix-ui/react-dialog —
// the SAME base the team's dialog.tsx wraps. Zero new dependencies (no vaul).
// Mirrors dialog.tsx structure exactly so the codebase stays consistent; the
// only difference is the Content is anchored to the bottom edge, slides up, and
// is safe-area / dvh aware for the mobile editor tool sheets.
//
// SPEC constraint (inherited from dialog.tsx): closing MUST NOT leave a
// pointer-events-blocking overlay behind. Radix unmounts Overlay + Content when
// state=closed; we add no persistent pointer-events overrides.
//
// Modal by default (Radix default) — the lowest-risk choice per ARCHITECTURE
// Q5; the user taps a tab → sheet opens → adjusts → dismisses to the canvas.

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetPortal = DialogPrimitive.Portal
const SheetClose = DialogPrimitive.Close

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** When true, hides the default top-right close (X) button. */
    hideCloseButton?: boolean
    /** When true, hides the top grab-handle pill. */
    hideHandle?: boolean
  }
>(({ className, children, hideCloseButton = false, hideHandle = false, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Anchored to the bottom edge, full-width, rounded top.
        'fixed inset-x-0 bottom-0 z-50 flex flex-col',
        'bg-white shadow-2xl rounded-t-2xl',
        // Never taller than 85% of the live (dvh) viewport; the body scrolls.
        'max-h-[85dvh]',
        // Safe-area padding so content clears the iOS home indicator.
        'pb-[max(1rem,env(safe-area-inset-bottom))]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
        'focus:outline-none',
        className,
      )}
      {...props}
    >
      {!hideHandle && (
        <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
          <div className="h-1.5 w-10 rounded-full bg-[#dbc1bc]" />
        </div>
      )}
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            'tap-44 absolute right-2 top-2 rounded-full opacity-70 transition-opacity',
            'hover:opacity-100 hover:bg-[#fff0f0]',
            'focus:outline-none focus:ring-2 focus:ring-[#3d0000]/40',
            'disabled:pointer-events-none',
          )}
          aria-label="Close"
        >
          <X className="size-5 text-[#3d0000]" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 flex-col gap-1 px-4 pb-2 text-left', className)}
      {...props}
    />
  )
}
SheetHeader.displayName = 'SheetHeader'

/**
 * Scrollable body for the sheet — keeps overflow inside the `max-h-[85dvh]`
 * container so a tall rail panel scrolls within the sheet (and the focused
 * field rides above the iOS keyboard) rather than past the viewport.
 */
function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto overscroll-contain', className)}
      {...props}
    />
  )
}
SheetBody.displayName = 'SheetBody'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-[11px] font-bold uppercase tracking-widest text-[#3d0000]',
      className,
    )}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[#7d6161]', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
}
