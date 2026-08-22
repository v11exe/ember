// Boots Ember, waits for the window + first tab, exits non-zero on failure.
//
// Runs against a throwaway profile: sharing userData with a running instance
// causes storage lock errors and bogus service worker failures.
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const electron = require('electron')

async function run() {
  const smokeData = await fs.mkdtemp(path.join(os.tmpdir(), 'ember-smoke-'))
  const child = spawn(electron, ['.', `--user-data-dir=${smokeData}`], {
    env: { ...process.env, EMBER_SMOKE: '1', EMBER_SMOKE_USER_DATA: smokeData },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let out = ''
  const collect = (chunk) => { out += chunk; process.stdout.write(chunk) }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)

  // A throwaway profile means every run pays cold-start: ~40s here versus
  // ~22s warm. 30s sat between the two and failed most runs.
  const TIMEOUT_MS = 120_000
  const started = Date.now()

  const timer = setTimeout(() => {
    console.error(`\n[smoke] timed out after ${TIMEOUT_MS / 1000}s`)
    child.kill()
  }, TIMEOUT_MS)

  const code = await new Promise((resolve) => child.on('exit', resolve))
  clearTimeout(timer)
  await fs.rm(smokeData, { recursive: true, force: true })
  const ok = code === 0 && out.includes('[ember] smoke ok')
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(ok ? `\n[smoke] PASS (${seconds}s)` : `\n[smoke] FAIL (exit ${code}, ${seconds}s)`)
  process.exitCode = ok ? 0 : 1
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
