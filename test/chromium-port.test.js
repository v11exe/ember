'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const port = require('../chromium/tools/port');

test('native port baseline locks the Electron oracle and every upstream revision', () => {
  const baseline = port.readBaseline();

  assert.equal(baseline.electronOracle.referenceCommit, '9ae3217b20f72bc05a9ce1b11d9d84ce544c746d');
  assert.equal(baseline.chromium.version, '151.0.7922.173');
  assert.equal(baseline.chromium.commit, 'a96602f30358e9b5d256a0464e7e4d4bec223004');
  assert.equal(baseline.buildConfiguration.commit, '63f51219bac808e0e5d1d5ba7958ad2aaa159dde');
  assert.equal(
    baseline.buildConfiguration.commonSubmodule.commit,
    '4087f48e6d66e55486fe7c3a634303559634ba3f',
  );
  assert.match(baseline.researchReferences.heliumWindows.commit, /^[0-9a-f]{40}$/);
  assert.match(baseline.researchReferences.heliumCore.commit, /^[0-9a-f]{40}$/);
  assert.equal(baseline.windowsRequirements.visualStudioMajorVersion, 18);
  assert.equal(baseline.windowsRequirements.minimumPreparedBuildFreeDiskGiB, 60);
  assert.equal(baseline.windowsRequirements.minimumWindowsSdkFileVersion, '10.0.26100.7705');
  assert.equal(baseline.windowsRequirements.minimumDebuggingToolsVersion, '10.0.26100.3323');
});

test('annotated remote tags resolve to their peeled commit and lightweight tags resolve directly', () => {
  const annotated = [
    '1111111111111111111111111111111111111111\trefs/tags/v1',
    '2222222222222222222222222222222222222222\trefs/tags/v1^{}',
  ].join('\n');
  const lightweight = '3333333333333333333333333333333333333333\trefs/tags/v2\n';

  assert.equal(port.commitFromLsRemote(annotated, 'v1'), '2222222222222222222222222222222222222222');
  assert.equal(port.commitFromLsRemote(lightweight, 'v2'), '3333333333333333333333333333333333333333');
  assert.equal(port.commitFromLsRemote('', 'missing'), null);
});

test('the Ember patch series is ordered, local, and complete', () => {
  const entries = port.parseSeriesEntries();

  assert.deepEqual(entries, [
    'ember/0001-ember-product-identity.patch',
    'ember/0002-ember-windows-security-identities.patch',
  ]);
  for (const entry of entries) {
    assert.equal(fs.existsSync(path.join(port.PATCHES_ROOT, ...entry.split('/'))), true);
  }
  assert.match(port.patchStackHash(), /^[0-9a-f]{64}$/);
});

