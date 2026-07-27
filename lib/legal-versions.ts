// Single source of truth for legal-document versions. Read by the signup
// acceptance recorder (to write into the terms_acceptances audit trail).
// Bump these whenever you publish a material change to the corresponding
// document — they MUST match the "Version X.Y" line rendered at the top of
// /subscriber-terms, /privacy, and /terms, or the audit trail records a
// version the subscriber was never shown.
export const SUBSCRIBER_TERMS_VERSION = '1.2'  // app/subscriber-terms/page.tsx
export const PRIVACY_POLICY_VERSION = '1.3'    // app/privacy/page.tsx
export const VISITOR_TERMS_VERSION = '1.5'     // app/terms/page.tsx
