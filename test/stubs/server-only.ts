// Test stub for the `server-only` package. The real package throws when
// imported outside a React Server Component bundle, which would break Vitest
// (plain Node). Aliased in vitest.config.ts so server-only modules can be
// unit-tested. Production builds still use the real guard.
export {}
