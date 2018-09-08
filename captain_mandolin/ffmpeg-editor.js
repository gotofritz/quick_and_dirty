/**
 * script that takes some instructions in yaml format for splitting movie
 * files into sections using ffmpeg
 */

const LuxonDuration = require('luxon').Duration;
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const { exec, spawnSync, spawn } = require('child_process');
const program = require('commander');

const {
  as,
  getConfigOrDie,
  getDigitsNeeded,
  logError,
  log,
  defaultConfigPath,
  normalisePath,
} = require('./lib/shared');
const {
  TYPE_JOIN,
  TYPE_SPLIT,
  TYPE_CONVERT,
  TYPE_UNKNOWN,
  DEFAULT_VIDEO_EXT,
} = require('./lib/types');
const videoProcessor = require('./lib/video-processor');

const DATETIME_FORMAT = 'hh:mm:ss.SSS';
const DEFAULT_CONFIG = defaultConfigPath();
const TEMP_DIR = path.join(__dirname, '.tmp');
const REGISTERED_CMDS = Object.freeze([TYPE_JOIN, TYPE_SPLIT, TYPE_CONVERT]);
const asMilliseconds = obj => LuxonDuration.fromObject(obj).as('milliseconds');

program
  .version('0.0.1')
  .option(
    `-c, --config [path]`,
    `path to a config file, default ${DEFAULT_CONFIG}`,
    DEFAULT_CONFIG,
  )
  .option(`-v, --verbose`, `verbose`)
  .option(`-q, --quiet`, `quiet`)
  .option(`-d, --dry-run`, `output file list instead of copying files`)
  .parse(process.argv);

log(!program.quiet, 'Reading config...');
const userData = getConfigOrDie(program.config);

const config = Object.assign(
  {
    prependWithDigits: false,
  },
  userData._config,
);
log(program.verbose, config);

if (hasEnoughDataToWorkWith(config, userData)) {
  log(!program.quiet, 'Decoding instructions...');

  const instructions = userData.instructions
    .filter(rejectUnknownCmd)

    // YAML -> normalised instructions ->
    // The config can define as input a list of files and / or directories, but
    // in the end for some commands we want to have one instruction for each
    // input file, for others one instruction for each output file. Each with
    // its minimum required params, either from the instruction itself or from
    // defaults
    .reduce((accumulator, originalInstruction) => {
      accumulator = accumulator.concat(
        normaliseInstruction(originalInstruction, config),
      );
      return accumulator;
    }, []);
  log(program.verbose, 'Normalised instructions', instructions);

  // YAML -> normalised instructions -> ffmepg commands
  const cliCommands = instructions.reduce((accumulator, instruction) => {
    accumulator = accumulator.concat(generateCommand(instruction));
    return accumulator;
  }, []);
  log(program.verbose, 'cliCommands', cliCommands);
  processQueue(cliCommands);

  // process.exit();
  // const { commands } = instructions.reduce(
  //   (accumulator, instruction, i) => {
  //     const processInputInstructions = getProcessingInputInstructions(
  //       instruction,
  //     );
  //     const { lastSrc, tempVideos, commands } = processInputInstructions({
  //       instruction: instruction,
  //       tempVideos: accumulator.tempVideos,
  //       i,
  //       lastSrc: accumulator.lastSrc,
  //     });
  //     accumulator.commands = accumulator.commands.concat(commands);
  //     accumulator.tempVideos = tempVideos;
  //     accumulator.lastSrc = lastSrc;
  //     return accumulator;
  //   },
  //   {
  //     // we store the last step because a join may want to join them
  //     tempVideos: new Map(),
  //     commands: [],
  //     lastSrc: '',
  //   },
  // );

  // if (program.dryRun) {
  //   log(!program.quiet, commands);
  // } else {
  //   mkdirp(TEMP_DIR);
  //   rimraf.sync(path.join(TEMP_DIR, '*'));
  //   processQueue(commands);
  // }
}

