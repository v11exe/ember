// Boots Ember, waits for the window + first tab, exits non-zero on failure.
//
// Runs against a throwaway profile: sharing userData with a running instance
// causes storage lock errors and bogus service worker failures.
const { spawn } = require('node:child_process')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const electron = require('electron')

const profile = mkdtempSync(path.join(tmpdir(), 'ember-smoke-'))

const child = spawn(electron, ['.', `--user-data-dir=${profile}`], {
  env: { ...process.env, EMBER_SMOKE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let out = ''
const collect = (chunk) => { out += chunk; process.stdout.write(chunk) }
child.stdout.on('data', collect)
child.stderr.on('data', collect)

const cleanup = () => {
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* best effort */ }
}

const timer = setTimeout(() => {
  console.error('\n[smoke] timed out after 30s')
  child.kill()
  cleanup()
  process.exit(1)
}, 30_000)

child.on('exit', (code) => {
  clearTimeout(timer)
  cleanup()
  const ok = code === 0 && out.includes('[ember] smoke ok')
  console.log(ok ? '\n[smoke] PASS' : `\n[smoke] FAIL (exit ${code})`)
  process.exit(ok ? 0 : 1)
})
