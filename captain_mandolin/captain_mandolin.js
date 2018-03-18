#!/usr/bin/env node

/**
 * Script to move a selection of movie files in rotation from one repository
 * folder to a detination folder. Say you have a repo with this structure:
 * Cartoons/
 *   Biene Maia/
 *     BM01.mp4
 *     BM02.mp4
 *   Sandmännchen/
 *     S01.mp4
 * Documentaries/
 *   01.mp4
 *   02.mp4
 * ...
 * and in your config file you have Cartoons/ and Documentaries/ as your folders
 * then the first time you run it you'll copy to dest:
 *   Cartoons/Biene Maia/BM01.mp4, Documentaries/01.mp4
 * then following runs will yield
 *   Cartoons/Biene Maia/BM02.mp4, Documentaries/02.mp4
 *   Cartoons/Sandmännchen/S01.mp4, Documentaries/01.mp4
 *   ...
 *
 * Usage:
 *    captain_mandolin
 * copies a new set of files (you need to delete old one manually)
 *
 *   captain_mandolin -a /pth/to/folder
 * adds a new folder to instructions (no file wil be copied)
 *
 *   captian_mandolin -c /pth/to/config
 * deine a config file
 *
 *
 */

const glob = require('glob');
const path = require('path');
const fs = require('fs');
const program = require('commander');
const yaml = require('js-yaml');
const mkdirp = require('mkdirp');

const { getConfigOrDie, writeYaml } = require('./lib/shared');

const DEFAULT_CONFIG = path.join(
  __dirname,
  'captain_mandolin.config.yml'
);
const DEFAULT_CONFIG_BAK = DEFAULT_CONFIG.replace(
  /\.config\.yml/,
  '.config.yml.bak'
);
const GLOB_SETTINGS = Object.freeze({ nodir: true });
const EXTENSION_GLOB = 'mp4';

program
  .version('0.0.1')
  .option(
    `-c, --config [path]`,
    `path to a config file, default ${DEFAULT_CONFIG}`,
    DEFAULT_CONFIG
  )
  .option(`-v, --verbose`, `verbose`)
  .option(`-a, --add <path>`, `add a directory`)
  .option(`-d, --dry-run`, `output file list instead of copying files`)
  .parse(process.argv);

let userData = getConfigOrDie(program.config);
const config = Object.assign(
  {
    removeInitialDigits: true,
    verbose: false
  },
  userData._config
);

if (hasEnoughDataToWorkWith(config)) {
  writeYaml(DEFAULT_CONFIG_BAK, userData);

  // use script to add a directory to the config
  if (program.add) {
    userData.instructions = addInstruction(
      program.add,
      userData.instructions,
      config
    );
    userData.instructions.sort(
      (a, b) => (a.src > b.src ? 1 : a.src < b.src ? -1 : 0)
    );
    writeYaml(DEFAULT_CONFIG, userData);
    console.log(`Done - added dir ${program.add}`);

    // use script to move viles around
  } else {
    const filesToCopy = getListOfFilesToCopy(
      userData.instructions,
      config
    );
    if (program.dryRun) {
      console.log(filesToCopy);
    } else {
      const copiedFiles = copyFiles(filesToCopy, config);
      updateUserDataInPlace(userData.instructions, copiedFiles);
      writeYaml(DEFAULT_CONFIG, userData);
      console.log(`Done - ${copiedFiles.length} files copied`);
    }
  }
}
process.exit();

// =======================================================

// adds a folder to settings
function addInstruction(pth, instructions, { srcRoot = '' } = {}) {
  const copyOfInstructions = Array.from(instructions);
  const isFile = Boolean(path.extname(pth));
  const dir = isFile ? path.dirname(pth) : pth;
  const src =
    dir[srcRoot.length] === '/'
      ? dir.substr(srcRoot.length + 1)
      : dir.substr(srcRoot.length);
  const instruction = isFile ? { src, next: pth } : { src };
  const alreadyThereAt = copyOfInstructions.findIndex(
    instruction => instruction.src === dir
  );
  if (alreadyThereAt > -1) {
    console.log(
      `Directory already there - adding anyway. ${JSON.stringify(
        copyOfInstructions[alreadyThereAt],
        null,
        2
      )}`
    );
  }
  copyOfInstructions.push(instruction);
  return copyOfInstructions;
}