function rejectUnknownCmd({ cmd = TYPE_UNKNOWN, src = '[none]' }) {
  if (REGISTERED_CMDS.includes(cmd)) return true;

  log(
    !program.quiet,
    `Warning: rejecting unknown command ${cmd}, src: [${src}]`,
  );
  return false;
}

function hasEnoughDataToWorkWith(data = {}, yamlData) {
  return data.srcRoot && data.dest && Boolean(yamlData.instructions);
}

// ensure the instruction (which comes straight from an user editable YAML file)
// is usable
function normaliseInstruction(instruction, config) {
  let normalisedInstructions = [];
  // some normalisations are useful for all commands
  instruction.dest = instruction.dest || config.dest;
  instruction.src = normaliseSrcToArray(instruction, config);

  switch (instruction.cmd) {
    case TYPE_SPLIT:
      if (!instruction.backtrack && config.backtrack) {
        instruction.backtrack = config.backtrack;
      }
      normalisedInstructions = createOneInstructionForEachSrc(instruction);
      break;

    case TYPE_CONVERT:
      normalisedInstructions = createOneInstructionForEachSrc(instruction).map(
        generateDestFromSrc,
      );
      break;

    case TYPE_JOIN:
      normalisedInstructions = normaliseJoinInstruction(instruction);
      break;
  }
  return normalisedInstructions;
  // normaliseOutputsInPlace({
  //   outputArray: instruction.output,
  //   dest: instruction.dest || config.dest,
  //   src: instruction.src,
  // });
}

function generateDestFromSrc(instruction) {
  instruction.dest = path.join(
    instruction.dest,
    path.basename(instruction.src, path.extname(instruction.src)) +
      DEFAULT_VIDEO_EXT,
  );
  return instruction;
}

function normaliseSrcToArray(instruction, config) {
  // It makes it easier to ensure src is always an array of files with
  // absolute path, resolving directories, relative paths, etc.
  return (
    []
      // Force an array
      .concat(instruction.src)
      // ensures each entries in array are absolute paths
      .map(individualSrc => normalisePath(individualSrc, config.srcRoot))
      // if individualSrc is a dir, resolves into a list of files
      .reduce((accumulator, individualSrc) => {
        try {
          if (fs.lstatSync(individualSrc).isDirectory()) {
            accumulator.push(
              ...fs
                .readdirSync(individualSrc)
                .filter(file => file[0] !== '.')
                .map(file => path.join(individualSrc, file)),
            );
          } else {
            accumulator.push(individualSrc);
          }
        } catch (e) {
          log(!program.quiet, `ERROR when looking for  ${individualSrc}`);
        }
        return accumulator;
      }, [])
  );
}

function normaliseJoinInstruction(instruction) {
  return instruction;
}

function createOneInstructionForEachSrc(instruction) {
  // For split we want each instruction to have one input file
  let { src, ...instructionDefaults } = instruction;
  // creates an instruction for every entry in src, using the information
  // we had put aside earlier
  return src.map(individualSrc => ({
    src: individualSrc,
    ...instructionDefaults,
  }));
}

function normaliseInstructionOutput({ output, dest, src }) {
  output.forEach((outputInstruction, i) => {
    outputInstruction.src = outputInstruction.src || src;
    // - if no 'ref' and no 'filename', assign a digit to 'ref'
    // - 'ref' must always be a string
    if (!outputInstruction.filename && !outputInstruction.ref) {
      outputInstruction.ref = i;
    }
    if ('ref' in outputInstruction) {
      outputInstruction.ref = String(outputInstruction.ref);
    }
    // ensure each instruction has a dest
    if (!outputInstruction.dest) {
      outputInstruction.dest = dest;
    }
  });
}

function generateCommand(instruction) {
  const strategy = {
    [TYPE_JOIN]: generateJoinInstructions,
    [TYPE_SPLIT]: generateSplitCommand,
    [TYPE_CONVERT]: generateConvertCommand,
    [TYPE_UNKNOWN]: () => logError(`UNKNOWN INSTRUCTION TYPE`),
  };
  return strategy[instruction.cmd](instruction);
}

