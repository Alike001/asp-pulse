import { spawn } from 'node:child_process'

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: environment })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`))
    })
  })
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const environment = {
  ...process.env,
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8787',
  NEXT_PUBLIC_PULSE_E2E_FIXTURE: '1',
}

await run(npm, ['run', 'build'], environment)
await run(npx, ['playwright', 'test'], environment)
