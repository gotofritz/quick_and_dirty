/**
 * script that takes some instructions in yaml format for splitting movie
 * files into sections using ffmpeg
 */

const LuxonDuration = require('luxon').Duration;
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const { exec, spawnSync } = require('child_process');
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
const { TYPE_JOIN, TYPE_SPLIT, TYPE_UNKNOWN } = require('./lib/types');
const ffmpeg = require('./lib/ffmpeg');

const DATETIME_FORMAT = 'hh:mm:ss.SSS';
const DEFAULT_CONFIG = defaultConfigPath();
const TEMP_DIR = path.join(__dirname, '.tmp');

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

  const { commands } = userData.instructions.reduce(
    (accumulator, instruction, i) => {
      normaliseInstructionInPlace(instruction, config);
      const processInputInstructions = getProcessingInputInstructions(
        instruction,
      );
      const { lastSrc, tempVideos, commands } = processInputInstructions({
        instruction: instruction,
        tempVideos: accumulator.tempVideos,
        i,
        lastSrc: accumulator.lastSrc,
      });
      accumulator.commands = accumulator.commands.concat(commands);
      accumulator.tempVideos = tempVideos;
      accumulator.lastSrc = lastSrc;
      return accumulator;
    },
    {
      // we store the last step because a join may want to join them
      tempVideos: new Map(),
      commands: [],
      lastSrc: '',
    },
  );

  if (program.dryRun) {
    log(!program.quiet, commands);
  } else {
    mkdirp(TEMP_DIR);
    rimraf.sync(path.join(TEMP_DIR, '*'));
    processQueue(commands);
  }
}

function hasEnoughDataToWorkWith(data = {}, yamlData) {
  return data.srcRoot && data.dest && Boolean(yamlData.instructions);
}

function getInstructionType(instruction) {
  if (instruction.cmd) {
    if ([TYPE_JOIN, TYPE_SPLIT].includes(instruction.cmd)) {
      return instruction.cmd;
    } else {
      return TYPE_UNKNOWN;
    }
  }
  if (
    Array.isArray(instruction.src) &&
    instruction.output &&
    !Array.isArray(instruction.output)
  ) {
    return TYPE_JOIN;
  }
  if (
    instruction.src &&
    !Array.isArray(instruction.src) &&
    Array.isArray(instruction.output)
  ) {
    return TYPE_SPLIT;
  }
  return TYPE_UNKNOWN;
}

// ensure the instruction (which comes straight from an user editable YAML file)
// is usable
function normaliseInstructionInPlace(instruction, config) {
  if (Array.isArray(instruction.src)) {
    instruction.src = instruction.src.map(src =>
      normalisePath(src, config.srcRoot),
    );
  } else if (instruction.src) {
    instruction.src = normalisePath(instruction.src, config.srcRoot);
  }
  instruction.dest = instruction.dest || config.dest;
  normaliseOutputsInPlace({
    outputArray: instruction.output,
    dest: instruction.dest || config.dest,
    src: instruction.src,
  });
}

function normaliseOutputsInPlace({ outputArray, dest, src }) {
  if (Array.isArray(outputArray)) {
    outputArray.forEach((outputInstruction, i) => {
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
  return getProcessingInputStrategy(getInstructionType(instruction));
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
  const CALCULATION_UNIT = 'milliseconds';
  const wholeVideoDuration = getVideoDuration({ src });
  const wholeVideoAs = wholeVideoDuration.as(CALCULATION_UNIT);
  let sectionDuration = LuxonDuration.fromObject(sections.duration);
  let sectionAs = sectionDuration.as(CALCULATION_UNIT);
  // adjust section length to ensure video is split into chunks of equal lengths
  // TODO
  // this keeps number of sections constant and always increases length; it
  // may be nice to keep length of each section closer to that in the config,
  // and increase / decrease number of sections as needed
  const sectionsCount = Math.floor(wholeVideoAs / sectionAs);
  const indexDigits = getDigitsNeeded(sectionsCount);
  sectionAs = sectionAs + (wholeVideoAs % sectionAs) / sectionsCount;
  sectionDuration = LuxonDuration.fromMillis(Math.round(sectionAs));
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
      path.basename(sections.filename, '.mp4') +
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

function getVideoDuration({ src }) {
  const timingCommandArgs = ffmpeg.duration({ src }, { as: 'args' });
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
  return LuxonDuration.fromObject(dateTimeObj);
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
        ffmpeg.split({
          src: outputInstruction.src,
          start: start.toFormat(DATETIME_FORMAT),
          duration: duration ? duration.toFormat(DATETIME_FORMAT) : '',
          dest: destSplitStep,
        }),
      );

      // If needed we take the mp4 segment and convert it.
      if (shouldConvert) {
        accumulator.commands.push(
          ffmpeg.convert({
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
        ffmpeg.join({
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

function processQueue(queue) {
  if (queue.length === 0) {
    log(!program.quiet, 'Done');
    process.exit();
  }

  const command = queue.shift();
  log(program.verbose, command);
  exec(command, (err, stdout, stderr) => {
    if (err) {
      logError(err, stdout, stderr);
    } else {
      processQueue(queue);
    }
  });
}
