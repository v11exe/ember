#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHROMIUM_ROOT = path.join(REPO_ROOT, 'chromium');
const BASELINE_PATH = path.join(CHROMIUM_ROOT, 'baseline.json');
const PATCHES_ROOT = path.join(CHROMIUM_ROOT, 'patches');
const SERIES_PATH = path.join(PATCHES_ROOT, 'series');
const DEFAULT_WORK_ROOT = 'C:\\src\\ember-chromium';
const MANAGED_SERIES_BEGIN = '# BEGIN EMBER PORT PATCHES - managed by chromium/tools/port.js';
const MANAGED_SERIES_END = '# END EMBER PORT PATCHES';
const GIB = 1024 ** 3;

function readBaseline() {
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function normalizeForComparison(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPathWithin(candidate, parent) {
  const childPath = normalizeForComparison(candidate);
  const parentPath = normalizeForComparison(parent);
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeWorkRoot(candidate, repoRoot = REPO_ROOT) {
  if (!candidate || typeof candidate !== 'string') {
    throw new Error('A Chromium work root is required.');
  }

  const resolved = path.resolve(candidate);
  if (resolved === path.parse(resolved).root) {
    throw new Error(`Refusing to use a filesystem root as the work root: ${resolved}`);
  }
  if (isPathWithin(resolved, repoRoot)) {
    throw new Error(`The Chromium work root must be outside the Ember repository: ${resolved}`);
  }
  if (isPathWithin(repoRoot, resolved)) {
    throw new Error(`The Chromium work root must not contain the Ember repository: ${resolved}`);
  }
  return resolved;
}

function getPortPaths(workRootValue) {
  const workRoot = assertSafeWorkRoot(workRootValue);
  const configurationRoot = path.join(workRoot, 'configuration');
  return {
    workRoot,
    configurationRoot,
    sourceRoot: path.join(configurationRoot, 'build', 'src'),
    outputRoot: path.join(configurationRoot, 'build', 'src', 'out', 'Default'),
    executable: path.join(configurationRoot, 'build', 'src', 'out', 'Default', 'chrome.exe'),
    profileRoot: path.join(workRoot, 'profile'),
    stampPath: path.join(configurationRoot, '.ember-port.json'),
  };
}

function displayCommand(command, args) {
  return [command, ...args].map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(' ');
}

function normalizeCapturedOutput(output) {
  return String(output || '').trimEnd();
}

function runCaptured(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env || process.env,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`${displayCommand(command, args)} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(
      `${displayCommand(command, args)} exited with ${result.status}${details ? `:\n${details}` : ''}`,
    );
  }
  // Porcelain Git output uses a meaningful leading status column. Preserve it
  // while still removing the final newline emitted by normal commands.
  return normalizeCapturedOutput(result.stdout);
}

function runInherited(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    stdio: 'inherit',
    windowsHide: false,
  });
  if (result.error) {
    throw new Error(`${displayCommand(command, args)} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${displayCommand(command, args)} exited with ${result.status}`);
  }
}

function tryCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function parseVersionTuple(text) {
  const match = String(text).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return match ? match.slice(1).map((part) => Number(part || 0)) : null;
}

function versionAtLeast(actual, minimum) {
  const length = Math.max(actual.length, minimum.length);
  for (let index = 0; index < length; index += 1) {
    const left = actual[index] || 0;
    const right = minimum[index] || 0;
    if (left !== right) return left > right;
  }
  return true;
}

function commitFromLsRemote(output, tag) {
  const reference = `refs/tags/${tag}`;
  const rows = String(output)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/));
  const peeled = rows.find(([, ref]) => ref === `${reference}^{}`);
  const direct = rows.find(([, ref]) => ref === reference);
  return (peeled || direct || [])[0] || null;
}

function verifyUpstreamBaselines(baseline = readBaseline()) {
  const targets = [
    ['Chromium', baseline.chromium],
    ['Windows configuration', baseline.buildConfiguration],
    ['Common configuration', baseline.buildConfiguration.commonSubmodule],
  ];
  for (const [label, target] of targets) {
    const reference = `refs/tags/${target.tag}`;
    const output = runCaptured('git', [
      'ls-remote', '--tags', target.repository, reference, `${reference}^{}`,
    ]);
    const actual = commitFromLsRemote(output, target.tag);
    if (actual !== target.commit) {
      throw new Error(
        `${label} tag ${target.tag} resolves to ${actual || 'nothing'}; expected ${target.commit}`,
      );
    }
    console.log(`Verified ${label} ${target.tag} at ${actual}`);
  }
}

function findPython() {
  const candidates = [];
  if (process.env.PYTHON) candidates.push({ command: process.env.PYTHON, prefix: [] });
  candidates.push(
    { command: 'python', prefix: [] },
    { command: 'python3', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  );

  for (const candidate of candidates) {
    const output = tryCommand(candidate.command, [...candidate.prefix, '--version']);
    const version = output && parseVersionTuple(output);
    if (version) return { ...candidate, output, version };
  }
  return null;
}

function registryValue(key, name) {
  const output = tryCommand('reg.exe', ['query', key, '/v', name]);
  if (!output) return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`${escapedName}\\s+REG_\\w+\\s+(.+)$`, 'im'));
  return match ? match[1].trim() : null;
}

function findSevenZip() {
  const candidates = ['7z'];
  const registryPath = registryValue('HKLM\\SOFTWARE\\7-Zip', 'Path');
  if (registryPath) candidates.push(path.join(registryPath, '7z.exe'));
  candidates.push(
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  );
  for (const candidate of [...new Set(candidates)]) {
    const output = tryCommand(candidate, ['i']);
    if (output) return { command: candidate, output: output.split(/\r?\n/)[0] };
  }
  return null;
}

function hasMsvcTools(installationPath) {
  const toolsRoot = path.join(installationPath, 'VC', 'Tools', 'MSVC');
  try {
    return fs.readdirSync(toolsRoot, { withFileTypes: true }).some((entry) => entry.isDirectory());
  } catch {
    return false;
  }
}

function findVisualStudio() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const vswhereCandidates = [
    'vswhere.exe',
    path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
  ];
  for (const vswhere of vswhereCandidates) {
    const installationPath = tryCommand(vswhere, [
      '-latest',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ]);
    if (installationPath && hasMsvcTools(installationPath)) return installationPath.trim();
  }

  const candidates = [
    process.env.vs2026_install,
    process.env.vs2022_install,
    'C:\\Program Files\\Microsoft Visual Studio\\18\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\18\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\2026\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\2026\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools',
  ].filter(Boolean);
  return candidates.find(hasMsvcTools) || null;
}

function nearestExistingPath(candidate) {
  let current = path.resolve(candidate);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function freeDiskGiB(candidate) {
  const existing = nearestExistingPath(candidate);
  if (!existing || typeof fs.statfsSync !== 'function') return null;
  const stats = fs.statfsSync(existing);
  return Number(stats.bavail) * Number(stats.bsize) / GIB;
}

function collectDoctorFindings(workRootValue = DEFAULT_WORK_ROOT) {
  const baseline = readBaseline();
  const requirements = baseline.windowsRequirements;
  const findings = [];
  const add = (id, label, ok, details) => findings.push({ id, label, ok, details });

  add('platform', 'Windows x64', process.platform === 'win32' && process.arch === 'x64',
    `${process.platform}/${process.arch}`);
  const memoryGiB = os.totalmem() / GIB;
  add('memory', 'System memory', memoryGiB >= requirements.minimumMemoryGiB,
    `${memoryGiB.toFixed(1)} GiB; ${requirements.minimumMemoryGiB} GiB required`);

  let workRoot;
  try {
    workRoot = assertSafeWorkRoot(workRootValue);
    add('work-root', 'External work root', true, workRoot);
  } catch (error) {
    add('work-root', 'External work root', false, error.message);
  }

  if (workRoot) {
    try {
      const freeGiB = freeDiskGiB(workRoot);
      add('disk', 'Free disk space', freeGiB !== null && freeGiB >= requirements.minimumFreeDiskGiB,
        freeGiB === null
          ? 'unable to determine free space'
          : `${freeGiB.toFixed(1)} GiB; ${requirements.minimumFreeDiskGiB} GiB required`);
    } catch (error) {
      add('disk', 'Free disk space', false, error.message);
    }
  }

  const gitVersion = tryCommand('git', ['--version']);
  add('git', 'Git', Boolean(gitVersion), gitVersion || 'not found');

  const python = findPython();
  const minimumPython = parseVersionTuple(requirements.minimumPython);
  add('python', 'Python', Boolean(python && versionAtLeast(python.version, minimumPython)),
    python ? `${python.output} via ${displayCommand(python.command, python.prefix)}` : 'not found');
  if (python) {
    const httplib2 = tryCommand(python.command, [
      ...python.prefix,
      '-c',
      'import httplib2; print(getattr(httplib2, "__version__", "unknown"))',
    ]);
    add('httplib2', 'Python httplib2', httplib2 === requirements.httplib2,
      httplib2 || `not found; ${requirements.httplib2} required`);
  } else {
    add('httplib2', 'Python httplib2', false, `Python unavailable; ${requirements.httplib2} required`);
  }

  const sevenZip = findSevenZip();
  add('7zip', '7-Zip', Boolean(sevenZip), sevenZip ? sevenZip.command : '7z.exe not found');

  const visualStudio = findVisualStudio();
  add('visual-studio', 'Visual Studio C++', Boolean(visualStudio),
    visualStudio || 'Visual Studio with the Desktop development with C++ workload not found');

  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const sdkRoot = process.env.WindowsSdkDir || path.join(programFilesX86, 'Windows Kits', '10');
  const sdkInclude = path.join(sdkRoot, 'Include', requirements.windowsSdk, 'um', 'Windows.h');
  const sdkRc = path.join(sdkRoot, 'bin', requirements.windowsSdk, 'x64', 'rc.exe');
  add('windows-sdk', 'Windows SDK', fs.existsSync(sdkInclude) && fs.existsSync(sdkRc),
    `${requirements.windowsSdk} at ${sdkRoot}`);
  const debugHelp = path.join(sdkRoot, 'Debuggers', 'x64', 'dbghelp.dll');
  add('debugging-tools', 'SDK Debugging Tools', fs.existsSync(debugHelp), debugHelp);

  const longPaths = registryValue(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
    'LongPathsEnabled',
  );
  add('long-paths', 'Long paths', longPaths === '0x1' || longPaths === '1',
    longPaths || 'LongPathsEnabled could not be read');
  return findings;
}

function printDoctor(findings) {
  for (const finding of findings) {
    console.log(`[${finding.ok ? 'PASS' : 'FAIL'}] ${finding.label}: ${finding.details}`);
  }
  const failures = findings.filter((finding) => !finding.ok);
  console.log(`\n${findings.length - failures.length}/${findings.length} required checks passed.`);
  return failures.length === 0;
}

function parseSeriesEntries(seriesText = fs.readFileSync(SERIES_PATH, 'utf8')) {
  return seriesText
    .split(/\r?\n/)
    .map((line) => line.trim().split(' #')[0])
    .filter((line) => line && !line.startsWith('#'))
    .map((entry) => {
      const normalized = entry.replaceAll('\\', '/');
      if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
        throw new Error(`Unsafe patch series entry: ${entry}`);
      }
      if (!normalized.endsWith('.patch')) {
        throw new Error(`Patch series entries must end in .patch: ${entry}`);
      }
      return normalized;
    });
}

function composeManagedSeries(baseSeries, entries) {
  const markerStart = baseSeries.indexOf(MANAGED_SERIES_BEGIN);
  const unmanaged = (markerStart === -1 ? baseSeries : baseSeries.slice(0, markerStart)).trimEnd();
  return [unmanaged, '', MANAGED_SERIES_BEGIN, ...entries, MANAGED_SERIES_END, ''].join('\n');
}

function patchStackHash(entries = parseSeriesEntries()) {
  const hash = crypto.createHash('sha256');
  hash.update(entries.join('\n'));
  for (const entry of entries) {
    const patchPath = path.join(PATCHES_ROOT, ...entry.split('/'));
    if (!fs.existsSync(patchPath)) throw new Error(`Patch listed in series does not exist: ${entry}`);
    hash.update(fs.readFileSync(patchPath));
  }
  return hash.digest('hex');
}

function touchedPathsFromPatches(patchPaths) {
  const touched = new Set();
  for (const patchPath of patchPaths) {
    const patchText = fs.readFileSync(patchPath, 'utf8');
    const matches = patchText.matchAll(/^(?:--- a\/|\+\+\+ b\/)(.+)$/gm);
    for (const match of matches) {
      const relativePath = match[1].trim().replaceAll('\\', '/');
      if (!relativePath || relativePath === '/dev/null'
        || path.posix.isAbsolute(relativePath)
        || relativePath.split('/').includes('..')
        || relativePath.startsWith('"')) {
        throw new Error(`Unsafe or unsupported path in patch ${patchPath}: ${relativePath}`);
      }
      touched.add(relativePath);
    }
  }
  return [...touched].sort();
}

function applyPatchSequenceInScratch(sourceRoot, patchPaths) {
  const touchedPaths = touchedPathsFromPatches(patchPaths);
  const scratchPrefix = path.join(os.tmpdir(), 'ember-chromium-patches-');
  const scratchRoot = fs.mkdtempSync(scratchPrefix);
  try {
    for (const relativePath of touchedPaths) {
      const source = path.join(sourceRoot, ...relativePath.split('/'));
      const destination = path.join(scratchRoot, ...relativePath.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (fs.existsSync(source)) fs.copyFileSync(source, destination);
    }
    for (const patchPath of patchPaths) {
      runCaptured('git', ['apply', '--check', '--no-index', patchPath], { cwd: scratchRoot });
      runCaptured('git', ['apply', '--no-index', patchPath], { cwd: scratchRoot });
    }
    return touchedPaths;
  } finally {
    const safePrefix = normalizeForComparison(scratchPrefix);
    const safeScratch = normalizeForComparison(scratchRoot);
    if (safeScratch.startsWith(safePrefix)) {
      fs.rmSync(scratchRoot, { recursive: true, force: true });
    }
  }
}

function parseDirtyPaths(statusText) {
  return statusText
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => line.slice(3).split(' -> '))
    .map((entry) => entry.replace(/^"|"$/g, '').replaceAll('\\', '/'));
}

function isManagedConfigurationPath(relativePath, entries = parseSeriesEntries()) {
  const normalized = relativePath.replaceAll('\\', '/');
  return normalized === '.ember-port.json'
    || normalized === 'patches/series'
    || entries.some((entry) => normalized === `patches/${entry}`);
}

function assertNoUnexpectedConfigurationChanges(configurationRoot, entries = parseSeriesEntries()) {
  const status = runCaptured('git', [
    '-C', configurationRoot, 'status', '--short', '--untracked-files=all', '--ignore-submodules=none',
  ]);
  const unexpected = parseDirtyPaths(status)
    .filter((entry) => !isManagedConfigurationPath(entry, entries));
  if (unexpected.length) {
    throw new Error(
      `Refusing to overwrite unexpected changes in the managed configuration checkout:\n${unexpected.join('\n')}`,
    );
  }
}

function expectedStamp(baseline, entries) {
  return {
    schemaVersion: 1,
    chromiumVersion: baseline.chromium.version,
    chromiumCommit: baseline.chromium.commit,
    configurationCommit: baseline.buildConfiguration.commit,
    commonCommit: baseline.buildConfiguration.commonSubmodule.commit,
    electronOracleCommit: baseline.electronOracle.referenceCommit,
    patchStackSha256: patchStackHash(entries),
  };
}

function verifyManagedCheckout(paths, baseline) {
  if (!fs.existsSync(path.join(paths.configurationRoot, '.git'))) {
    throw new Error(`Managed configuration checkout is missing: ${paths.configurationRoot}`);
  }
  const head = runCaptured('git', ['-C', paths.configurationRoot, 'rev-parse', 'HEAD']);
  if (head !== baseline.buildConfiguration.commit) {
    throw new Error(`Configuration checkout is ${head}; expected ${baseline.buildConfiguration.commit}`);
  }
  const commonRoot = path.join(
    paths.configurationRoot,
    baseline.buildConfiguration.commonSubmodule.path,
  );
  const commonHead = runCaptured('git', ['-C', commonRoot, 'rev-parse', 'HEAD']);
  if (commonHead !== baseline.buildConfiguration.commonSubmodule.commit) {
    throw new Error(`Common checkout is ${commonHead}; expected ${baseline.buildConfiguration.commonSubmodule.commit}`);
  }
  const commonStatus = runCaptured('git', ['-C', commonRoot, 'status', '--short']);
  if (commonStatus) throw new Error(`The common checkout has unexpected changes:\n${commonStatus}`);
}

function prepare(workRootValue) {
  const baseline = readBaseline();
  const paths = getPortPaths(workRootValue);
  const configuration = baseline.buildConfiguration;
  const entries = parseSeriesEntries();
  fs.mkdirSync(paths.workRoot, { recursive: true });

  if (!fs.existsSync(paths.configurationRoot)) {
    runInherited('git', [
      'clone',
      '--filter=blob:none',
      '--no-checkout',
      '--depth=1',
      '--branch', configuration.tag,
      configuration.repository,
      paths.configurationRoot,
    ]);
    runInherited('git', [
      '-C', paths.configurationRoot, 'checkout', '--detach', configuration.commit,
    ]);
  } else if (!fs.existsSync(path.join(paths.configurationRoot, '.git'))) {
    throw new Error(
      `The configuration path exists but is not the managed Git checkout: ${paths.configurationRoot}`,
    );
  }

  const head = runCaptured('git', ['-C', paths.configurationRoot, 'rev-parse', 'HEAD']);
  if (head !== configuration.commit) {
    throw new Error(`Configuration checkout is ${head}; expected ${configuration.commit}`);
  }
  assertNoUnexpectedConfigurationChanges(paths.configurationRoot, entries);

  runInherited('git', [
    '-C', paths.configurationRoot, 'submodule', 'update', '--init', '--depth=1',
    configuration.commonSubmodule.path,
  ]);
  verifyManagedCheckout(paths, baseline);

  for (const entry of entries) {
    const source = path.join(PATCHES_ROOT, ...entry.split('/'));
    const destination = path.join(paths.configurationRoot, 'patches', ...entry.split('/'));
    if (!fs.existsSync(source)) throw new Error(`Patch listed in series does not exist: ${entry}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  const baseSeries = runCaptured('git', [
    '-C', paths.configurationRoot, 'show', `${configuration.commit}:patches/series`,
  ]);
  fs.writeFileSync(
    path.join(paths.configurationRoot, 'patches', 'series'),
    composeManagedSeries(baseSeries, entries),
    'utf8',
  );
  fs.writeFileSync(
    paths.stampPath,
    `${JSON.stringify(expectedStamp(baseline, entries), null, 2)}\n`,
    'utf8',
  );

  console.log(`Prepared Ember's pinned Chromium configuration at ${paths.configurationRoot}`);
  console.log(`Chromium source/build root: ${paths.sourceRoot}`);
  console.log(`Patch stack: ${entries.length} Ember patch${entries.length === 1 ? '' : 'es'}`);
  return paths;
}

function assertPrepared(paths, baseline = readBaseline()) {
  const entries = parseSeriesEntries();
  verifyManagedCheckout(paths, baseline);
  assertNoUnexpectedConfigurationChanges(paths.configurationRoot, entries);
  if (!fs.existsSync(paths.stampPath)) {
    throw new Error(`Preparation stamp is missing; run the prepare command: ${paths.stampPath}`);
  }
  const configuration = baseline.buildConfiguration;
  const baseSeries = runCaptured('git', [
    '-C', paths.configurationRoot, 'show', `${configuration.commit}:patches/series`,
  ]);
  const expectedSeries = composeManagedSeries(baseSeries, entries);
  const externalSeriesPath = path.join(paths.configurationRoot, 'patches', 'series');
  const actualSeries = fs.readFileSync(externalSeriesPath, 'utf8');
  if (actualSeries !== expectedSeries) {
    throw new Error('The generated external patch series differs from Ember; run prepare again.');
  }
  for (const entry of entries) {
    const repositoryPatch = fs.readFileSync(path.join(PATCHES_ROOT, ...entry.split('/')));
    const externalPatchPath = path.join(
      paths.configurationRoot,
      'patches',
      ...entry.split('/'),
    );
    if (!fs.existsSync(externalPatchPath)
      || !repositoryPatch.equals(fs.readFileSync(externalPatchPath))) {
      throw new Error(`The generated external patch differs from Ember: ${entry}; run prepare again.`);
    }
  }

  const actual = JSON.parse(fs.readFileSync(paths.stampPath, 'utf8'));
  const expected = expectedStamp(baseline, entries);
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`Preparation stamp mismatch for ${key}; run the prepare command again.`);
    }
  }
}

