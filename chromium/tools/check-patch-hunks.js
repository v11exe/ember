#!/usr/bin/env node
'use strict';

// Verify that every hunk header in the Ember patch stack agrees with its body.
//
// A hand-edited patch is the one failure mode this stack has actually suffered:
// changing lines inside a hunk without updating the `@@ -a,b +c,d @@` counts
// produces a file that reads fine and that `patch` refuses outright, halfway
// through a build, with only "malformed patch at line N" to go on. This finds
// it in milliseconds instead.
//
//   node chromium/tools/check-patch-hunks.js [patch...]
//
// With no arguments it checks every patch named in chromium/patches/series.

const fs = require('node:fs');
const path = require('node:path');

const port = require('./port');

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * @returns {{hunks: number, defects: Array<{line: number, header: string,
 *   declaredOld: number, declaredNew: number, actualOld: number,
 *   actualNew: number}>}}
 */
function checkPatchText(text) {
  // A trailing newline terminates the last line; it is not an extra empty one.
  const lines = text.replace(/\n$/, '').split('\n');
  const defects = [];
  let hunks = 0;
  let current = null;

  const finish = () => {
    if (!current) return;
    hunks += 1;
    if (current.actualOld !== current.declaredOld || current.actualNew !== current.declaredNew) {
      defects.push({ ...current });
    }
    current = null;
  };

  lines.forEach((line, index) => {
    const match = HUNK_HEADER.exec(line);
    if (match) {
      finish();
      current = {
        line: index + 1,
        header: line,
        // An omitted count means exactly one line.
        declaredOld: match[2] === undefined ? 1 : Number(match[2]),
        declaredNew: match[4] === undefined ? 1 : Number(match[4]),
        actualOld: 0,
        actualNew: 0,
      };
      return;
    }
    if (!current) return;
    if (line.startsWith('diff --git') || line.startsWith('--- ')
      || line.startsWith('+++ ') || line.startsWith('index ')) {
      finish();
      return;
    }
    // "\ No newline at end of file" annotates the preceding line; it is not one.
    if (line.startsWith('\\')) return;
    if (line.startsWith('+')) current.actualNew += 1;
    else if (line.startsWith('-')) current.actualOld += 1;
    else { current.actualOld += 1; current.actualNew += 1; }
  });
  finish();

  return { hunks, defects };
}

function checkPatchFile(file) {
  return { file, ...checkPatchText(fs.readFileSync(file, 'utf8')) };
}

function seriesPatchPaths() {
  return port.parseSeriesEntries()
    .map((entry) => path.join(port.PATCHES_ROOT, ...entry.split('/')));
}

function main(argv) {
  const files = argv.length ? argv : seriesPatchPaths();
  let broken = 0;
  for (const file of files) {
    const result = checkPatchFile(file);
    const name = path.basename(result.file);
    if (!result.defects.length) {
      console.log(`ok      ${name} (${result.hunks} hunks)`);
      continue;
    }
    broken += 1;
    console.log(`BROKEN  ${name} (${result.defects.length}/${result.hunks} hunks)`);
    for (const defect of result.defects) {
      console.log(`        line ${defect.line}: ${defect.header}`);
      console.log(`          declared -${defect.declaredOld} +${defect.declaredNew}`
        + `, body has -${defect.actualOld} +${defect.actualNew}`);
    }
  }
  if (broken) {
    console.log(`\n${broken} patch${broken === 1 ? '' : 'es'} would fail to apply.`);
    console.log('Regenerate it from the exact pre/postimage rather than editing the counts.');
  }
  return broken;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2)) ? 1 : 0;
}

module.exports = { checkPatchText, checkPatchFile, seriesPatchPaths };
