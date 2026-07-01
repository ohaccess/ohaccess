import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "./*" path alias.
      '@': root,
      // Neutralize the server-only guard in tests (see test/stubs/server-only.ts).
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
})
