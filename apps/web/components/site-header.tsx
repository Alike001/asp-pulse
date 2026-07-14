import Link from 'next/link'
import { PulseMark } from './brand'

export function SiteHeader() {
  return (
    <header className="site-header shell">
      <Link className="brand" href="/" aria-label="ASP Pulse home">
        <PulseMark />
        <span>ASP Pulse</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/#network">Network Pulse</Link>
        <Link href="/methodology">Methodology</Link>
        <Link href="/api-reference">API</Link>
      </nav>
      <a className="nav-action" href="/#scanner">
        Check a service
      </a>
    </header>
  )
}
