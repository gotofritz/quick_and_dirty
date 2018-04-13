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
const mkdirp = require('mkdirp');

const CaptnM = require('./lib/shared');
const DEFAULT_CONFIG = CaptnM.defaultConfigPath();
const DEFAULT_CONFIG_BAK = DEFAULT_CONFIG.replace(
  /\.config\.yml/,
  '.config.yml.bak',
);
const program = require('./lib/file-collector/config')({
  DEFAULT_CONFIG,
});

const GLOB_SETTINGS = Object.freeze({ nodir: true });
const EXTENSION_GLOB = 'mp4';

let userData = CaptnM.getConfigOrDie(program.config);
const config = Object.assign(
  {
    removeInitialDigits: true,
    verbose: false,
  },
  userData._config,
);

// placeholder awaiting further work...
const fileCollectorEmitter = require('./lib/file-collector/emitter');

if (hasEnoughDataToWorkWith(config)) {
  CaptnM.writeYaml(DEFAULT_CONFIG_BAK, userData);

  // use script to add a directory to the config
  if (program.add) {
    userData.instructions = addInstruction(
      program.add,
      userData.instructions,
      config,
    );
    userData.instructions.sort(
      (a, b) => (a.src > b.src ? 1 : a.src < b.src ? -1 : 0),
    );
    CaptnM.writeYaml(DEFAULT_CONFIG, userData);
    CaptnM.log(!program.quiet, `Done - added dir ${program.add}`);

    // use script to move viles around
  } else {
    // placeholder awaiting further work
    require('./lib/file-collector/rules/random')(fileCollectorEmitter);

    const filesToCopy = getListOfFilesToCopy(userData.instructions, config);
    if (program.dryRun) {
      CaptnM.log(!program.quiet, filesToCopy);
      updateUserDataInPlace(userData.instructions, filesToCopy);
      CaptnM.log(!program.quiet, userData);
    } else {
      const copiedFiles = copyFiles(filesToCopy, config);
      updateUserDataInPlace(userData.instructions, copiedFiles);
      CaptnM.writeYaml(DEFAULT_CONFIG, userData);
      CaptnM.log(!program.quiet, `Done - ${copiedFiles.length} files copied`);
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
    instruction => instruction.src === dir,
  );
  if (alreadyThereAt > -1) {
    CaptnM.log(
      !program.quiet,
      `Directory already there - adding anyway. ${JSON.stringify(
        copyOfInstructions[alreadyThereAt],
        null,
        2,
      )}`,
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
      // disabled = ignore
      if (instruction.disabled) return accumulator;

      instruction.refToInstruction = refToInstruction;
      const { removeInitialDigits = config.removeInitialDigits } = instruction;

      // fixed = just copy the file(s) in the list and return, do nothing clever
      // with the config
      if (instruction.fixed) {
        return accumulator.concat(
          pushFixed(instruction.fixed, {
            removeInitialDigits,
            srcPath: path.join(config.srcRoot, instruction.src),
            destPath: instruction.dest || config.dest,
          }),
        );
      }

      // we keep the list of movies in a separate list for further processing
      // before adding it to the master list
      let filesToAdd = [];

      // the src parameter in the instruction is the root for a deep search
      const globPath = path.join(
        config.srcRoot,
        instruction.src,
        `/**/*.${extension}`,
      );
      let allFiles = glob.sync(globPath, GLOB_SETTINGS);
      if (allFiles.length === 0) {
        CaptnM.logError(`No files found with ${globPath}`);
        return accumulator;
      }

      // ignore = regexp for file(s) not to be included in search
      if (instruction.ignore) {
        const isFileToIgnore = new RegExp(instruction.ignore);
        allFiles = allFiles.filter(file => !isFileToIgnore.test(file));
        if (allFiles.length === 0) {
          CaptnM.logError(
            `No files left in ${instruction.src} after applying ignore: ${
              instruction.ignore
            }`,
          );
          return accumulator;
        }
      }

      // breadth = go across subfolder instead of drilling down each. Note that
      // you can pass a number to have a mixture of the two; so for example
      // with breadth 1 it will be a normal breadt-first search, but with 2:
      // america/argentina
      // america/bolivia
      // asia/afghanistan
      // asia/armenia
      // europe/albania
      // europe/andorra
      // america/brazil
      // ...
      if (instruction.breadth) {
        allFiles = rearrangeAsBreadthFirst(allFiles, instruction);
      }

      // howMany = self-explanatory
      instruction.howMany = instruction.spread || instruction.howMany || 1;

      ({ instruction, filesToAdd } = fileCollectorEmitter.fileListWasGenerated({
        instruction,
        allFiles,
        filesToAdd,
      }));

      // plugins may do their own thing, in which case we don't need to find
      // files to copy. We can tell, because the candidates array has already
      // been filled up
      const shouldSkipMainLoop = filesToAdd.length > 0;

      if (!shouldSkipMainLoop) {
        // next = the system uses .last, but when editing config manually it may
        // be more convenient to enter what we want as next file (expecially if
        // the last one was deleted or renamed)
        const indexOfLast = instruction.next
          ? allFiles.indexOf(instruction.next) - 1
          : instruction.last ? allFiles.indexOf(instruction.last) : -1;

        // spread = like howMany, but instead of being next to each other they
        // will be evenly spread across list. So if you have 10 files, with
        // howMany: 2 it will fetch 1,2 this time and 3,4 next and so on;
        // with spread: 2 it will fetch 1,5 this time and 2,6 next and so on
        instruction.howMany = instruction.spread || instruction.howMany;
        let increment = instruction.spread
          ? allFiles.length / instruction.spread
          : 1;
        let i, runningCount;

        for (
          i = runningCount = 1;
          i <= instruction.howMany;
          runningCount += increment, i++
        ) {
          const src =
            allFiles[
              (indexOfLast + Math.round(runningCount)) % allFiles.length
            ];
          const dest = handleBasenameDigits(src, {
            removeInitialDigits,
          });
          filesToAdd.push({
            // for debugging
            refToInstruction,
            isLast: false,

            // the actual file copying data
            src,
            dest,
          });
        }
      }

      // matchUpTo = if there are similarly named videos (typically numbered
      // sequences such as Kudo Trailer #1.mp4 Kudo Trailer #2.mp4) get all
      // those who who share the beginning of the name with the next one. "The
      // beginning of the name" is defined as the part of the name from the
      // beginning until the sequence of char(s) matchUpTo (in the example
      // above that could be '#' or 'Trailer #')
      if (instruction.matchUpTo) {
        filesToAdd = filesToAdd.concat(
          getSimilarlyNamedVideos(filesToAdd, allFiles, {
            matchUpTo: instruction.matchUpTo,
          }),
        );
      }

      accumulator = accumulator.concat(
        filesToAdd.map(candidate =>
          normaliseCandidate(candidate, instruction, config),
        ),
      );

      // isLast decides whether the file will be the one written as
      // 'last' in the userData
      accumulator[accumulator.length - 1].isLast = true;
      return accumulator;
    },
    [],
  );
  return filesToCopy;
}

function normaliseCandidate(candidate, instruction, config) {
  candidate.src = CaptnM.normalisePath(candidate.src, config.srcRoot);
  candidate.dest = path.join(
    instruction.dest || config.dest,
    path.basename(candidate.dest),
  );
  return candidate;
}

// takes the array of file.src / file.dest produced by getListOfFilesToCopy and
// does the actual copying. Returns a new array, with the same list but without
// the files that caused an error
function copyFiles(filesToCopy, { verbose } = {}) {
  CaptnM.log(!program.quiet, 'Copying files...');
  const arrayCopy = Array.from(filesToCopy);
  arrayCopy.forEach((file, i, arr) => {
    CaptnM.log(verbose, `copying from ${file.src} to ${file.dest}`);
    try {
      mkdirp.sync(path.dirname(file.dest));
      fs.copyFileSync(file.src, file.dest);
    } catch (e) {
      CaptnM.logError(e);
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
function rearrangeAsBreadthFirst(files, { breadth = 1 } = {}) {
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

  for (let i = 0; i < maxLength; i += breadth) {
    folderMap.forEach((value, key, map) => {
      rearrangedFiles.push(...value.splice(0, breadth));
      if (value.length === 0) {
        map.delete(key);
      }
    });
  }
  return rearrangedFiles;
}

function getSimilarlyNamedVideos(
  similarTo,
  oneOfTheseVideos,
  { matchUpTo } = {},
) {
  const matcher = CaptnM.matcherFactory(matchUpTo);

  const similarlyNamed = similarTo.reduce((accumulator, current) => {
    const currentBasename = path.basename(current.src);
    const basenameMatch = matcher(currentBasename);
    if (!basenameMatch) return accumulator;

    const isBasenameEqual = b =>
      b.substr(0, basenameMatch.length) === basenameMatch;

    const fileGroup = oneOfTheseVideos
      .map(fullpath => path.basename(fullpath))
      .filter(basename => {
        return basename !== currentBasename && isBasenameEqual(basename);
      })
      .map(src => ({
        ...current,
        src: path.join(path.dirname(current.src), src),
        dest: path.join(path.dirname(current.dest), src),
      }));
    return accumulator.concat(fileGroup);
  }, []);

  return similarlyNamed;
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

function pushFixed(fixed, instructionConfig) {
  // [].concat forces an array
  return [].concat(fixed).map(src => {
    const destBasename = handleBasenameDigits(src, instructionConfig);
    return {
      // setting isLast to false ensures the config will not be updated
      // for this entry, so ti will be there until manually changed
      isLast: false,
      src: path.join(instructionConfig.srcPath, src),
      dest: path.join(instructionConfig.destPath, destBasename),
    };
  });
}
