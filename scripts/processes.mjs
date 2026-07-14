import { spawn } from 'node:child_process'

export function runProduct(mode) {
  const api = spawn(process.execPath, ['apps/api/dist/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, API_PORT: process.env.API_PORT ?? '8787' },
  })
  const next = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      mode,
      'apps/web',
      '--port',
      process.env.WEB_PORT ?? '3000',
    ],
    { stdio: 'inherit', env: { ...process.env, PORT: process.env.WEB_PORT ?? '3000' } },
  )
  const children = [api, next]

  function stop(signal) {
    for (const child of children) child.kill(signal)
  }
  process.on('SIGINT', () => stop('SIGINT'))
  process.on('SIGTERM', () => stop('SIGTERM'))

  for (const child of children) {
    child.on('exit', (code) => {
      if (code && code !== 0) {
        stop('SIGTERM')
        process.exitCode = code
      }
    })
  }
}
