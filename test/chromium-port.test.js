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
    'ember/0003-ember-visible-product-surfaces.patch',
    'ember/0004-ember-windows-app-icon-version.patch',
    'ember/0005-ember-webui-product-icon.patch',
    'ember/0006-ember-native-shell-geometry.patch',
    'ember/0007-ember-sidebar-address-copy-link.patch',
    'ember/0008-ember-sidebar-favorites.patch',
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

test('the visible product patch brands window, About, accessibility, and default-browser surfaces', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0003-ember-visible-product-surfaces.patch'),
    'utf8',
  );

  assert.match(patchText, /IDS_BROWSER_WINDOW_TITLE_FORMAT[\s\S]*- Ember/);
  assert.match(patchText, /IDS_ACCESSIBLE_BROWSER_WINDOW_TITLE_FORMAT[\s\S]*- Ember/);
  assert.match(patchText, /IDS_SETTINGS_ABOUT_PROGRAM[\s\S]*About Ember/);
  assert.match(patchText, /Official Ember Build, ungoogled Chromium base/);
  assert.match(patchText, /Make Ember the default browser/);
  assert.doesNotMatch(patchText, /^[-+].*User-Agent|^[-+].*Chrome\//m);
});

test('the native resource overlay is path-safe and carries valid Ember raster and ICO assets', () => {
  const manifest = port.readResourceManifest();
  assert.equal(manifest.files.length, 18);
  assert.equal(new Set(manifest.files.map((item) => item.destination)).size, 18);
  assert.match(port.resourceOverlayHash(manifest), /^[0-9a-f]{64}$/);
  assert.equal(
    manifest.files.some((item) => item.destination.endsWith('/chromium/win/chromium.ico')),
    true,
  );
  assert.equal(
    manifest.files.filter((item) => item.destination.includes('components/resources/')).length,
    4,
  );

  const dimensions = new Map([
    ['app-16.png', [16, 16]],
    ['app-24.png', [24, 24]],
    ['app-32.png', [32, 32]],
    ['app-48.png', [48, 48]],
    ['app-64.png', [64, 64]],
    ['app-128.png', [128, 128]],
    ['app-256.png', [256, 256]],
    ['about-logo.png', [171, 32]],
    ['about-logo-200.png', [342, 64]],
  ]);
  for (const [filename, expected] of dimensions) {
    const bytes = fs.readFileSync(path.join(port.RESOURCES_ROOT, 'branding', filename));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], expected);
  }

  for (const filename of [
    'product-logo.svg',
    'product-logo-animation.svg',
    'webui-logo-dark.svg',
  ]) {
    const svg = fs.readFileSync(path.join(port.RESOURCES_ROOT, 'branding', filename), 'utf8');
    assert.match(svg, /^<svg [^>]+>/);
    assert.match(svg, /href="data:image\/png;base64,/);
    assert.match(svg, /<\/svg>\n$/);
  }

  const ico = fs.readFileSync(path.join(port.RESOURCES_ROOT, 'branding', 'ember.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 4);
  const icoSizes = [];
  for (let index = 0; index < 4; index += 1) {
    const entry = 6 + (index * 16);
    icoSizes.push(ico[entry] || 256);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset + length <= ico.length);
    assert.deepEqual([...ico.subarray(offset, offset + 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  assert.deepEqual(icoSizes, [16, 32, 48, 256]);
});

test('resource copying verifies exact destinations and the build hook rejects traversal', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-resources-fixture-'));
  try {
    const resourceRoot = path.join(fixtureRoot, 'resources');
    const destinationRoot = path.join(fixtureRoot, 'chromium');
    fs.mkdirSync(resourceRoot);
    fs.mkdirSync(destinationRoot);
    fs.writeFileSync(path.join(resourceRoot, 'asset.bin'), 'ember');
    fs.writeFileSync(path.join(destinationRoot, 'target.bin'), 'upstream');
    const manifest = {
      resourceRoot,
      files: [{ source: 'asset.bin', destination: 'target.bin' }],
    };
    assert.deepEqual(port.copyResourceOverlay(manifest, destinationRoot), ['target.bin']);
    assert.deepEqual(port.verifyResourceOverlay(manifest, destinationRoot), ['target.bin']);
    assert.equal(fs.readFileSync(path.join(destinationRoot, 'target.bin'), 'utf8'), 'ember');
    const destination = path.join(destinationRoot, 'target.bin');
    const stableTime = new Date('2020-01-02T03:04:05.000Z');
    fs.utimesSync(destination, stableTime, stableTime);
    port.copyResourceOverlay(manifest, destinationRoot);
    assert.equal(fs.statSync(destination).mtimeMs, stableTime.getTime());

    const unsafeManifest = path.join(fixtureRoot, 'unsafe.json');
    fs.writeFileSync(unsafeManifest, JSON.stringify({
      schemaVersion: 1,
      files: [{ source: '../escape.bin', destination: 'target.bin' }],
    }));
    assert.throws(() => port.readResourceManifest(unsafeManifest), /Unsafe source resource path/);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  const configurationPatch = fs.readFileSync(
    path.join(port.REPO_ROOT, 'chromium', 'configuration', '0001-ember-resource-overlay.patch'),
    'utf8',
  );
  assert.match(configurationPatch, /source\.is_relative_to\(resource_root\)/);
  assert.match(configurationPatch, /destination\.is_relative_to\(source_tree\)/);
  assert.match(configurationPatch, /\.ember-resource-overlay\.sha256/);
  assert.match(configurationPatch, /chrome_initial\/chrome_exe\.res/);
  assert.match(configurationPatch, /chrome_dll_resources\/chrome_dll\.res/);
  assert.match(configurationPatch, /if destination\.read_bytes\(\) != source_bytes:/);
  assert.equal(port.isManagedConfigurationPath('build.py'), true);
  assert.equal(port.isManagedConfigurationPath('ember-resources/manifest.json'), true);
  assert.equal(port.isManagedConfigurationPath('ember-resources/foreign.bin'), false);
});

test('the Windows icon patch advances profile shortcut migration state', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0004-ember-windows-app-icon-version.patch'),
    'utf8',
  );
  assert.match(patchText, /-const int kCurrentProfileIconVersion = 10;/);
  assert.match(patchText, /\+const int kCurrentProfileIconVersion = 11;/);
});

test('the WebUI product icon patch replaces the last shared Chromium glyph', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0005-ember-webui-product-icon.patch'),
    'utf8',
  );
  assert.match(patchText, /<g id="chrome-product"/);
  assert.match(patchText, /M160-800h360/);
  assert.doesNotMatch(patchText, /^\+.*M336-479/m);
});

