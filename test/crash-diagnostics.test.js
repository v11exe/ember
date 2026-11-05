'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {archiveSymbols, collect, sha256} = require('../chromium/tools/crash-diagnostics');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-crash-test-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const output = path.join(root, 'output');
  fs.mkdirSync(output);
  for (const name of ['chrome.dll', 'chrome.dll.pdb', 'chrome.exe', 'chrome.exe.pdb']) {
    fs.writeFileSync(path.join(output, name), name + ': build one');
  }
  return {root, output};
}

test('symbol archives survive subsequent builds and reject inconsistent pairs', t => {
  const {root, output} = fixture(t);
  const archive = archiveSymbols(output, root);
  assert.equal(archiveSymbols(output, root), archive);
  fs.writeFileSync(path.join(output, 'chrome.exe'), 'relinked executable');
  fs.writeFileSync(path.join(output, 'chrome.exe.pdb'), 'relinked executable symbols');
  assert.equal(archiveSymbols(output, root), archive);
  fs.writeFileSync(path.join(output, 'chrome.dll.pdb'), 'wrong symbols');
  assert.throws(() => archiveSymbols(output, root), /archive differs/);
  fs.writeFileSync(path.join(output, 'chrome.dll'), 'build two');
  assert.notEqual(archiveSymbols(output, root), archive);
  assert.equal(fs.readFileSync(path.join(archive, 'chrome.dll'), 'utf8'), 'chrome.dll: build one');
});

test('collector preserves only five newest dumps and reports missing matching symbols', t => {
  const {root, output} = fixture(t);
  const dumpRoot = path.join(root, 'dumps');
  fs.mkdirSync(dumpRoot);
  for (let i = 0; i < 7; i++) {
    const file = path.join(dumpRoot, `chrome.exe.${i}.dmp`);
    fs.writeFileSync(file, 'dump ' + i);
    fs.utimesSync(file, new Date(1000 * i), new Date(1000 * i));
  }
  fs.writeFileSync(path.join(dumpRoot, 'python.exe.8.dmp'), 'unrelated');
  const options = {workRoot: root, installedDir: output, dumpRoot, cdb: path.join(root, 'absent.exe')};
  const report = collect(options);
  const summary = JSON.parse(fs.readFileSync(path.join(report, 'summary.json')));
  assert.equal(summary.symbols, null);
  assert.equal(summary.installedDllSha256, sha256(path.join(output, 'chrome.dll')));
  assert.equal(summary.dumps.length, 5);
  assert.equal(path.basename(summary.dumps[0].source), 'chrome.exe.6.dmp');
  assert.equal(fs.readdirSync(dumpRoot).length, 8);
  const archive = archiveSymbols(output, root);
  const matched = JSON.parse(fs.readFileSync(path.join(collect(options), 'summary.json')));
  assert.equal(matched.symbols, archive);
});
