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

  const timer = setTimeout(() => {
    console.error('\n[smoke] timed out after 30s')
    child.kill()
  }, 30_000)

  const code = await new Promise((resolve) => child.on('exit', resolve))
  clearTimeout(timer)
  await fs.rm(smokeData, { recursive: true, force: true })
  const ok = code === 0 && out.includes('[ember] smoke ok')
  console.log(ok ? '\n[smoke] PASS' : `\n[smoke] FAIL (exit ${code})`)
  process.exitCode = ok ? 0 : 1
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
