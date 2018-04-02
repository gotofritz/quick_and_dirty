/**
 * Takes a bunch of video files and uses ffmpeg to join them up. Use case:
 * I have a few long video files which I have already split into a title
 * sequence, title, and some 10 minutes fragments. This script will be used
 * to add the title in front of each fragment (so they don't just start suddenly
 * in the middle of the action), and the title sequence in fron of the very
 * first one (so you can tell it's the first)
 *
 * Each clip will be generated in at least 2 passes. First each part is remuxed
 * to a temp file. Then those temp files are concatenated together
 * https://superuser.com/questions/420363/how-to-concatenate-two-flv-files#521864
 */
const path = require('path');
var exec = require('child_process').exec;
const program = require('commander');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const {
  getConfigOrDie,
  normalisePath,
  defaultConfigPath,
} = require('./lib/shared');

const DEFAULT_CONFIG = defaultConfigPath();
const SUFFIX_TMP = 'ts';
const TEMP_DIR = path.join(__dirname, '.tmp');

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
    tempDir: TEMP_DIR,

    // used only when repeat: r is set, only useful when there are
    // more than one videoclip to repeat.
    // each: repeat 1st clip in list r times, then the next r times, etc
    // whole: repeat whole list r times
    repeatType: 'each',
  },
  userData._config,
);
if (program.verbose) console.log(config);

if (hasEnoughDataToWorkWith(config, userData)) {
  console.log('Decoding instructions...');

  `${config.tempDir}/*`;
  mkdirp(config.dest);
  mkdirp(config.tempDir);

  // to avoid using up too much disk space, temporary files which are not
  // shared will be overwritten at each iteration. This is the base name used
  // for them (to which 0, 1, ... will be added)
  const TEMP_REF_BASE = 'tmp';

  const {
    // this will eventually be filled with ffmpeg commands
    commands,

    // Named tempfiles are in theory shared across clips, so they only need to be
    // rendered once. This map keeps track of them
    sharedTempFiles,
  } = userData.instructions.reduce(
    (accumulator, current, i) => {
      rimraf.sync(`${config.tempDir}/*.ts`);

      const repeat = current.repeat || config.repeat;
      if (repeat) {
        // TODO - do 'upuntil' # like in captin...
        current.title = current.title || current.srcs[0];
        if (config.repeatType === 'each') {
          current.srcs = current.srcs.reduce((repeatAccumulator, repeated) => {
            repeatAccumulator.push(...Array(repeat).fill(repeated));
            return repeatAccumulator;
          }, []);
        } else {
          current.srcs = [].concat(...Array(repeat).fill(current.srcs));
        }
      }

      const title = normalisePath(current.title, config.dest);
      const tempFilePaths = [];

      // each instruction is a list of fragments that will be concatenated to
      // create an output file - either a shared reference, or a path
      current.srcs.forEach((src, j) => {
        let srcPath;
        let tempFilePath;

        if (src in userData.shared) {
          srcPath = userData.shared[src];
          tempFilePath = normalisePath(tempFile(src), config.srcRoot);

          // shared files are only rendered if needed. We add to the list, and
          // when we have processed all files to be generated we add the whole list
          // at the beginning, to make sure it's there for everyone
          if (!accumulator.sharedTempFiles.has(srcPath)) {
            accumulator.sharedTempFiles.set(srcPath, tempFilePath);
          }
        } else {
          // NOTE that temporary *.ts files need to be unique, hence the -j-i
          // Another
          srcPath = normalisePath(src, config.srcRoot);
          tempFilePath = tempFile(`${TEMP_REF_BASE}-${j}-${i}`);

          // TODO
          // no need to generate all these copies of temp if it's the same
          // file
          accumulator.commands.push(tempCommand(srcPath, tempFilePath));
        }
        tempFilePaths.push(tempFilePath);
      });
      if (tempFilePaths.length > 0) {
        // TODO
        // this needs to be in the nextStep loop
        rimraf.sync(title);
        accumulator.commands.push(joinCommand(title, tempFilePaths));
      }
      return accumulator;
    },
    {
      commands: [],
      sharedTempFiles: new Map(),
    },
  );
  if (sharedTempFiles.size > 0) {
    commands.unshift(
      ...Array.from(sharedTempFiles.entries()).map(([reference, file]) =>
        tempCommand(reference, file),
      ),
    );
  }
  if (program.verbose) console.log(commands);

  if (program.dryRun) {
    console.log(commands);
  } else {
    nextStep(commands);
  }
} else {
  console.log('Not enough data in config to work with');
}

function nextStep(queue = []) {
  if (queue.length) {
    let cmd = queue.shift();
    console.log(`Running ${cmd}`);
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log('ERROR', err, stdout, stderr);
      } else {
        return nextStep(queue);
      }
    });
  } else {
    console.log('DONE');
  }
}

function hasEnoughDataToWorkWith(data = {}, yamlData) {
  return data.srcRoot && data.dest && Boolean(yamlData.instructions);
}

function tempFile(reference) {
  return `${config.tempDir}/${reference}.${SUFFIX_TMP}`;
}

function tempCommand(src, dest) {
  return `ffmpeg -i "${src}" -c copy -bsf:v h264_mp4toannexb -f mpegts "${dest}"`;
}

function joinCommand(outputPath, sections = []) {
  return `ffmpeg -i "concat:${sections.join(
    '|',
  )}" -c copy -bsf:a aac_adtstoasc "${outputPath}"`;
}
