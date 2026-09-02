#!/usr/bin/env node
'use strict';

// Capture the built native Ember shell at the exact viewports the committed
// Electron oracle was captured at, so the two can be compared pixel for pixel.
//
// Everything is driven through Chromium's own remote debugging port. Synthetic
// keyboard and mouse are deliberately avoided: they go to whichever window has
// focus, which steals the developer's input and stops arriving the moment
// anything else comes forward. CDP talks to one target regardless of focus.
//
//   node chromium/tools/capture-native.js --out <dir> [--work-root PATH]
//                                         [--port 9222] [--display-x -1060]
//
// The window is placed on a secondary display by default so a long capture run
// does not sit on top of whatever the developer is doing.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const port = require('./port');

// The oracle's promoted geometry, from chromium/reference/electron/<oracle>/.
const VIEWPORTS = [
  { name: 'wide', width: 1570, height: 796 },
  { name: 'medium', width: 900, height: 556 },
  { name: 'compact', width: 620, height: 336 },
];

// A page whose colour cannot be mistaken for chrome, so the shell's own
// geometry is unambiguous in the capture.
const PROBE_PAGE = 'data:text/html,<title>Ember Native Shell</title>'
  + '<body style="margin:0;background:%2300FF66"></body>';

function parseArgs(argv) {
  const options = { out: null, workRoot: undefined, port: 9222, displayX: -1060, displayY: -560 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      index += 1;
      return value;
    };
    if (flag === '--out') options.out = next();
    else if (flag === '--work-root') options.workRoot = next();
    else if (flag === '--port') options.port = Number(next());
    else if (flag === '--display-x') options.displayX = Number(next());
    else if (flag === '--display-y') options.displayY = Number(next());
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!options.out) throw new Error('--out <dir> is required');
  return options;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

async function waitForBrowser(debugPort, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await httpGet(`http://127.0.0.1:${debugPort}/json/version`));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Native Ember never exposed CDP on ${debugPort}: ${lastError?.message}`);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const client = new Cdp(socket);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = client.pending.get(message.id);
      if (!entry) return;
      client.pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
    return client;
  }

  send(method, params = {}, sessionId = undefined) {
    const id = (this.nextId += 1);
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() { this.socket.close(); }
}

async function capture(options) {
  const paths = port.getPortPaths(options.workRoot);
  if (!fs.existsSync(paths.executable)) {
    throw new Error(`Native Ember binary is missing; build it first: ${paths.executable}`);
  }
  fs.mkdirSync(options.out, { recursive: true });

  // A capture profile of its own, so a run never disturbs the developer's
  // isolated runtime profile or inherits its window state.
  const profile = path.join(paths.workRoot, `profile-capture-${options.port}`);
  fs.mkdirSync(profile, { recursive: true });

  const child = spawn(paths.executable, [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${options.port}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--window-position=${options.displayX},${options.displayY}`,
    PROBE_PAGE,
  ], { detached: false, stdio: 'ignore' });

  const captured = [];
  let client = null;
  try {
    const version = await waitForBrowser(options.port);
    const browser = await Cdp.connect(version.webSocketDebuggerUrl);
    client = browser;

    const { targetInfos } = await browser.send('Target.getTargets');
    const page = targetInfos.find((target) => target.type === 'page');
    if (!page) throw new Error('native Ember exposed no page target');
    const { sessionId } = await browser.send('Target.attachToTarget',
      { targetId: page.targetId, flatten: true });

    const { windowId } = await browser.send('Browser.getWindowForTarget',
      { targetId: page.targetId });

    for (const viewport of VIEWPORTS) {
      // The oracle's numbers are the window's inner size. Chromium sizes the
      // whole window here, so the shell is captured in the same frame the
      // Electron reference used rather than an inner rect that excludes it.
      await browser.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          left: options.displayX,
          top: options.displayY,
          width: viewport.width,
          height: viewport.height,
          windowState: 'normal',
        },
      });
      // Let the compositor settle: a screenshot taken during a resize catches
      // the old surface, which silently invalidates a geometry comparison.
      await new Promise((resolve) => setTimeout(resolve, 900));

      const shot = await browser.send('Page.captureScreenshot',
        { format: 'png', captureBeyondViewport: false }, sessionId);
      const file = path.join(options.out, `native-${viewport.name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const bounds = await browser.send('Browser.getWindowBounds', { windowId });
      captured.push({ ...viewport, file, actual: bounds.bounds });
      console.log(`captured ${viewport.name} -> ${file}`);
    }

    fs.writeFileSync(
      path.join(options.out, 'native-capture.json'),
      `${JSON.stringify({
        capturedAt: new Date().toISOString(),
        executable: paths.executable,
        oracle: port.readBaseline().electronOracle.referenceCommit,
        viewports: captured,
      }, null, 2)}\n`,
    );

    // Close through the browser rather than killing the process, so the same
    // run also demonstrates a clean shutdown.
    await browser.send('Browser.close').catch(() => {});
  } finally {
    if (client) client.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    try { child.kill(); } catch { /* already gone */ }
  }
  return captured;
}

if (require.main === module) {
  capture(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { VIEWPORTS, parseArgs, capture };
