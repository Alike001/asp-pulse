import { spawnSync } from 'node:child_process'
import { runProduct } from './processes.mjs'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const build = spawnSync(npm, ['run', 'build:services'], { stdio: 'inherit' })

if (build.status !== 0) process.exit(build.status ?? 1)
runProduct('dev')
