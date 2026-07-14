import type { Metadata } from 'next'
import './globals.css'
import './landing.css'
import './product.css'
import './evidence.css'
import './report.css'
import './responsive.css'

export const metadata: Metadata = {
  title: 'ASP Pulse — Know before you pay',
  description: 'Deterministic pre-payment health checks for OKX.AI services.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
