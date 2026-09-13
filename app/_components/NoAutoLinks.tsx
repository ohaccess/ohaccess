import type { Metadata } from 'next'

// Stops phone browsers (iOS Safari/Chrome) from auto-linking phone numbers,
// emails and addresses in visitor/lead tables. Their detector linked only part
// of an address (tapping it opened the wrong email) and ran the link into the
// neighbouring badges. Used by the agent and sponsor dashboard layouts.
export const noAutoLinksMetadata: Metadata = {
  formatDetection: { telephone: false, email: false, address: false },
}

// Neutralizes any link a detector still adds despite the meta tag.
export default function NoAutoLinks() {
  return <style>{'a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;pointer-events:none!important;cursor:text!important;}'}</style>
}
