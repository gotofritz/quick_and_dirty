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
const mkdirp = require('mkdirp');

const {
  getConfigOrDie,
  writeYaml,
  matcherFactory,
  log,
  logError,
  normalisePath,
} = require('./lib/shared');
const { EVENT_FILELIST_WAS_GENERATED } = require('./lib/types');

const DEFAULT_CONFIG = path.join(__dirname, 'captain_mandolin.config.yml');
const DEFAULT_CONFIG_BAK = DEFAULT_CONFIG.replace(
  /\.config\.yml/,
  '.config.yml.bak',
);
const GLOB_SETTINGS = Object.freeze({ nodir: true });
const EXTENSION_GLOB = 'mp4';

program
  .version('0.0.1')
  .option(
    `-c, --config [path]`,
    `path to a config file, default ${DEFAULT_CONFIG}`,
    DEFAULT_CONFIG,
  )
  .option(`-v, --verbose`, `verbose`)
  .option(`-q, --quiet`, `quiet`)
  .option(`-a, --add <path>`, `add a directory`)
  .option(`-d, --dry-run`, `output file list instead of copying files`)
  .parse(process.argv);

let userData = getConfigOrDie(program.config);
const config = Object.assign(
  {
    removeInitialDigits: true,
    verbose: false,
  },
  userData._config,
);

// placeholder awaiting further work...
const eventEmitter = {
  events: {},
  subscribe(evt, cb) {
    (this.events[evt] = this.events[evt] || []).push(cb);
  },
  emit(evt, args) {
    return (this.events[evt] = this.events[evt] || []).reduce(
      (accumulator, cb) => {
        return cb.call(null, accumulator);
      },
      args,
    );
  },
};

if (hasEnoughDataToWorkWith(config)) {
  writeYaml(DEFAULT_CONFIG_BAK, userData);

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
    writeYaml(DEFAULT_CONFIG, userData);
    log(!program.quiet, `Done - added dir ${program.add}`);

    // use script to move viles around
  } else {
    // placeholder awaiting further work
    require('./lib/rules/random')(eventEmitter);

    const filesToCopy = getListOfFilesToCopy(userData.instructions, config);
    if (program.dryRun) {
      log(!program.quiet, filesToCopy);
      updateUserDataInPlace(userData.instructions, filesToCopy);
      log(!program.quiet, userData);
    } else {
      const copiedFiles = copyFiles(filesToCopy, config);
      updateUserDataInPlace(userData.instructions, copiedFiles);
      writeYaml(DEFAULT_CONFIG, userData);
      log(!program.quiet, `Done - ${copiedFiles.length} files copied`);
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
    log(
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
      let candidates = [];

      // the src parameter in the instruction is the root for a deep search
      const globPath = path.join(
        config.srcRoot,
        instruction.src,
        `/**/*.${extension}`,
      );
      let files = glob.sync(globPath, GLOB_SETTINGS);
      if (files.length === 0) {
        logError(`No files found with ${globPath}`);
        return accumulator;
      }

      // ignore = regexp for file(s) not to be included in search
      if (instruction.ignore) {
        const isFileToIgnore = new RegExp(instruction.ignore);
        files = files.filter(file => !isFileToIgnore.test(file));
        if (files.length === 0) {
          logError(
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
        files = rearrangeAsBreadthFirst(files, instruction);
      }

      // howMany = self-explanatory
      instruction.howMany = instruction.spread || instruction.howMany || 1;

      ({ instruction, candidates } = eventEmitter.emit(
        EVENT_FILELIST_WAS_GENERATED,
        {
          instruction,
          files,
          candidates,
        },
      ));

      // plugins may do their own thing, in which case we don't need to find
      // files to copy. We can tell, because the candidates array has already
      // been filled up
      const shouldSkipMainLoop = candidates.length > 0;

      if (!shouldSkipMainLoop) {
        // next = the system uses .last, but when editing config manually it may
        // be more convenient to enter what we want as next file (expecially if
        // the last one was deleted or renamed)
        const indexOfLast = instruction.next
          ? files.indexOf(instruction.next) - 1
          : instruction.last ? files.indexOf(instruction.last) : -1;

        // spread = like howMany, but instead of being next to each other they
        // will be evenly spread across list. So if you have 10 files, with
        // howMany: 2 it will fetch 1,2 this time and 3,4 next and so on;
        // with spread: 2 it will fetch 1,5 this time and 2,6 next and so on
        instruction.howMany = instruction.spread || instruction.howMany;
        let increment = instruction.spread
          ? files.length / instruction.spread
          : 1;
        let i, runningCount;

        for (
          i = runningCount = 1;
          i <= instruction.howMany;
          runningCount += increment, i++
        ) {
          const src =
            files[(indexOfLast + Math.round(runningCount)) % files.length];
          const dest = handleBasenameDigits(src, {
            removeInitialDigits,
          });
          candidates.push({
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
        candidates = candidates.concat(
          getSimilarlyNamedVideos(candidates, files, {
            matchUpTo: instruction.matchUpTo,
          }),
        );
      }

      accumulator = accumulator.concat(
        candidates.map(candidate =>
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
  candidate.src = normalisePath(candidate.src, config.srcRoot);
  candidate.dest = path.join(instruction.dest || config.dest, candidate.dest);
  return candidate;
}

// takes the array of file.src / file.dest produced by getListOfFilesToCopy and
// does the actual copying. Returns a new array, with the same list but without
// the files that caused an error
function copyFiles(filesToCopy, { verbose } = {}) {
  log(!program.quiet, 'Copying files...');
  const arrayCopy = Array.from(filesToCopy);
  arrayCopy.forEach((file, i, arr) => {
    log(verbose, `copying from ${file.src} to ${file.dest}`);
    try {
      mkdirp.sync(path.dirname(file.dest));
      fs.copyFileSync(file.src, file.dest);
    } catch (e) {
      logError(e);
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
  const matcher = matcherFactory(matchUpTo);

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
