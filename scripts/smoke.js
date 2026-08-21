// Boots Ember, waits for the window + first tab, exits non-zero on failure.
const { spawn } = require('node:child_process')
const electron = require('electron')

const child = spawn(electron, ['.'], {
  env: { ...process.env, EMBER_SMOKE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let out = ''
const collect = (chunk) => { out += chunk; process.stdout.write(chunk) }
child.stdout.on('data', collect)
child.stderr.on('data', collect)

const timer = setTimeout(() => {
  console.error('\n[smoke] timed out after 30s')
  child.kill()
  process.exit(1)
}, 30_000)

child.on('exit', (code) => {
  clearTimeout(timer)
  const ok = code === 0 && out.includes('[ember] smoke ok')
  console.log(ok ? '\n[smoke] PASS' : `\n[smoke] FAIL (exit ${code})`)
  process.exit(ok ? 0 : 1)
})