test('dependent patches verify sequentially in scratch without changing their source', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-patch-fixture-'));
  try {
    const sourceRoot = path.join(fixtureRoot, 'source');
    const patchesRoot = path.join(fixtureRoot, 'patches');
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(patchesRoot);
    fs.writeFileSync(path.join(sourceRoot, 'value.txt'), 'alpha\n');
    const first = path.join(patchesRoot, 'first.patch');
    const second = path.join(patchesRoot, 'second.patch');
    fs.writeFileSync(first, [
      'diff --git a/value.txt b/value.txt',
      '--- a/value.txt',
      '+++ b/value.txt',
      '@@ -1 +1 @@',
      '-alpha',
      '+beta',
      '',
    ].join('\n'));
    fs.writeFileSync(second, [
      'diff --git a/value.txt b/value.txt',
      '--- a/value.txt',
      '+++ b/value.txt',
      '@@ -1 +1 @@',
      '-beta',
      '+gamma',
      '',
    ].join('\n'));

    assert.deepEqual(port.applyPatchSequenceInScratch(sourceRoot, [first, second]), ['value.txt']);
    assert.equal(fs.readFileSync(path.join(sourceRoot, 'value.txt'), 'utf8'), 'alpha\n');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('prepared build verification reverses dependent patches in isolated scratch state', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-applied-patch-fixture-'));
  try {
    const sourceRoot = path.join(fixtureRoot, 'source');
    const patchesRoot = path.join(fixtureRoot, 'patches');
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(patchesRoot);
    fs.writeFileSync(path.join(sourceRoot, 'value.txt'), 'gamma\n');
    const first = path.join(patchesRoot, 'first.patch');
    const second = path.join(patchesRoot, 'second.patch');
    fs.writeFileSync(first, [
      'diff --git a/value.txt b/value.txt',
      '--- a/value.txt',
      '+++ b/value.txt',
      '@@ -1 +1 @@',
      '-alpha',
      '+beta',
      '',
    ].join('\n'));
    fs.writeFileSync(second, [
      'diff --git a/value.txt b/value.txt',
      '--- a/value.txt',
      '+++ b/value.txt',
      '@@ -1 +1 @@',
      '-beta',
      '+gamma',
      '',
    ].join('\n'));

    assert.deepEqual(
      port.verifyAppliedPatchSequenceInScratch(sourceRoot, [first, second]),
      ['value.txt'],
    );
    assert.equal(fs.readFileSync(path.join(sourceRoot, 'value.txt'), 'utf8'), 'gamma\n');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('resume repairs a partial GN bootstrap without discarding generated build files', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-gn-resume-fixture-'));
  try {
    const outputRoot = path.join(fixtureRoot, 'out', 'Default');
    fs.mkdirSync(outputRoot, { recursive: true });
    const gnExecutable = path.join(outputRoot, 'gn.exe');
    const buildNinja = path.join(outputRoot, 'build.ninja');
    fs.writeFileSync(gnExecutable, 'partial');

    assert.equal(port.repairPartialResumeArtifacts({ outputRoot }), true);
    assert.equal(fs.existsSync(gnExecutable), false);

    fs.writeFileSync(gnExecutable, 'complete');
    fs.writeFileSync(buildNinja, 'generated');
    assert.equal(port.repairPartialResumeArtifacts({ outputRoot }), false);
    assert.equal(fs.readFileSync(gnExecutable, 'utf8'), 'complete');
    assert.equal(fs.readFileSync(buildNinja, 'utf8'), 'generated');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('the Electron oracle manifest names 30 valid deterministic PNG references', () => {
  const referenceRoot = path.join(port.REPO_ROOT, 'chromium', 'reference', 'electron', '9ae3217');
  const manifest = JSON.parse(fs.readFileSync(path.join(referenceRoot, 'manifest.json'), 'utf8'));
  const files = Object.values(manifest.scenarios).flat();

  assert.equal(manifest.oracleCommit, '9ae3217b20f72bc05a9ce1b11d9d84ce544c746d');
  assert.equal(manifest.environment.EMBER_CAPTURE_OFFLINE, '1');
  assert.equal(files.length, 30);
  assert.equal(new Set(files).size, files.length);
  for (const file of files) {
    const data = fs.readFileSync(path.join(referenceRoot, file));
    assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG', file);
    assert.ok(data.readUInt32BE(16) > 0, file);
    assert.ok(data.readUInt32BE(20) > 0, file);
  }
  assert.deepEqual(manifest.geometry.wide.viewport, [1570, 796]);
  assert.deepEqual(manifest.geometry.compact.viewport, [620, 336]);
});

test('the Electron oracle capture has a deterministic offline mode and bounded paint wait', () => {
  const capture = fs.readFileSync(path.join(port.REPO_ROOT, 'scripts', 'capture-ui.js'), 'utf8');

  assert.match(capture, /process\.env\.EMBER_CAPTURE_OFFLINE === '1'/);
  assert.match(capture, /settleTimer = setTimeout\(\(\) => finish\(null\), 300\)/);
  assert.match(capture, /paint timed out: \$\{file\}[\s\S]*3000/);
});

test('the first native patch assigns Ember-owned Windows integration identities', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0001-ember-product-identity.patch'),
    'utf8',
  );

  assert.match(patchText, /PRODUCT_FULLNAME=Ember/);
  assert.match(patchText, /kCompanyPathName\[\] = L"v11exe"/);
  assert.match(patchText, /Software\\\\Policies\\\\Ember/);
  assert.match(patchText, /\{FDFEA5B9-ECF4-4569-9E22-16FDB96870AB\}/);
  assert.match(patchText, /\.elevator_clsid = \{0xCA4E3C3D/);
  assert.doesNotMatch(patchText, /^[-+].*elevator_iid/m);
  assert.doesNotMatch(patchText, /^\+.*The Chromium Authors/m);
});

test('the Windows security identity patch separates tracing COM and AppContainer identities', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0002-ember-windows-security-identities.patch'),
    'utf8',
  );

  assert.match(patchText, /9C6AB61A/);
  assert.doesNotMatch(patchText, /^[-+].*tracing_service_iid/m);
  assert.match(patchText, /1530412577-/);
  assert.doesNotMatch(patchText, /^\+.*(?:83f69367|a3fd580a|924012148)/im);
});

test('managed patch-series composition is deterministic and does not duplicate Ember entries', () => {
  const upstream = 'ungoogled/base.patch\nwindows/platform.patch\n';
  const entries = ['ember/identity.patch', 'ember/shell.patch'];
  const once = port.composeManagedSeries(upstream, entries);
  const twice = port.composeManagedSeries(once, entries);

  assert.equal(twice, once);
  assert.equal(once.match(/ember\/identity\.patch/g).length, 1);
  assert.match(once, new RegExp(port.MANAGED_SERIES_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(once, new RegExp(port.MANAGED_SERIES_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('work-root validation keeps the Chromium checkout away from Ember and broad roots', () => {
  assert.throws(() => port.assertSafeWorkRoot(port.REPO_ROOT), /outside the Ember repository/);
  assert.throws(
    () => port.assertSafeWorkRoot(path.join(port.REPO_ROOT, 'chromium-build')),
    /outside the Ember repository/,
  );
  assert.throws(
    () => port.assertSafeWorkRoot(path.dirname(port.REPO_ROOT)),
    /must not contain the Ember repository/,
  );
  assert.throws(
    () => port.assertSafeWorkRoot(path.parse(port.REPO_ROOT).root),
    /filesystem root/,
  );
  assert.equal(port.assertSafeWorkRoot(path.join(os.tmpdir(), 'ember-chromium-test')),
    path.resolve(os.tmpdir(), 'ember-chromium-test'));
});

test('only generated overlay files are accepted in the managed configuration checkout', () => {
  const entries = ['ember/identity.patch'];
  const status = [
    ' M patches/series',
    '?? patches/ember/identity.patch',
    '?? patches/ember/unlisted.patch',
    '?? .ember-port.json',
    '?? .gcs_entries',
    ' M flags.windows.gn',
  ].join('\n');
  const dirty = port.parseDirtyPaths(status);

  assert.deepEqual(dirty, [
    'patches/series',
    'patches/ember/identity.patch',
    'patches/ember/unlisted.patch',
    '.ember-port.json',
    '.gcs_entries',
    'flags.windows.gn',
  ]);
  assert.equal(port.isManagedConfigurationPath(dirty[0], entries), true);
  assert.equal(port.isManagedConfigurationPath(dirty[1], entries), true);
  assert.equal(port.isManagedConfigurationPath(dirty[2], entries), false);
  assert.equal(port.isManagedConfigurationPath(dirty[3], entries), true);
  assert.equal(port.isManagedConfigurationPath(dirty[4], entries), true);
  assert.equal(port.isManagedConfigurationPath(dirty[5], entries), false);
});

test('captured porcelain output keeps its leading Git status column', () => {
  assert.equal(port.normalizeCapturedOutput(' M patches/series\r\n'), ' M patches/series');
});

test('CLI parsing keeps build arguments behind an explicit separator and supports verified resume', () => {
  assert.deepEqual(
    port.parseCli([
      'build', '--work-root', 'D:\\ember-chromium', '--jobs', '12', '--resume', '--', '--tarball',
    ]),
    {
      command: 'build',
      options: {
        workRoot: 'D:\\ember-chromium',
        jobs: 12,
        resume: true,
        passthrough: ['--tarball'],
      },
    },
  );
  assert.throws(() => port.parseCli(['build', '--jobs', '0']), /positive integer/);
  assert.throws(() => port.parseCli(['prepare', '--unknown']), /Unknown option/);
});

test('the generated Windows python3 launcher bypasses broken Store aliases', () => {
  assert.equal(
    port.windowsPythonShim('C:\\Program Files\\Python312\\python.exe'),
    '@echo off\r\n"C:\\Program Files\\Python312\\python.exe" %*\r\n',
  );
  assert.throws(() => port.windowsPythonShim('bad\npath'), /invalid executable path/);
});

test('the Chromium Visual Studio override uses the pinned product line', () => {
  assert.equal(port.visualStudioInstallVariable('2026'), 'vs2026_install');
  assert.throws(() => port.visualStudioInstallVariable('latest'), /Invalid Visual Studio/);
});

test('version comparison accepts patch differences while enforcing the minimum minor', () => {
  assert.deepEqual(port.parseVersionTuple('10.0.26100.7705 (WinBuild)'), [10, 0, 26100, 7705]);
  assert.equal(port.versionAtLeast([10, 0, 26100, 7705], [10, 0, 26100, 3323]), true);
  assert.equal(port.versionAtLeast([3, 12, 1], [3, 11]), true);
  assert.equal(port.versionAtLeast([3, 11], [3, 11]), true);
  assert.equal(port.versionAtLeast([3, 10, 9], [3, 11]), false);
});
