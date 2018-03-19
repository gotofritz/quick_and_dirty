/**
 * script that takes some instructions in yaml format for splitting movie
 * files into sections using ffmpeg
 */

const LuxonDuration = require('luxon').Duration;
const path = require('path');
var exec = require('child_process').exec;
const program = require('commander');

const { getConfigOrDie, getDigitsNeeded } = require('./lib/shared');

const DATETIME_FORMAT = 'hh:mm:ss';
const DEFAULT_CONFIG = __filename.replace(/\.js$/, '.config.yml');
const PREPEND_SEPARATOR = ' ';

let globalStart = LuxonDuration.fromObject({});

program
  .version('0.0.1')
  .option(
    `-c, --config [path]`,
    `path to a config file, default ${DEFAULT_CONFIG}`,
    DEFAULT_CONFIG,
  )
  .option(`-v, --verbose`, `verbose`)
  .option(`-d, --dry-run`, `output file list instead of copying files`)
  .parse(process.argv);

console.log('Reading config...');
const userData = getConfigOrDie(program.config);

const config = Object.assign(
  {
    verbose: false,
    prependWithDigits: false,
  },
  userData._config,
);
if (config.verbose) console.log(config);

if (hasEnoughDataToWorkWith(config, userData)) {
  console.log('Decoding instructions...');
  const commands = userData.instructions.reduce((accumulator, current) => {
    if (!Array.isArray(current.output)) return accumulator;

    const pth = path.join(config.srcRoot, current.src);

    const command = current.output.reduce(
      (outputAccumulator, currentOutput, i) => {
        let start = getStart(currentOutput, outputAccumulator.lastStart);

        // this allows you to start the next segment a bit before the cut,
        // i.e. there is an overlap between the two
        if (outputAccumulator.backtrack && outputAccumulator.lastStart) {
          start = start.minus(
            LuxonDuration.fromObject(outputAccumulator.backtrack),
          );
        }
        const duration = getDuration(currentOutput, start);

        const formattedStart = `-ss ${start.toFormat(DATETIME_FORMAT)}`;
        const formattedDuration = duration
          ? `-t ${duration.toFormat(DATETIME_FORMAT)}`
          : // if there is no duration then leave it blank (i.e., go until end)
            '';
        const outputFile = `-sn "${config.dest}/${
          config.prependWithDigits || !currentOutput.title
            ? String(i + 1).padStart(
                '0',
                outputAccumulator.howManyDigitsNeeded,
              ) + PREPEND_SEPARATOR
            : ''
        }${currentOutput.title || '.mp4'}"`;

        outputAccumulator.cmd = `${
          outputAccumulator.cmd
        } -vcodec copy -acodec copy ${formattedStart} ${formattedDuration} ${outputFile}`;

        outputAccumulator.lastStart =
          'end' in current
            ? // if there is an explicit end use it
              LuxonDuration.fromObject(current.end)
            : duration
              ? // otherwise work it out from start + duration
                start.plus(duration)
              : null;
        return outputAccumulator;
      },
      {
        cmd: `ffmpeg -v quiet -y -i "${pth}" `,
        howManyDigitsNeeded: getDigitsNeeded(current.output.length),
        src: current.src,
        backtrack: current.backtrack || 0,
      },
    ).cmd;
    accumulator.push(command);
    return accumulator;
  }, []);

  if (program.dryRun) {
    console.log(commands);
  } else {
    processQueue(commands);
  }
}

function hasEnoughDataToWorkWith(data = {}, instr) {
  return data.srcRoot && data.dest && Boolean(instr);
}

function getStart(currentOutput, lastStart) {
  return 'start' in currentOutput
    ? // if start is provided, use it
      LuxonDuration.fromObject(currentOutput.start)
    : // if there is an end and a duration, work it out from those
      'end' in currentOutput && 'duration' in currentOutput
      ? LuxonDuration.fromObject(currentOutput.end).minus(
          LuxonDuration.fromObject(currentOutput.duration),
        )
      : // if not, use the ongoing start value from the last iteration (0 at first)
        lastStart || LuxonDuration.fromMillis(0);
}

function getDuration(current, start) {
  // using 'duration' because of luxon's 'Duration'

  return 'duration' in current
    ? // if provided, use it
      LuxonDuration.fromObject(current.duration)
    : 'end' in current
      ? // if there is an end, work it out from start and end
        LuxonDuration.fromObject(current.end).minus(start)
      : null;
}

function processQueue(queue) {
  if (queue.length === 0) {
    console.log('Done');
    process.exit();
  }

  const command = queue.shift();
  console.log(command);
  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.log('ERROR', err, stdout, stderr);
    } else {
      processQueue(queue);
    }
  });
}
