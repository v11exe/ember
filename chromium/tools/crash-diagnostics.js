'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

function sha256(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) {
      hash.update(buffer.subarray(0, count));
    }
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

// Keep diagnostics outside the checkout and incremental build output. Each
// packaged DLL gets its own immutable symbols; later links cannot replace them.
function archiveSymbols(outputRoot, workRoot) {
  const dll = path.join(outputRoot, 'chrome.dll');
  const archive = path.join(workRoot, 'crash-symbols', sha256(dll));
  fs.mkdirSync(archive, {recursive: true});
  const hashes = {};
  for (const name of ['chrome.dll', 'chrome.dll.pdb', 'chrome.exe', 'chrome.exe.pdb']) {
    const source = path.join(outputRoot, name);
    // chrome.exe can be relinked while chrome.dll remains unchanged.
    const directory = name.startsWith('chrome.exe') ? path.join(archive,
      'exe-' + sha256(path.join(outputRoot, 'chrome.exe'))) : archive;
    fs.mkdirSync(directory, {recursive: true});
    const destination = path.join(directory, name);
    const relative = path.relative(archive, destination);
    hashes[relative] = sha256(source);
    if (fs.existsSync(destination)) {
      if (sha256(destination) !== hashes[relative]) {
        throw new Error(`Crash-symbol archive differs: ${destination}`);
      }
    } else {
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    }
  }
  fs.writeFileSync(path.join(archive, 'manifest.json'),
    JSON.stringify({sha256: hashes}, null, 2) + '\n');
  console.log(`Preserved matching crash symbols: ${archive}`);
  return archive;
}

function collect({workRoot, installedDir, dumpRoot, cdb}) {
  const reportsRoot = path.join(workRoot, 'crash-reports');
  fs.mkdirSync(reportsRoot, {recursive: true});
  const report = fs.mkdtempSync(path.join(reportsRoot,
    new Date().toISOString().replace(/[:.]/g, '-') + '-'));
  const dll = path.join(installedDir, 'chrome.dll');
  const dllHash = sha256(dll);
  const output = path.join(workRoot, 'configuration', 'build', 'src', 'out', 'Default');
  const archivesRoot = path.join(workRoot, 'crash-symbols');
  let symbols = path.join(workRoot, 'crash-symbols', dllHash);
  if (!fs.existsSync(path.join(symbols, 'chrome.dll.pdb'))) {
    symbols = fs.existsSync(path.join(output, 'chrome.dll')) &&
      sha256(path.join(output, 'chrome.dll')) === dllHash ? output : null;
  }
  // Older dumps may come from another build or the external development binary.
  // Let DbgHelp match their PDB signatures against all preserved versions.
  const archives = fs.existsSync(archivesRoot) ? fs.readdirSync(archivesRoot)
    .filter(name => /^[a-f0-9]{64}$/.test(name))
    .map(name => path.join(archivesRoot, name)) : [];
  const exeArchives = archives.flatMap(directory => fs.readdirSync(directory)
    .filter(name => /^exe-[a-f0-9]{64}$/.test(name))
    .map(name => path.join(directory, name)));
  const symbolSearchPath = [...new Set([symbols, output, ...archives, ...exeArchives, installedDir]
    .filter(directory => directory && fs.existsSync(directory)))].join(';');
  const dumps = fs.readdirSync(dumpRoot)
    .filter(name => /^chrome\.exe\.\d+\.dmp$/i.test(name))
    .map(name => ({name, time: fs.statSync(path.join(dumpRoot, name)).mtimeMs}))
    .sort((a, b) => b.time - a.time).slice(0, 5);
  const results = [];
  for (const dump of dumps) {
    const source = path.join(dumpRoot, dump.name);
    const copy = path.join(report, dump.name);
    fs.copyFileSync(source, copy, fs.constants.COPYFILE_EXCL);
    let debuggerExit = null;
    if (fs.existsSync(cdb)) {
      const log = path.join(report, dump.name + '.txt');
      const fd = fs.openSync(log, 'wx');
      try {
        const result = spawnSync(cdb,
          ['-z', copy, '-y', symbolSearchPath,
            '-c', '.ecxr; k 40; lmvm chrome; q'],
          {windowsHide: true, stdio: ['ignore', fd, fd], timeout: 60000});
        debuggerExit = result.status;
      } finally {
        fs.closeSync(fd);
      }
    }
    results.push({source, capturedAt: new Date(dump.time).toISOString(), debuggerExit});
  }
  fs.writeFileSync(path.join(report, 'summary.json'), JSON.stringify({
    installedDir, installedDllSha256: dllHash, symbols, symbolSearchPath, dumps: results,
    note: 'Dumps can include other chrome.exe installations. Check each lmvm chrome image path and symbol match before attribution. No mismatched PDB is forced.',
  }, null, 2) + '\n');
  console.log(`Collected ${dumps.length} existing crash dumps: ${report}`);
  if (!symbols) console.log('No matching symbols for the installed DLL; raw crash evidence is preserved.');
  return report;
}

if (require.main === module) {
  try {
    const options = {};
    const args = process.argv.slice(2);
    while (args.length) {
      const key = args.shift();
      if (!['--work-root', '--installed-dir', '--dump-root', '--cdb'].includes(key) || !args.length) {
        throw new Error(`Invalid option: ${key}`);
      }
      options[key] = args.shift();
    }
    const local = process.env.LOCALAPPDATA;
    collect({
      workRoot: options['--work-root'] || process.env.EMBER_CHROMIUM_ROOT || 'C:/src/ember-chromium',
      installedDir: options['--installed-dir'] || path.join(local, 'v11exe', 'Ember', 'Application', require('../baseline.json').chromium.version),
      dumpRoot: options['--dump-root'] || path.join(local, 'CrashDumps'),
      cdb: options['--cdb'] || 'C:/Program Files (x86)/Windows Kits/10/Debuggers/x64/cdb.exe',
    });
  } catch (error) {
    console.error(`Crash diagnostics: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {archiveSymbols, collect, sha256};