function verifyPatchStack(sourceRootValue) {
  const baseline = readBaseline();
  const sourceRoot = path.resolve(sourceRootValue);
  let head;
  try {
    head = runCaptured('git', ['-C', sourceRoot, 'rev-parse', 'HEAD']);
  } catch {
    throw new Error(`Not a Chromium Git checkout: ${sourceRoot}`);
  }
  if (head !== baseline.chromium.commit) {
    throw new Error(`Chromium source is ${head}; expected ${baseline.chromium.commit}`);
  }
  const entries = parseSeriesEntries();
  const patches = entries.map((entry) => path.join(PATCHES_ROOT, ...entry.split('/')));
  const touchedPaths = touchedPathsFromPatches(patches);
  const pristine = spawnSync('git', ['-C', sourceRoot, 'diff', '--quiet', 'HEAD', '--', ...touchedPaths], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (pristine.error || ![0, 1].includes(pristine.status)) {
    throw new Error(`Could not inspect the Chromium source checkout: ${pristine.error?.message || pristine.stderr}`);
  }
  if (pristine.status === 1) {
    throw new Error('Chromium files touched by the Ember stack are not pristine; use a clean pinned checkout.');
  }
  applyPatchSequenceInScratch(sourceRoot, patches);
  console.log(
    `Verified ${entries.length} ordered Ember patches against ${head} in an isolated ${touchedPaths.length}-file scratch tree.`,
  );
}

function verifySourceHead(paths, baseline = readBaseline()) {
  if (!fs.existsSync(path.join(paths.sourceRoot, 'BUILD.gn'))) {
    throw new Error(`Chromium source/build root is missing: ${paths.sourceRoot}`);
  }
  const head = runCaptured('git', ['-C', paths.sourceRoot, 'rev-parse', 'HEAD']);
  if (head !== baseline.chromium.commit) {
    throw new Error(`Built Chromium source is ${head}; expected ${baseline.chromium.commit}`);
  }
  return head;
}

function requireHealthyDoctor(workRoot) {
  const findings = collectDoctorFindings(workRoot);
  if (!printDoctor(findings)) {
    throw new Error('Chromium build prerequisites are incomplete; resolve the failed doctor checks first.');
  }
}

function invokePythonScript(scriptName, workRootValue, args) {
  const paths = getPortPaths(workRootValue);
  const baseline = readBaseline();
  requireHealthyDoctor(paths.workRoot);
  assertPrepared(paths, baseline);
  if (scriptName === 'build.py') verifyUpstreamBaselines(baseline);
  else verifySourceHead(paths, baseline);
  const python = findPython();
  if (!python) throw new Error('Python is unavailable.');
  runInherited(python.command, [
    ...python.prefix,
    path.join(paths.configurationRoot, scriptName),
    ...args,
  ], { cwd: paths.configurationRoot });
  return paths;
}

function build(workRootValue, jobs, passthrough) {
  const defaultJobs = Math.max(1, (os.availableParallelism?.() || os.cpus().length) - 2);
  const requestedJobs = jobs || defaultJobs;
  const paths = invokePythonScript(
    'build.py',
    workRootValue,
    ['-j', String(requestedJobs), ...passthrough],
  );
  const head = verifySourceHead(paths);
  console.log(`Native build completed from pinned Chromium source ${head}.`);
}

function packageBuild(workRootValue, passthrough) {
  invokePythonScript('package.py', workRootValue, passthrough);
}

function runNative(workRootValue, url) {
  const paths = getPortPaths(workRootValue);
  assertPrepared(paths);
  if (!fs.existsSync(paths.executable)) {
    throw new Error(`Native Chromium binary is missing; build it first: ${paths.executable}`);
  }
  fs.mkdirSync(paths.profileRoot, { recursive: true });
  const args = [
    `--user-data-dir=${paths.profileRoot}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  if (url) args.push(url);
  const child = spawn(paths.executable, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  console.log(`Started native Ember candidate (PID ${child.pid}) with isolated profile ${paths.profileRoot}`);
}

function parseCli(argv) {
  const values = [...argv];
  const command = values.shift() || 'help';
  const options = {
    workRoot: process.env.EMBER_CHROMIUM_ROOT || DEFAULT_WORK_ROOT,
    passthrough: [],
  };
  while (values.length) {
    const token = values.shift();
    if (token === '--') {
      options.passthrough.push(...values);
      break;
    }
    if (token === '--work-root') options.workRoot = values.shift();
    else if (token === '--source') options.source = values.shift();
    else if (token === '--jobs') options.jobs = Number(values.shift());
    else if (token === '--url') options.url = values.shift();
    else throw new Error(`Unknown option: ${token}`);
  }
  if (options.jobs !== undefined && (!Number.isInteger(options.jobs) || options.jobs < 1)) {
    throw new Error('--jobs must be a positive integer.');
  }
  return { command, options };
}

function printHelp() {
  console.log(`Ember native Chromium port tooling

Usage:
  node chromium/tools/port.js baseline
  node chromium/tools/port.js verify-upstreams
  node chromium/tools/port.js doctor [--work-root PATH]
  node chromium/tools/port.js prepare [--work-root PATH]
  node chromium/tools/port.js verify-patches --source PATH
  node chromium/tools/port.js build [--work-root PATH] [--jobs N] [-- BUILD.PY_ARGS]
  node chromium/tools/port.js package [--work-root PATH] [-- PACKAGE.PY_ARGS]
  node chromium/tools/port.js run [--work-root PATH] [--url URL]

The default external work root is ${DEFAULT_WORK_ROOT}. Set EMBER_CHROMIUM_ROOT
or pass --work-root to use another short path outside this repository.`);
}

function main(argv = process.argv.slice(2)) {
  const { command, options } = parseCli(argv);
  if (command === 'help' || command === '--help' || command === '-h') printHelp();
  else if (command === 'baseline') console.log(JSON.stringify(readBaseline(), null, 2));
  else if (command === 'verify-upstreams') verifyUpstreamBaselines();
  else if (command === 'doctor') process.exitCode = printDoctor(collectDoctorFindings(options.workRoot)) ? 0 : 1;
  else if (command === 'prepare') prepare(options.workRoot);
  else if (command === 'verify-patches') {
    verifyPatchStack(options.source || getPortPaths(options.workRoot).sourceRoot);
  } else if (command === 'build') build(options.workRoot, options.jobs, options.passthrough);
  else if (command === 'package') packageBuild(options.workRoot, options.passthrough);
  else if (command === 'run') runNative(options.workRoot, options.url);
  else throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Ember Chromium port: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  BASELINE_PATH,
  DEFAULT_WORK_ROOT,
  MANAGED_SERIES_BEGIN,
  MANAGED_SERIES_END,
  PATCHES_ROOT,
  REPO_ROOT,
  assertSafeWorkRoot,
  assertPrepared,
  applyPatchSequenceInScratch,
  collectDoctorFindings,
  commitFromLsRemote,
  composeManagedSeries,
  expectedStamp,
  getPortPaths,
  isManagedConfigurationPath,
  isPathWithin,
  normalizeCapturedOutput,
  parseCli,
  parseDirtyPaths,
  parseSeriesEntries,
  patchStackHash,
  readBaseline,
  touchedPathsFromPatches,
  versionAtLeast,
  verifySourceHead,
  verifyUpstreamBaselines,
};
