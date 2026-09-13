import NoAutoLinks, { noAutoLinksMetadata } from '../_components/NoAutoLinks'

export const metadata = noAutoLinksMetadata

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NoAutoLinks />
      {children}
    </>
  )
}