function generateConvertCommand({ src, dest } = {}) {
  return videoProcessor.mp4({
    src,
    dest,
  });
}

function generateSplitCommand({
  src,
  dest,
  sections: { backtrack, duration, filename = '{basename} # {i}' },
}) {
  log(program.verbose, 'generateSplitCommand / src', src);
  log(program.verbose, 'generateSplitCommand / duration', duration);
  log(program.verbose, 'generateSplitCommand / backtrack', backtrack);
  log(program.verbose, 'generateSplitCommand / dest', dest);
  log(program.verbose, 'generateSplitCommand / filename', filename);
  const backtrackDuration = backtrack ? asMilliseconds(backtrack) : 0;
  const wholeVideoDuration = getVideoDuration(src) + backtrackDuration;
  const basename = path.basename(src, path.extname(src));
  let maxSegmentDuration = asMilliseconds(duration) + backtrackDuration;
  let numberOfSegments = Math.ceil(wholeVideoDuration / maxSegmentDuration);
  let actualSegmentDuration = wholeVideoDuration / numberOfSegments;

  let ongoingSegmentStart = 0;
  let commands = [];
  let padding = getDigitsNeeded(numberOfSegments);
  for (let i = 0; i < numberOfSegments; i++) {
    const videoProcessorArgs = {
      src,
      dest: path.join(
        dest,
        filename
          .replace(/\{basename\}/, basename)
          .replace(/\{i\}/, String(i + 1).padStart(padding, '0')) +
          DEFAULT_VIDEO_EXT,
      ),
      start: ongoingSegmentStart,
    };
    if (i < numberOfSegments - 1) {
      videoProcessorArgs.duration = actualSegmentDuration;
    }
    commands.push(videoProcessor.split(videoProcessorArgs));
    ongoingSegmentStart =
      ongoingSegmentStart + actualSegmentDuration - backtrackDuration;
  }
  return commands;
}

function getProcessingInputStrategy(key) {
  const strategy = {
    [TYPE_JOIN]: generateJoinInstructions,
    [TYPE_SPLIT]: generateSplitInstructions,
    [TYPE_UNKNOWN]: which => logError(`UNKNOWN INSTRUCTION TYPE ${which}`),
  };
  if (key in strategy) {
    return strategy[key];
  } else {
    return strategy[TYPE_UNKNOWN];
  }
}

function getProcessingInputInstructions(instruction) {
  return getProcessingInputStrategy(instruction.cmd);
}

function generateSplitInstructions({ instruction }) {
  let splitInstructions = {};

  if (instruction.sections) {
    instruction.output = getOutputsFromSections(instruction);
  }
  splitInstructions = getSplitInstructionsFromOutputs(instruction);

  // to avoid having to repeat too much stuff in the config file, if a
  // command needs a file source and doesn't have one, it will use the
  // source of the previous command. Typical case, we want to split a
  // video clip into fragments and then rearrange them. If we don't pass a
  // name for the rearranged file, it will be the same as that of the input one
  splitInstructions.lastSrc = instruction.src;
  return splitInstructions;
}

