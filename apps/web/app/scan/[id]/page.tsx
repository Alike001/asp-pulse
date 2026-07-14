import { Report } from '@/components/report'
import { SiteHeader } from '@/components/site-header'

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main>
      <SiteHeader />
      <section className="shell document">
        <Report id={id} />
      </section>
    </main>
  )
}
