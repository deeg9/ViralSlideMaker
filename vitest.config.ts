import { defineConfig } from 'vitest/config'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    // Extend the vitest defaults (node_modules, dist, config files, …) with
    // `.claude/worktrees/**` — nested agent worktrees keep stale copies of the
    // test files, which the default glob would otherwise collect and surface
    // as phantom duplicate failures.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
