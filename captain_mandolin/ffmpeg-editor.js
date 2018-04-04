/**
 * script that takes some instructions in yaml format for splitting movie
 * files into sections using ffmpeg
 */

const LuxonDuration = require('luxon').Duration;
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
var exec = require('child_process').exec;
const program = require('commander');

const {
  getConfigOrDie,
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
    (accumulator, current, i) => {
      const processInputInstructions = getProcessingInputInstructions(current);
      const { lastSrc, storedForNextStep, commands } = processInputInstructions(
        {
          instruction: current,
          storedForNextStep: accumulator.storedForNextStep,
          i,
          lastSrc: accumulator.lastSrc,
        },
      );
      accumulator.commands = accumulator.commands.concat(commands);
      accumulator.storedForNextStep = storedForNextStep;
      accumulator.lastSrc = lastSrc;
      return accumulator;
    },
    {
      // we store the last step because a join may want to join them
      storedForNextStep: [],
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
  const originalSrc = path.join(config.srcRoot, instruction.src);
  const splitInstructions = [].concat(instruction.output).reduce(
    (accumulator, output) => {
      const start = getStart(output, accumulator.lastStart);
      const duration = getDuration(output, start);

      // refactoring candidate
      let destConvertStep, destSplitStep;
      const shouldConvert = isTempDest(output);
      if (shouldConvert) {
        destConvertStep = path.join(TEMP_DIR, output.ref);
        destSplitStep = `${destConvertStep}.mp4`;
      } else {
        destSplitStep = normalisePath(
          output.ref,
          output.dest || instruction.dest || config.dest,
        );
      }

      // if shouldConvert, this step should be unnecessary - we should be able
      // to convert straight  to a ts without the mp4 step. But the timing is
      // not as granular if we do it that way; it seems to force you into 2 secs
      // windows (could be that there are missing parameters I don't know) So we
      // split to have precise timing when converting to another mp4, then
      // convert again because we can't joing without re-encoding with mp4
      accumulator.commands.push(
        ffmpeg.split({
          src: originalSrc,
          start: start.toFormat(DATETIME_FORMAT),
          duration: duration ? duration.toFormat(DATETIME_FORMAT) : '',
          dest: destSplitStep,
        }),
      );

      if (shouldConvert) {
        accumulator.commands.push(
          ffmpeg.convert({
            src: destSplitStep,
            dest: destConvertStep,
          }),
        );
        accumulator.storedForNextStep.push(destConvertStep);
      }
      accumulator.lastStart = duration ? start.plus(duration) : 0;
      return accumulator;
    },
    { lastSrc: instruction.src, storedForNextStep: [], commands: [] },
  );
  return splitInstructions;
}

function generateJoinInstructions({ instruction, storedForNextStep, lastSrc }) {
  const dest = path.join(config.dest, instruction.output || lastSrc);
  rimraf.sync(dest);
  return {
    storedForNextStep: [],
    commands: [
      ffmpeg.join({
        src: storedForNextStep.join('|'),
        dest,
      }),
    ],
  };
}

function isTempDest({ ref }) {
  const SUFFIX = 'mp4';
  const suffixLen = SUFFIX.lenght;
  return ref.substr(-suffixLen) === SUFFIX;
}

function getStart(currentOutput, lastStart) {
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
          lastStart || LuxonDuration.fromMillis(0);
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
