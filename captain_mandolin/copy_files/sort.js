#! /usr/bin/env node

const glob = require('glob');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const mkdirp = require('mkdirp');
const fs = require('fs');

const DEFAULT_DIRS = 47;
const SUFFIX = '/**/*.mp4';
const PAD = 2;
let src = argv.s || argv.src;
if (!src) {
  throw Error('No -s or --src passed');
}
const DEFAULT_DEST = path.join(src, '_RESORTED');

const max = argv.m || argv.max || DEFAULT_DIRS;
const dest = argv.d || argv.dest || DEFAULT_DEST;
mkdirp.sync(dest);

src = path.resolve(argv.s || argv.src);

const sortFn =
  argv.r || argv.random
    ? () => (Math.random() > 0.5 ? 1 : -1)
    : (a, b) => a - b;

const sources = glob.sync(src + SUFFIX).sort(sortFn);

const dt = max / sources.length;
// start with a random int
let offset =
  Number(
    Math.random()
      .toString()
      .substr(2),
  ) / max;

for (let i = 0; i < sources.length; i++) {
  const prefix = String(1 + (Math.round(offset) % max)).padStart(PAD, '0');
  const destPath = path.join(
    dest,
    prefix + ' ' + path.basename(sources[i]).replace(/^\d+ /, ''),
  );
  offset += dt;
  // console.log('offset', offset);
  console.log(`COPYING ${sources[i]} ${destPath}`);
  fs.copyFileSync(sources[i], destPath);
}

console.log('DONE');
