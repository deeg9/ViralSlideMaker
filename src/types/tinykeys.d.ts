/**
 * Phase 60 (60-04): tinykeys@3.0.0 ships type declarations at
 * `node_modules/tinykeys/dist/tinykeys.d.ts`, but its `exports` field only
 * declares `import` and `require` conditions (no `types` condition). Under
 * tsconfig `moduleResolution: "bundler"`, TypeScript follows the `exports`
 * map and never falls back to the legacy root-level `"types"` field, so it
 * resolves the import to the .module.js file and reports TS7016.
 *
 * Re-declare the public surface here. Mirrors `node_modules/tinykeys/dist/tinykeys.d.ts`.
 * If tinykeys publishes a patch with proper `types` exports, this file can be deleted.
 */
declare module 'tinykeys' {
  export type KeyBindingPress = [mods: string[], key: string | RegExp]

  export interface KeyBindingMap {
    [keybinding: string]: (event: KeyboardEvent) => void
  }

  export interface KeyBindingHandlerOptions {
    /** Sequence timeout between key presses (default 1000ms). */
    timeout?: number
  }

  export interface KeyBindingOptions extends KeyBindingHandlerOptions {
    /** Event to listen on (default 'keydown'). */
    event?: 'keydown' | 'keyup'
    /** Use a capture listener (default false). */
    capture?: boolean
  }

  export function parseKeybinding(str: string): KeyBindingPress[]

  export function matchKeyBindingPress(
    event: KeyboardEvent,
    binding: KeyBindingPress,
  ): boolean

  export function createKeybindingsHandler(
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingHandlerOptions,
  ): EventListener

  /**
   * Subscribes to keybindings. Returns an unsubscribe function.
   *
   * @example
   * ```ts
   * const unsubscribe = tinykeys(window, {
   *   '$mod+a': (e) => { e.preventDefault(); selectAll() },
   * })
   * ```
   */
  export function tinykeys(
    target: Window | HTMLElement,
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingOptions,
  ): () => void
}