function getOutputsFromSections(instruction) {
  const { src, sections } = instruction;
  const wholeVideoDuration = getVideoDuration(src);
  let sectionDuration = asMilliseconds(sections.duration);
  // adjust section length to ensure video is split into chunks of equal lengths
  // TODO
  // this keeps number of sections constant and always increases length; it
  // may be nice to keep length of each section closer to that in the config,
  // and increase / decrease number of sections as needed
  const sectionsCount = Math.floor(wholeVideoDuration / sectionDuration);
  const indexDigits = getDigitsNeeded(sectionsCount);
  sectionDuration =
    sectionDuration + (wholeVideoDuration % sectionDuration) / sectionsCount;
  sectionDuration = LuxonDuration.fromMillis(Math.round(sectionDuration));
  const backtrackDuration = LuxonDuration.fromObject(sections.backtrack || {});

  const output = [];
  let previousEnd = LuxonDuration.fromMillis(0);
  let thisEnd;
  let filenameOrPathKey, filenameOrPathValue;
  if (sections.filename) {
    filenameOrPathKey = 'filename';
    filenameOrPathValue =
      path.dirname(sections.filename) +
      '/' +
      path.basename(sections.filename, DEFAULT_VIDEO_EXT) +
      ' {i}' +
      '.mp4';
  } else {
    filenameOrPathKey = 'ref';
    filenameOrPathValue = sections.ref + ' {i}';
  }

  for (let index = 1; index <= sectionsCount; index += 1) {
    thisEnd = previousEnd.plus(sectionDuration);
    const outputInstruction = {
      src,
      [filenameOrPathKey]: filenameOrPathValue.replace(
        /\{i\}/,
        String(index).padStart(indexDigits, '0'),
      ),
    };
    if (index > 1) {
      outputInstruction.start = previousEnd.minus(backtrackDuration).toObject();
    }
    if (index < sectionsCount) {
      outputInstruction.end = thisEnd.toObject();
    }
    outputInstruction.dest = instruction.dest;
    output.push(outputInstruction);
    previousEnd = thisEnd;
  }
  normaliseOutputsInPlace(output, instruction.dest || config.dest);
  return output;
}

function getVideoDuration(src) {
  const timingCommandArgs = videoProcessor.duration({ src }, { as: 'args' });
  const spawnProcess = spawnSync('ffmpeg', timingCommandArgs);
  const processErrorOutput = spawnProcess.stderr.toString().trim();
  let dateTimeObj = {};
  let durationMatches = /Duration: (\d\d):(\d\d):(\d\d).(\d{1,3})/.exec(
    processErrorOutput,
  );
  if (!durationMatches) return;

  [
    ,
    dateTimeObj.hours,
    dateTimeObj.minutes,
    dateTimeObj.seconds,
    dateTimeObj.milliseconds,
  ] = durationMatches.map(m => Number(m));
  return asMilliseconds(dateTimeObj);
}

function getSplitInstructionsFromOutputs({ output }) {
  return [].concat(output).reduce(
    (accumulator, outputInstruction) => {
      // Luxon duration objects to be passed to ffmpeg
      const start = getStart(outputInstruction, accumulator.endOfLastSplit);
      const duration = getDuration(outputInstruction, start);

      // The split is complicated because there are different types - sometimes
      // we actually want two steps, a split followed by a conversion to an
      // intermediate format for later processing.
      const {
        // where do we put the file for the initial pure split step?
        destSplitStep,

        // do we need that extra conversion step
        shouldConvert,

        // if we need that extra conversion step, where do we put the file?
        destConvertStep,
      } = shouldConvertAndDest(outputInstruction);

      // RADAR
      // In theory when shouldConvert is true we would just call convert and
      // pass timing info to it. Although ffmepg runs it, the results seems to
      // be snapped to certain durations. There could be pure ffmpeg ways to
      // deal with it, but haven't found them so far.
      // Instead we split first to mp4, which can handle precise timings, and
      // then we convert that split mp4 to the intermediate format which can
      // be joinged without reencoding.
      // Whatever happens, we want a 'split to mp4' step, which may be in the
      // final or in the temp folder
      accumulator.commands.push(
        videoProcessor.split({
          src: outputInstruction.src,
          start: start.toFormat(DATETIME_FORMAT),
          duration: duration ? duration.toFormat(DATETIME_FORMAT) : '',
          dest: destSplitStep,
        }),
      );

      // If needed we take the mp4 segment and convert it.
      if (shouldConvert) {
        accumulator.commands.push(
          videoProcessor.convert({
            src: destSplitStep,
            dest: destConvertStep,
          }),
        );
        // tempVideos is a Map (to preserve insertion order) of labels (or 'ref'
        // associated with a specific file in the temp folder. They can be reused
        // by any following command
        accumulator.tempVideos.set(outputInstruction.ref, destConvertStep);
      }
      // endOfLastSplit is used to work out the beginning of the next one
      accumulator.endOfLastSplit = duration ? start.plus(duration) : 0;
      return accumulator;
    },
    { tempVideos: new Map(), commands: [] },
  );
}

