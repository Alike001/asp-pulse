import { loadCanaryConfig } from './config.js'

const config = loadCanaryConfig()

if (!config.enabled) {
  console.log('ASP Pulse worker ready. Paid canary is disabled; no funds can be spent.')
} else {
  throw new Error(
    'Paid canary was enabled without an approved payment adapter. Refusing to start.',
  )
}
