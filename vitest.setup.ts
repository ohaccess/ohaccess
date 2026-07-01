// Some lib modules construct a Supabase client at import time, which requires
// these env vars to be present (the client is built, not called, in unit
// tests). Provide throwaway values so importing those modules doesn't throw.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
