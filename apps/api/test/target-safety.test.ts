import { describe, expect, it } from 'vitest'
import { isBlockedAddress, validatePublicTarget } from '../src/target-safety.js'

describe('target safety', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1'])(
    'blocks %s',
    (address) => expect(isBlockedAddress(address)).toBe(true),
  )

  it('accepts a hostname only when every resolved address is public', async () => {
    const target = await validatePublicTarget(
      'https://provider.example/check',
      async () => [{ address: '93.184.216.34', family: 4 }],
    )
    expect(target.url.hostname).toBe('provider.example')
  })

  it('rejects a hostname with any private answer', async () => {
    await expect(
      validatePublicTarget('https://mixed.example', async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow('Private, local, and reserved')
  })

  it('rejects an insecure HTTP endpoint', async () => {
    await expect(
      validatePublicTarget('http://provider.example/check', async () => [
        { address: '93.184.216.34', family: 4 },
      ]),
    ).rejects.toThrow('Only public HTTPS endpoints')
  })

  it('does not allow the e2e fixture without its explicit runtime flag', async () => {
    await expect(validatePublicTarget('http://127.0.0.1:8788/x402')).rejects.toThrow(
      'Only public HTTPS endpoints',
    )
  })
})