test('the native shell patch reserves Ember geometry around real Chromium contents', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0006-ember-native-shell-geometry.patch'),
    'utf8',
  );
  const touchedFiles = [...patchText.matchAll(/^diff --git a\/(\S+) b\/\S+$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(touchedFiles, [
    'chrome/browser/ui/views/frame/browser_view.cc',
    'chrome/browser/ui/views/frame/browser_view.h',
    'chrome/browser/ui/views/frame/layout/browser_view_layout.cc',
    'chrome/browser/ui/views/frame/layout/browser_view_layout.h',
    'chrome/browser/ui/views/frame/layout/browser_view_tabbed_layout_impl.cc',
  ]);
  assert.match(patchText, /browser_->is_type_normal\(\)/);
  assert.match(patchText, /kEmberSidebarWidth = 168/);
  assert.match(patchText, /kEmberPageInset = 8/);
  assert.match(patchText, /!is_fullscreen\(layout_data_->window_state\)/);
  assert.match(patchText, /params\.InsetHorizontal\(kEmberSidebarWidth/);
  assert.match(patchText, /unclipped_contents_region\.Inset\(content_insets\)/);
  assert.doesNotMatch(patchText, /^\+.*(?:no-sandbox|disable-site-isolation|TabStripModel)/im);
});

test('the sidebar feature patch matches the measured address and Copy contract', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0007-ember-sidebar-address-copy-link.patch'),
    'utf8',
  );
  const touchedFiles = [...patchText.matchAll(/^diff --git a\/(\S+) b\/\S+$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(touchedFiles, [
    'chrome/browser/ui/views/frame/browser_view.cc',
    'chrome/browser/ui/views/frame/browser_view.h',
  ]);
  assert.match(patchText, /GetActiveWebContents\(\)/);
  assert.match(patchText, /GetVisibleURL\(\)/);
  assert.match(patchText, /kEmberSidebarTopInset = 34/);
  assert.match(patchText, /kEmberSidebarHorizontalInset = 9/);
  assert.match(patchText, /kEmberSidebarRowSpacing = 10/);
  assert.match(patchText, /kEmberSidebarAddressHeight = 33/);
  assert.match(patchText, /kEmberSidebarAddressRadius = 7/);
  assert.match(patchText, /kEmberSidebarCopyWidth = 26/);
  assert.match(patchText, /kEmberSidebarCopyGlyphWidth = 12/);
  assert.match(patchText, /kEmberSidebarCopyGlyphHeight = 7/);
  assert.match(patchText, /kEmberSidebarAddressRestingFillAlpha = 0x13/);
  assert.match(patchText, /kEmberSidebarAddressRestingBorderAlpha = 0x06/);
  assert.match(patchText, /kEmberSidebarAddressHoverFillAlpha = 0x21/);
  assert.match(patchText, /kEmberSidebarAddressFocusFillAlpha = 0x2E/);
  assert.match(patchText, /kEmberSidebarAddressFocusBorderAlpha = 0x0E/);
  assert.match(patchText, /SkColorSetARGB\(0xD1, 0xFF, 0xFF, 0xFF\)/);
  assert.match(patchText, /FormatEmberSidebarUrl/);
  assert.match(patchText, /"http:\/\/"/);
  assert.match(patchText, /"https:\/\/"/);
  assert.match(patchText, /"www\."/);
  assert.doesNotMatch(patchText, /url_formatter::FormatUrl\(url\)/);
  assert.match(patchText, /views::Textfield/);
  assert.match(patchText, /ember_sidebar_editing_/);
  assert.match(patchText, /OpenCurrentSelection\([\s\S]{0,160}WindowOpenDisposition::CURRENT_TAB/);
  assert.match(patchText, /SelectAll\(false\)/);
  assert.match(patchText, /ui::VKEY_ESCAPE/);
  assert.match(patchText, /EmberSidebarCopyButton/);
  assert.match(patchText, /ShowEmberSidebarCopyToast/);
  assert.match(patchText, /std::unique_ptr<views::Widget> ember_sidebar_copy_toast_/);
  assert.match(patchText, /ui::ScopedClipboardWriter\(ui::ClipboardBuffer::kCopyPaste\)/);
  assert.match(patchText, /CopyEmberSidebarLink/);
  assert.doesNotMatch(patchText, /SetText\(u"(?:Copy|Copied)"\)/);
  assert.doesNotMatch(patchText, /LabelButton>[\s\S]{0,200}u"Copy"/);
  assert.doesNotMatch(patchText, /IDS_COPY/);
  assert.match(patchText, /OnActiveTabChanged[\s\S]*UpdateEmberSidebar\(\)/);
  assert.match(patchText, /DidFinishNavigation[\s\S]*UpdateEmberSidebar\(\)/);
  assert.match(patchText, /base::Milliseconds\(1200\)/);
  assert.doesNotMatch(patchText, /^\+.*(?:no-sandbox|disable-site-isolation|WebContents::Create)/im);
});

test('the native Favorites patch persists shortcuts and reuses real Chromium tabs', () => {
  const patchText = fs.readFileSync(
    path.join(port.PATCHES_ROOT, 'ember', '0008-ember-sidebar-favorites.patch'),
    'utf8',
  );
  const touchedFiles = [...patchText.matchAll(/^diff --git a\/(\S+) b\/\S+$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(touchedFiles, [
    'chrome/browser/ui/views/frame/browser_view.cc',
    'chrome/browser/ui/views/frame/browser_view.h',
  ]);
  assert.match(patchText, /BaseBookmarkModelObserver/);
  assert.match(patchText, /BookmarkModelFactory::GetForBrowserContext/);
  assert.match(patchText, /Ember Favorites/);
  assert.match(patchText, /ember_favorites_folder/);
  assert.match(patchText, /ember_favorites_initialized/);
  assert.match(patchText, /https:\/\/www\.google\.com\//);
  assert.match(patchText, /https:\/\/www\.youtube\.com\//);
  assert.match(patchText, /https:\/\/calendar\.google\.com\//);
  assert.match(patchText, /GetFavicon\(/);
  assert.match(patchText, /chrome\/browser\/favicon\/favicon_utils\.h/);
  assert.match(
    patchText,
    /favicon::GetDefaultFavicon\(\)/,
  );
  assert.match(patchText, /FindEmberFavoriteTab/);
  assert.match(patchText, /IsEmberFavoriteMatch/);
  assert.match(patchText, /GlobalBrowserCollection::GetInstance\(\)->ForEach/);
  assert.match(patchText, /ActivateTabAt\(/);
  assert.match(patchText, /chrome::AddTabAt\(/);
  assert.match(patchText, /GetVisibleURL\(\)/);
  assert.match(patchText, /ends_with/);
  assert.match(patchText, /\.path\(\)/);
  assert.match(patchText, /SingleThreadTaskRunner::GetCurrentDefault\(\)->PostTask/);
  assert.match(patchText, /BookmarkMetaInfoChanged/);
  assert.match(patchText, /gfx::Size\(19, 19\)/);
  assert.match(patchText, /kEmberFavoriteTileWidth = 70/);
  assert.match(patchText, /kEmberFavoritesGridHeight = 98/);
  assert.match(patchText, /kEmberFavoriteCornerRadius = 7/);
  assert.match(patchText, /kEmberFavoriteRestingFillAlpha = 0x13/);
  assert.match(patchText, /kEmberFavoriteRestingBorderAlpha = 0x06/);
  assert.match(patchText, /kEmberFavoriteHoverFillAlpha = 0x21/);
  assert.match(patchText, /kEmberFavoriteOpenFillAlpha = 0x2E/);
  assert.match(patchText, /kEmberFavoriteOpenBorderAlpha = 0x0E/);
  assert.match(patchText, /kEmberFavoritePressedScale = 0\.97f/);
  assert.match(patchText, /base::Milliseconds\(130\)/);
  assert.match(patchText, /gfx::Animation::PrefersReducedMotion\(\)/);
  assert.match(patchText, /UpdateEmberFavoriteOpenStatesForProfile/);
  assert.match(
    patchText,
    /BrowserView::GetBrowserViewForBrowser\(candidate\)/,
  );
  assert.match(patchText, /gfx::CubicBezier\(0\.25, 0\.1, 0\.25, 1\.0\)/);
  assert.match(
    patchText,
    /views::LabelButton\(std::move\(callback\), std::u16string\(\)\)/,
  );
  assert.match(
    patchText,
    /std::unique_ptr<views::LabelButton> button =\s*\+\s*std::make_unique<EmberFavoriteButton>/,
  );
  assert.match(patchText, /SetTooltipText\(favorite_titles\[index\]\)/);
  assert.match(patchText, /SetName\(accessible_name\)/);
  assert.match(patchText, /SetHorizontalAlignment\(gfx::ALIGN_CENTER\)/);
  assert.match(patchText, /setStrokeWidth\(1\.0f\)/);
  assert.match(patchText, /layer\(\)->SetTransform\(transform\)/);
  assert.doesNotMatch(patchText, /gfx::Size\(71, 43\)/);
  assert.doesNotMatch(patchText, /gfx::Size\(0, 96\)/);
  assert.doesNotMatch(patchText, /SetFocusRingCornerRadius\(9\)/);
  assert.doesNotMatch(patchText, /SkColorSetARGB\(0x24,/);
  assert.doesNotMatch(patchText, /SkColorSetARGB\(0x38,/);
  assert.doesNotMatch(patchText, /0xFF, 0xC9, 0x3C/);
  assert.doesNotMatch(patchText, /SetEnabledTextColors/);
  assert.doesNotMatch(
    patchText,
    /^\+.*(?:no-sandbox|disable-site-isolation|WebContents::Create|ChildProcessSecurityPolicy)/im,
  );
});

test('packaging normalizes pinned artifacts to Ember names without overwriting conflicts', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-packages-fixture-'));
  const baseline = {
    buildConfiguration: { tag: '151.0.0.0-1.1' },
    windowsRequirements: { architecture: 'x64' },
  };
  try {
    const paths = { packageRoot: fixtureRoot };
    const plan = port.packageArtifactPlan(paths, baseline);
    fs.writeFileSync(plan[0].source, 'installer');
    fs.writeFileSync(plan[1].source, 'portable');

    assert.deepEqual(port.normalizePackageArtifacts(paths, baseline), [
      path.join(fixtureRoot, 'ember_151.0.0.0-1.1_installer_x64.exe'),
      path.join(fixtureRoot, 'ember_151.0.0.0-1.1_windows_x64.zip'),
    ]);
    assert.equal(fs.existsSync(plan[0].source), false);
    assert.equal(fs.readFileSync(plan[0].destination, 'utf8'), 'installer');
    assert.equal(port.normalizePackageArtifacts(paths, baseline).length, 2);

    fs.writeFileSync(plan[0].source, 'installer');
    assert.equal(port.normalizePackageArtifacts(paths, baseline).length, 2);
    assert.equal(fs.existsSync(plan[0].source), false);

    fs.writeFileSync(plan[0].source, 'updated');
    assert.equal(port.normalizePackageArtifacts(paths, baseline).length, 2);
    assert.equal(fs.readFileSync(plan[0].destination, 'utf8'), 'updated');

    fs.writeFileSync(plan[0].destination, 'foreign');
    fs.writeFileSync(plan[0].source, 'different');
    assert.throws(
      () => port.normalizePackageArtifacts(paths, baseline),
      /Refusing to overwrite a different Ember installer package/,
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
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

test('managed configuration overlays upgrade only from their exact stamped bytes', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-config-overlay-fixture-'));
  const paths = { configurationRoot: fixtureRoot };
  const originalPlan = {
    files: [{
      relativePath: 'build.py',
      expected: Buffer.from('original\r\n'),
      acceptedBeforePrepare: [Buffer.from('original\r\n')],
      text: true,
    }],
  };
  try {
    port.prepareConfigurationOverlay(paths, originalPlan);
    const expectedHash = port.configurationOverlayHash(originalPlan);
    assert.equal(port.existingConfigurationOverlayHash(paths, originalPlan), expectedHash);

    const upgradedPlan = {
      files: [
        {
          relativePath: 'build.py',
          expected: Buffer.from('upgraded\n'),
          acceptedBeforePrepare: [Buffer.from('upgraded\n')],
          text: true,
        },
        {
          relativePath: 'ember-resources/asset.bin',
          expected: Buffer.from('asset'),
          acceptedBeforePrepare: [Buffer.from('asset')],
        },
      ],
    };
    port.prepareConfigurationOverlay(paths, upgradedPlan, true);
    assert.equal(fs.readFileSync(path.join(fixtureRoot, 'build.py'), 'utf8'), 'upgraded\n');
    assert.equal(fs.readFileSync(path.join(fixtureRoot, 'ember-resources', 'asset.bin'), 'utf8'),
      'asset');

    fs.writeFileSync(path.join(fixtureRoot, 'build.py'), 'foreign');
    assert.notEqual(port.existingConfigurationOverlayHash(paths, upgradedPlan),
      port.configurationOverlayHash(upgradedPlan));
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
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

// The native parity specs are hand-copied numbers. Nothing stops the Electron
// oracle from moving underneath them, and a stale spec is worse than none: the
// next native slice would be built to a measurement that is no longer true.
// These read the oracle back and fail when the two disagree.
const ORACLE_ROOT = path.join(__dirname, '..');
const SPECS_ROOT = path.join(ORACLE_ROOT, 'docs', 'superpowers', 'specs');

function cssBlock(text, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(text);
  if (!block) throw new Error(`Missing CSS rule: ${selector}`);
  return block[1];
}

function cssDeclaration(text, selector, property) {
  const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`)
    .exec(cssBlock(text, selector));
  if (!declaration) throw new Error(`Missing ${property} in ${selector}`);
  return declaration[1].trim();
}

test('the native sidebar parity spec still matches the Electron oracle it measured', () => {
  const sidebarCss = fs.readFileSync(
    path.join(ORACLE_ROOT, 'src', 'renderer', 'sidebar.css'), 'utf8',
  );
  const sidebarJs = fs.readFileSync(
    path.join(ORACLE_ROOT, 'src', 'renderer', 'sidebar.js'), 'utf8',
  );
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ORACLE_ROOT, 'chromium', 'reference', 'electron', '9ae3217', 'manifest.json'),
    'utf8',
  ));

  // The rail's coordinate system, which every native inset is derived from.
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-surface', 'padding'), '34px 9px 8px');
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-content', 'grid-template-rows'), '33px auto');
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-content', 'gap'), '10px');
  assert.deepEqual(manifest.geometry.sidebar.address, [9, 34, 159, 67]);
  assert.deepEqual(manifest.geometry.sidebar.favoritesOrigin, [9, 77]);
  // 168 rail less 9 px of padding on each side is a 150 px content column.
  assert.equal(
    manifest.geometry.shell.sidebarWidth - 18,
    manifest.geometry.sidebar.address[2] - manifest.geometry.sidebar.address[0],
  );

  // Address row.
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-address', 'height'), '33px');
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-address', 'border-radius'), '7px');
  assert.equal(
    cssDeclaration(sidebarCss, '.sidebar-address', 'background'),
    'rgba(255, 255, 255, .075)',
  );
  assert.equal(
    cssDeclaration(sidebarCss, '.sidebar-address', 'border'),
    '1px solid rgba(255, 255, 255, .025)',
  );
  assert.equal(
    cssDeclaration(sidebarCss, '.sidebar-address input', 'color'),
    'rgba(255, 255, 255, .82)',
  );
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-address-copy', 'width'), '26px');
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-address-copy img', 'width'), '12px');
  assert.equal(cssDeclaration(sidebarCss, '.sidebar-address-copy img', 'height'), '7px');
  // The oracle strips the scheme for https as well as http, and a leading www.
  assert.match(sidebarJs, /\^https\?:\\\/\\\//);
  assert.match(sidebarJs, /replace\(\/\^www\\\./);

  // Favorite tiles.
  assert.equal(cssDeclaration(sidebarCss, ':root', '--favorite-tile-height'), '43px');
  assert.equal(cssDeclaration(sidebarCss, ':root', '--favorite-gap'), '10px');
  assert.equal(cssDeclaration(sidebarCss, ':root', '--favorite-grid-height'), '98px');
  assert.equal(cssDeclaration(sidebarCss, '.favorite', 'border-radius'), '7px');
  assert.equal(
    cssDeclaration(sidebarCss, '.favorite', 'background'),
    'rgba(255, 255, 255, .075)',
  );
  assert.equal(cssDeclaration(sidebarCss, '.favorite', 'border'),
    '1px solid rgba(255, 255, 255, .025)');
  assert.equal(cssDeclaration(sidebarCss, '.favorite img', 'width'), '19px');
  // Icon-only: the tile centres a single image and carries no title text.
  assert.equal(cssDeclaration(sidebarCss, '.favorite', 'place-items'), 'center');
  assert.match(sidebarCss, /\.favorite\.is-open \{ background: rgba\(255, 255, 255, \.18\)/);

  const spec = fs.readFileSync(
    path.join(SPECS_ROOT, '2026-09-01-native-sidebar-visual-parity.md'), 'utf8',
  );
  for (const quoted of ['34px 9px 8px', '150', '33', '0x13', '0x06', '12×7', '19×19']) {
    assert.ok(spec.includes(quoted), `sidebar parity spec no longer quotes ${quoted}`);
  }
});

test('the native top-chrome parity spec still matches the Electron oracle it measured', () => {
  const layout = require('../src/shared/chrome-layout');
  const scroll = require('../src/shared/tab-scroll');
  const chromeCss = fs.readFileSync(
    path.join(ORACLE_ROOT, 'src', 'renderer', 'chrome.css'), 'utf8',
  );

  assert.equal(layout.TOPBAR_HEIGHT, 32);
  assert.equal(layout.SIDEBAR_WIDTH, 168);
  assert.equal(layout.TAB_MIN_WIDTH, 95);
  assert.equal(layout.TAB_MAX_WIDTH, 190);
  assert.equal(layout.TAB_GAP, 8);
  assert.equal(layout.NEW_TAB_WIDTH, 34);
  assert.equal(layout.DRAG_RESERVE, 96);
  assert.equal(cssDeclaration(chromeCss, ':root', '--tab-height'), '28px');
  assert.equal(cssDeclaration(chromeCss, ':root', '--tab-radius'), '6px');
  assert.equal(cssDeclaration(chromeCss, ':root', '--caption-width'), '138px');

  // The dynamic width formula the native strip has to reproduce exactly.
  assert.equal(layout.dynamicTabMax({ availableWidth: 0, count: 0 }), 190);
  assert.equal(layout.dynamicTabMax({ availableWidth: 2000, count: 4 }), 190);
  assert.equal(layout.dynamicTabMax({ availableWidth: 400, count: 4 }), 95);
  assert.equal(
    layout.dynamicTabMax({ availableWidth: 900, count: 5 }),
    Math.floor((900 - 34 - 96 - 8 * 4) / 5),
  );

  // Wheel physics.
  assert.equal(scroll.STEP, 132);
  assert.equal(scroll.STEP_MAX, 430);
  assert.equal(scroll.OVERSCROLL_LIMIT, 44);
  assert.equal(scroll.OVERSCROLL_STEP, 17);
  assert.equal(scroll.strideFor(Number.POSITIVE_INFINITY), 132);

  const spec = fs.readFileSync(
    path.join(SPECS_ROOT, '2026-09-01-native-top-chrome-parity.md'), 'utf8',
  );
  for (const quoted of ['132 px base stride', '430 px', '44 px', '17 px', '138 px', '28 px']) {
    assert.ok(spec.includes(quoted), `top-chrome parity spec no longer quotes ${quoted}`);
  }
});

test('the tab states the native strip has to reproduce are still the oracle values', () => {
  const chromeCss = fs.readFileSync(
    path.join(ORACLE_ROOT, 'src', 'renderer', 'chrome.css'), 'utf8',
  );

  // Sampled from the running oracle on 2026-09-02, 320ms after each class
  // change so the 120ms transitions had finished. Reading these at t=0 returns
  // the outgoing state, which is how they were mismeasured the first time.
  assert.equal(cssDeclaration(chromeCss, '.tab', 'background'), 'rgba(255, 255, 255, .075)');
  assert.equal(cssDeclaration(chromeCss, '.tab', 'border'), '1px solid rgba(255, 255, 255, .035)');
  assert.equal(cssDeclaration(chromeCss, '.tab', 'color'), 'rgba(255, 255, 255, .70)');
  assert.equal(cssDeclaration(chromeCss, '.tab', 'font-size'), '12.5px');
  assert.equal(cssDeclaration(chromeCss, '.tab', 'padding'), '0 9px');
  assert.equal(cssDeclaration(chromeCss, '.tab', 'gap'), '7px');
  assert.equal(cssDeclaration(chromeCss, '.tab.active', 'background'), 'rgba(24, 20, 19, .82)');
  assert.equal(cssDeclaration(chromeCss, '.tab.active', 'border-color'), 'rgba(255, 91, 0, .80)');
  assert.equal(cssDeclaration(chromeCss, '.tab.active', 'color'), 'rgba(255, 255, 255, .94)');
  assert.equal(
    cssDeclaration(chromeCss, '.tab.asleep', 'background'), 'rgba(255, 255, 255, .025)',
  );
  assert.equal(cssDeclaration(chromeCss, '.tab.asleep', 'color'), 'rgba(255, 255, 255, .43)');
  assert.match(chromeCss, /\.tab:hover \{ background: rgba\(255, 255, 255, \.10\)/);
  assert.match(chromeCss, /\.tab\.dragging \{ opacity: \.34/);
  // Close button: only present on hover, and inset 5px from the tab's edge.
  assert.equal(cssDeclaration(chromeCss, '.tab-close', 'width'), '28px');
  assert.equal(cssDeclaration(chromeCss, '.tab-close', 'right'), '5px');
  assert.equal(cssDeclaration(chromeCss, '.tab-close', 'opacity'), '0');
  assert.equal(cssDeclaration(chromeCss, '.tab-close', 'background'), 'rgba(35, 29, 27, .96)');
  // The sleeping glyph pair.
  assert.equal(cssDeclaration(chromeCss, '.tab-sleep', 'width'), '16px');
  assert.equal(cssDeclaration(chromeCss, '.tab-sleep', 'height'), '18px');
  assert.equal(cssDeclaration(chromeCss, '.tab-sleep', 'color'), 'rgba(255, 255, 255, .38)');

  const spec = fs.readFileSync(
    path.join(SPECS_ROOT, '2026-09-01-native-top-chrome-parity.md'), 'utf8',
  );
  assert.ok(spec.includes('Runtime-verified measurements'),
    'the runtime measurement section is gone from the top-chrome spec');
  for (const quoted of ['rgba(24,20,19,.82)', 'rgba(255,91,0,.80)', 'grayscale(1)',
    'innerHeight: 32', '--tab-max-width: 100px']) {
    assert.ok(spec.includes(quoted), `top-chrome spec no longer quotes ${quoted}`);
  }
});

test('the native capture runner targets the exact oracle viewports', () => {
  const capture = require('../chromium/tools/capture-native');
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ORACLE_ROOT, 'chromium', 'reference', 'electron', '9ae3217', 'manifest.json'),
    'utf8',
  ));

  // A native capture is only comparable to the committed reference if it is
  // taken at the same window size the reference was taken at.
  for (const viewport of capture.VIEWPORTS) {
    const reference = manifest.geometry[viewport.name];
    assert.ok(reference, `oracle manifest has no ${viewport.name} geometry`);
    assert.deepEqual([viewport.width, viewport.height], reference.viewport,
      `${viewport.name} capture size drifted from the oracle`);
  }
  assert.deepEqual(capture.VIEWPORTS.map((v) => v.name), ['wide', 'medium', 'compact']);

  const parsed = capture.parseArgs(['--out', 'dir', '--port', '9301', '--display-x', '-1060']);
  assert.equal(parsed.out, 'dir');
  assert.equal(parsed.port, 9301);
  assert.equal(parsed.displayX, -1060);
  assert.throws(() => capture.parseArgs([]), /--out/);
  assert.throws(() => capture.parseArgs(['--out']), /needs a value/);
  assert.throws(() => capture.parseArgs(['--out', 'd', '--nope']), /Unknown argument/);

  // Synthetic input is banned in this harness; it must drive CDP instead.
  const source = fs.readFileSync(
    path.join(ORACLE_ROOT, 'chromium', 'tools', 'capture-native.js'), 'utf8',
  );
  assert.doesNotMatch(source, /SendKeys|keybd_event|mouse_event|Input\.dispatch/);
  assert.doesNotMatch(source, /no-sandbox/);
  assert.match(source, /Page\.captureScreenshot/);
  assert.match(source, /Browser\.close/);
});

test('the patch hunk checker catches the stale counts a hand edit leaves behind', () => {
  const checker = require('../chromium/tools/check-patch-hunks');

  const good = [
    'diff --git a/f.cc b/f.cc',
    '--- a/f.cc',
    '+++ b/f.cc',
    '@@ -1,3 +1,4 @@',
    ' one',
    '+inserted',
    ' two',
    ' three',
    '',
  ].join('\n');
  assert.deepEqual(checker.checkPatchText(good), { hunks: 1, defects: [] });

  // The exact failure mode: a line was added to the body and the header was
  // left alone, so `patch` aborts with "malformed patch" mid-build.
  const stale = good.replace(' three', ' three\n+also inserted');
  const staleResult = checker.checkPatchText(stale);
  assert.equal(staleResult.defects.length, 1);
  assert.equal(staleResult.defects[0].declaredNew, 4);
  assert.equal(staleResult.defects[0].actualNew, 5);
  assert.equal(staleResult.defects[0].actualOld, 3);

  // A hunk header with no comma means exactly one line on that side.
  const single = [
    '@@ -5 +5 @@',
    '-before',
    '+after',
  ].join('\n');
  assert.deepEqual(checker.checkPatchText(single).defects, []);

  // "\ No newline at end of file" annotates the previous line, it is not one.
  const noNewline = [
    '@@ -1,2 +1,2 @@',
    ' kept',
    '-old',
    '+new',
    '\\ No newline at end of file',
  ].join('\n');
  assert.deepEqual(checker.checkPatchText(noNewline).defects, []);

  // Several files in one patch: a new file header ends the preceding hunk.
  const twoFiles = [
    '@@ -1 +1 @@',
    '-a',
    '+b',
    'diff --git a/g.cc b/g.cc',
    '--- a/g.cc',
    '+++ b/g.cc',
    '@@ -9 +9 @@',
    '-c',
    '+d',
  ].join('\n');
  assert.equal(checker.checkPatchText(twoFiles).hunks, 2);
  assert.deepEqual(checker.checkPatchText(twoFiles).defects, []);

  // It reads the real series, so a new patch is covered without being listed.
  const seriesPaths = checker.seriesPatchPaths();
  assert.equal(seriesPaths.length, port.parseSeriesEntries().length);
  for (const file of seriesPaths) assert.equal(fs.existsSync(file), true);
});