function shouldConvertAndDest(outputInstruction) {
  let destConvertStep, destSplitStep;
  const shouldConvert = isTempDest(outputInstruction);

  if (outputInstruction.filename) {
    destSplitStep = normalisePath(
      outputInstruction.filename || as(outputInstruction.ref, 'mp4'),
      outputInstruction.dest,
    );
  } else {
    destSplitStep = normalisePath(as(outputInstruction.ref, 'mp4'), TEMP_DIR);
  }
  if (shouldConvert) {
    destConvertStep = normalisePath(outputInstruction.ref, TEMP_DIR);
  }
  return {
    shouldConvert,
    destConvertStep,
    destSplitStep,
  };
}

function generateJoinInstructions({ instruction, tempVideos, lastSrc }) {
  const commands = { tempVideos, commands: [] };

  // we don't know what to write, no point carrying on
  if (!instruction.filename && !lastSrc) return commands;

  // Q. what are we joining?
  let src;
  if (Array.isArray(instruction.src)) {
    // A. whatever is specified in the instructions
    src = instruction.src.map(current => tempVideos.get(current));
  } else {
    // A. nothing - no point carrying on
    if (!tempVideos) return commands;
    // A. everything that was specified in previous steps, in order
    src = Array.from(tempVideos.values());
  }
  // after all that, we still have nothing to join
  if (src.length === 0) return commands;

  // 'repeat' does just what you expect
  if (instruction.repeat) {
    src = [].concat(Array(instruction.repeat * src.length).fill(src));
  }

  const dest = path.join(instruction.dest, instruction.filename || as(lastSrc));

  try {
    rimraf.sync(dest);
    return {
      tempVideos,
      commands: [
        videoProcessor.join({
          src,
          dest,
        }),
      ],
    };
  } catch (err) {
    logError(`Couldn't delete ${dest}`, err);
    return commands;
  }
}

// with ffmpeg sometimes we convert files to a ts format, so that we can join
// them without re-encoding them; and sometimes we don't. The ts version goes
// into a temp desti(ination). This function tells you whether it does or not
function isTempDest({ ref }) {
  return Boolean(ref);
}

function getStart(currentOutput, endOfLastSplit) {
  let start =
    'start' in currentOutput
      ? // if start is provided, use it
        LuxonDuration.fromObject(currentOutput.start)
      : // if there is an end and a duration, work it out from those
        'end' in currentOutput && 'duration' in currentOutput
        ? LuxonDuration.fromObject(currentOutput.end).minus(
            LuxonDuration.fromObject(currentOutput.duration),
          )
        : // if not, use the commands start value from the last iteration (0 at first)
          endOfLastSplit || LuxonDuration.fromMillis(0);
  return start;
}

function getDuration(current, start) {
  let duration =
    'duration' in current
      ? // if provided, use it
        LuxonDuration.fromObject(current.duration)
      : 'end' in current
        ? // if there is an end, work it out from start and end
          LuxonDuration.fromObject(current.end).minus(start)
        : null;
  return duration;
}

async function processQueue(queue) {
  log(program.verbose, 'processQueue:', queue);
  if (queue.length === 0) {
    log(!program.quiet, 'DONE');
    process.exit();
  }

  const command = queue.shift();
  log(!program.quiet, command);
  const child = spawn(command.cmd, command.args || []);
  child.on('exit', code => {
    processQueue(queue);
  });
  if (program.verbose) {
    for await (const data of child.stdout) {
      console.log(`Stdout from the child: ${data}`);
    }
  }
  for await (const data of child.stderr) {
    log(true, `postprocessing Error: ${data}`);
  }
}
