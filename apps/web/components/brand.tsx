export function PulseMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className="pulse-mark">
      <path
        d="M3 14h5l2.4-7 5.2 14 2.8-7H25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StatusGlyph({ status }: { status: string }) {
  if (status === 'pass') return <span className="status-glyph">✓</span>
  if (status === 'fail') return <span className="status-glyph">×</span>
  if (status === 'warning') return <span className="status-glyph">!</span>
  return <span className="status-glyph">—</span>
}