// processes the instruction and decides what that means in terms of which
// files need to be copied where. It generates an array with resolved paths
function getListOfFilesToCopy(instructions, config = {}) {
  const { extension = EXTENSION_GLOB } = config;

  const filesToCopy = instructions.reduce(
    (accumulator, instruction, refToInstruction) => {
      if (instruction.disabled) return accumulator;

      const {
        removeInitialDigits = config.removeInitialDigits
      } = instruction;

      if (instruction.fixed) {
        if (!Array.isArray(instruction.fixed)) {
          instruction.fixed = Array.of(instruction.fixed);
        }
        accumulator.push(
          ...instruction.fixed.map(src => {
            const destBasename = handleBasenameDigits(src, {
              removeInitialDigits
            });
            return {
              // without isLast, config will not be updated
              isLast: false,
              src: path.join(config.srcRoot, instruction.src, src),
              dest: path.join(
                instruction.dest || config.dest,
                destBasename
              )
            };
          })
        );
        return accumulator;
      }

      const globPath = path.join(
        config.srcRoot,
        instruction.src,
        `/**/*.${extension}`
      );
      let files = glob.sync(globPath, GLOB_SETTINGS);
      if (files.length === 0) return accumulator;

      if (instruction.ignore) {
        const isFileToIgnore = new RegExp(instruction.ignore);
        files = files.filter(file => !isFileToIgnore.test(file));
      }
      if (String(instruction.traversal).toLowerCase() === 'breadth') {
        files = rearrangeAsBreadthFirst(files);
      }

      const indexOfLast = instruction.next
        ? files.indexOf(instruction.next) - 1
        : instruction.last ? files.indexOf(instruction.last) : -1;

      if (instruction.matchUpTo) {
        instruction.howMany = getNumberOfVideosMatching(files, {
          matchUpTo: instruction.matchUpTo,
          indexOfLast
        });
      }

      instruction.howMany = instruction.howMany || 1;

      for (let i = 1; i <= instruction.howMany; i++) {
        const src = files[(indexOfLast + i) % files.length];
        const destBasename = handleBasenameDigits(src, {
          removeInitialDigits
        });
        accumulator.push({
          refToInstruction,
          isLast: i === instruction.howMany,
          src,
          dest: path.join(instruction.dest || config.dest, destBasename)
        });
      }
      return accumulator;
    },
    []
  );
  return filesToCopy;
}

// takes the array of file.src / file.dest produced by getListOfFilesToCopy and
// does the actual copying. Returns a new array, with the same list but without
// the files that caused an error
function copyFiles(filesToCopy, { verbose, removeInitialDigits } = {}) {
  console.log('Copying files...');
  const arrayCopy = Array.from(filesToCopy);
  arrayCopy.forEach((file, i, arr) => {
    if (verbose) {
      console.log(`copying from ${file.src} to ${file.dest}`);
    }
    try {
      mkdirp.sync(path.dirname(file.dest));
      fs.copyFileSync(file.src, file.dest);
    } catch (e) {
      console.log(`ERROR ${e}`);
      // we rely on the fact that once a forEach loop is initialised, the array
      // it is working with is 'frozen' and any changes to it will not affect
      // the loop
      arr.splice(i, 1);
    }
  });
  return arrayCopy;
}

// once we know what files where actually copied, use that information to
// update the settings for the next iteration
function updateUserDataInPlace(instructions, copiedFiles = []) {
  copiedFiles.filter(file => file.isLast).forEach(file => {
    instructions[file.refToInstruction].last = file.src;
    delete instructions[file.refToInstruction].next;
  });
  return instructions;
}

// Takes an array of files generated by glob and rearranges it in breadth-first
// order, i.e.
// america/argentina
// asia/azerbijan
// europe/andorra
// america/brazil...
function rearrangeAsBreadthFirst(files) {
  let folderMap = new Map();
  folderMap.set('maxLength', 0);
  const rearrangedFiles = [];

  folderMap = files.reduce((accumulator, file) => {
    const dirname = path.dirname(file);
    if (!accumulator.has(dirname)) {
      accumulator.set(dirname, []);
    }
    accumulator.get(dirname).push(file);
    const len = accumulator.get(dirname).length;
    if (len > accumulator.get('maxLength')) {
      accumulator.set('maxLength', len);
    }
    return accumulator;
  }, folderMap);

  const maxLength = folderMap.get('maxLength');
  folderMap.delete('maxLength');

  for (let i = 0; i < maxLength; i++) {
    folderMap.forEach((value, key, map) => {
      rearrangedFiles.push(value.shift());
      if (value.length === 0) {
        map.delete(key);
      }
    });
  }
  return rearrangedFiles;
}

// when an instruction is called with param 'matchUpTo' (typically a string like
// #) then script will try and copy all the files whose name start with the same
// string as the next one due; e.g.
// Pimpa #1.mp4
// Pimpa #2 At the seaside.mp4 ...
// This function works out how many such files to copy
function getNumberOfVideosMatching(
  files,
  { indexOfLast, matchUpTo } = {}
) {
  let howMany;
  let i = (indexOfLast + 1) % files.length;
  const nextFile = files[i];
  const whereIsMatch = nextFile.indexOf(matchUpTo);
  if (whereIsMatch !== -1) {
    const stem = nextFile.substring(0, whereIsMatch);
    while (files[i].substr(0, whereIsMatch) === stem) {
      i += 1;
    }
    howMany = i - indexOfLast - 1;
  }
  return howMany;
}

// early exit
function hasEnoughDataToWorkWith(data = {}) {
  return data.srcRoot && data.dest;
}

function handleBasenameDigits(src, { removeInitialDigits } = {}) {
  return removeInitialDigits
    ? path.basename(src).replace(/^([A-Z]{2,6} )?\d+ -? ?/i, '$1')
    : path.basename(src);
}
