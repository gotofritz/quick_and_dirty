/**
 * Reads instructions from a YAML file on how to download video clips (for now
 * mostly from YouToub) and where to put it, with some post processing of names
 */
const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl');
const mkdirp = require('mkdirp');
const exec = require('child_process').exec;
const program = require('commander');

const {
  defaultConfigPath,
  getConfigOrDie,
  getDigitsNeeded,
  log,
  logError,
} = require('./lib/shared');

const DEFAULT_CONFIG = defaultConfigPath();
const PREPEND_SEPARATOR = ' ';
const MAX_ATTEMPTS = 3;
const TAB = '  ';

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

const userData = getConfigOrDie(program.config);
log(!program.quiet, 'Loading user data ...');
log(program.verbose, userData);

const config = Object.assign(
  {
    tmp: path.join(__dirname, '.tmp'),
  },
  userData._config,
);

let postprocessing = [];

if (Array.isArray(userData.download)) {
  log(!program.quiet, 'Decoding instructions...');
  let instructions = userData.download.reduce((accumulator, entry) => {
    // normalises strings to objects
    if (entry.toLowerCase) {
      entry = { codes: entry };
    }
    if (isSomethingOtherThanYoutube(entry)) {
      accumulator.push(entry);
    } else {
      accumulator.push(...asYoutubeInstructions(entry, config));
    }
    return accumulator;
  }, []);
  log(program.verbose, instructions);

  if (program.dryRun) {
    log(true, instructions);
  } else {
    processQueue(instructions, postprocessing);
  }
}

//////////////////////////////////////////////////////

// Called recursively. This is the heart of the script
function processQueue(queue, postQueue) {
  // stop recursing when finished
  if (!queue.length) {
    log(!program.quiet, 'DONE DOWNLOADING');
    postprocessQueue(postQueue);
    return;
  }

  // prepares to download a new video
  const instruction = normaliseInstruction(queue.shift());
  log(program.verbose, instruction);

  const url = getUrl(instruction);
  const dest = getDest(instruction, config);
  let basename;

  // 'prepend' is something we put at the beginning of a filename, before the
  // ordinal. So a file could be renamed 'Anatroccolo Ali.mp4' to
  // 'PIMPA 001 Anatroccolo Ali.mp4'
  const prepend = instruction.prepend
    ? instruction.prepend + PREPEND_SEPARATOR
    : '';

  // if there is an error we retry a few times. This keeps tracks of attempts
  // so far.
  instruction.attempts++;

  mkdirp.sync(dest);
  log(!program.quiet, `Downloading ${url}`);

  // start downloading a new video
  const video = youtubedl(
    url,

    // Optional arguments passed to youtube-dl.
    ['--no-warnings'],

    // Additional options can be given for calling `child_process.execFile()`.
    { cwd: __dirname, maxBuffer: 32000 * 1024 },
  );

  let size = 0;
  let filename;

  // Processes the initial server response to download start command
  video.on('info', infoFromServer => {
    log(
      program.verbose,
      `[youtube-dl::INFO] queue: ${queue.length} postprocess: ${
        postQueue.length
      }`,
    );
    size = infoFromServer.size;
    basename = [
      prepend,
      instruction.ordinal,
      PREPEND_SEPARATOR,
      infoFromServer._filename.replace(/-[^ ].{10}\./, '.'),
    ].join('');
    if (shouldBeConverted(basename)) {
      postprocessing.push(
        `HandBrakeCLI -Z "Fast 1080p30" -i "${dest}/${basename}" -o "${dest}/${basename.replace(
          /\.[^.]{2,5}$/,
          '.mp4',
        )}"`,
      );
      postprocessing.push(`rm "${dest}/${basename}"`);
    }
    filename = `${dest}/${basename}`;
    log(
      !program.quiet,
      `filename: ${filename}
    size: ${(Number(infoFromServer.size) / 1000000).toFixed(1)}Mb, duration: ${
        infoFromServer.duration
      }, ${queue.length} left to downalod`,
    );
    video.pipe(fs.createWriteStream(filename));
  });

  // Errors are not fatal. We retry a few times
  video.on('error', id => {
    if (
      instruction.attempts >= MAX_ATTEMPTS ||
      /copyright|unavailable/i.test(id)
    ) {
      logError(`${TAB}COULD NOT DOWNLOAD: ${id}///`);
    } else {
      logError(
        `${TAB}COULD NOT DOWNLOAD: ${id} - will try again ${
          instruction.attempts
        }`,
      );
      queue.push(instruction);
    }
    return processQueue(queue, postQueue);
  });

  // Shows download progress
  let pos = 0;
  video.on('data', chunk => {
    // if you do node xxx.js > debug.txt there is no process.stdout
    if (process.stdout && process.stdout.cursorTo) {
      pos += chunk.length;
      if (size) {
        let percent = (pos / size * 100).toFixed(2);
        process.stdout.cursorTo(5);
        process.stdout.clearLine(5);
        process.stdout.write(percent + '%');
      }
    }
  });

  // The events emitted for a playlist are a bit awkward. There is no playlist
  // as such; rather at the end of a video, after the END event was emitted, if
  // the video happens to be in a playlist and there are further videos in the
  // playlist, then the rest of the playlist is sent into a NEXT event. This is
  // annoying, because
  // you can't just listen to the 'next' event, as (1) you'll end up downloading
  // the same videos several times, and (2) there'll be two streams side by
  // side (that initiated by 'end' and that by 'next').
  if (isYoutubePlaylist(instruction)) {
    // only listen to this event for the first video of a playlist - otherwise
    // you will keep on adding the 'remaining playlist videos' to the queue
    // for every video in the playlist, which is !n downloads for a playlist of
    // n videos
    video.on('next', playlist => {
      log(
        program.verbose,
        `[youtube-dl::NEXT] queue: ${queue.length} postprocess: ${
          postQueue.length
        }`,
      );
      const howManyDigitsNeeded = getDigitsNeeded(playlist.length);
      const playlistInstructions = playlist.map(({ id }, i) => {
        return {
          ...asYoutubeInstructions({ codes: id, dest })[0],
          ordinal: String(i + 1).padStart(howManyDigitsNeeded, '0'),
          prepend,
        };
      });
      //  log(program.verbose, playlistInstructions);
      queue = playlistInstructions.concat(queue);
      processQueue(queue, postQueue);
    });
  }

  video.on('end', () => {
    log(true, '');
    log(
      program.verbose,
      `[youtube-dl::END] queue: ${queue.length} postprocess: ${
        postQueue.length
      }`,
    );
    if (!isYoutubePlaylist(instruction)) {
      processQueue(queue, postQueue);
    }
  });
}

// normalizes all dest, so that they are prepended with global config.dest
// unless they are absolute paths, and number of / makes sense.
// Also ensures it doesn't end with /
function getDest({ dest = '' }, { dest: defaultDest = '' }) {
  return dest[0] === '/'
    ? dest
    : `${defaultDest}/${dest}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

function isYoutubePlaylist({ service, code, type }) {
  return service === 'youtube' && type === 'playlist';
}

// given a service, and a type, formats it into a URL for getting videos
function getUrl({ service, code, type }) {
  return service === 'youtube'
    ? type === 'playlist'
      ? `https://www.youtube.com/playlist?list=${code}`
      : `https://www.youtube.com/watch?v=${code}`
    : '';
}

function postprocessQueue(queue) {
  log(!program.quiet, 'postprocessQueue:', queue);
  // stop recursing when finished
  if (queue.length === 0) {
    log(!program.quiet, 'DONE');
    return;
  }

  const command = queue.shift();
  log(program.verbose, command);
  exec(command, (err, stdout, stderr) => {
    if (err) {
      logError(err, stdout, stderr);
    } else {
      postprocessQueue(queue);
    }
  });
}

/**
 * Turns config data from YAML into a config object that makes sense to YouTube
 *
 * @param {object} instructions
 * @param {string|array<string>} instructions.codes either the code for a video,
 *                               a playlist, or an array of codes for video (but
 *                               not an array of codes for playlists)
 * @param {object=} config will contain a dest string to be used as default (if
 *                         not passed __dirname will be used
 */
function asYoutubeInstructions(
  { codes, dest, ...rest },
  config = { dest: __dirname },
) {
  if (Array.isArray(codes)) {
    // if codes is an array, it can ONLY be an array of videoclips (developer
    // decision :-) Therefore normal rules for destination (i.e. get global)
    dest = dest || config.dest;
  } else {
    if (!dest) {
      // by default playlists will be saved into own folders, so that
      // we can quickly download a few without having to mess about with YAML
      // too much
      dest = isYoutubeVideo(codes)
        ? config.dest
        : path.join(config.dest, codes);
    }
    // this function will always return an array, and we want to generate it by
    // processing an input array, therefore we cast input if it's just a string
    codes = Array.of(codes);
  }

  return codes.map((code, i) => {
    const isClip = isYoutubeVideo(code);
    return {
      code,
      service: 'youtube',
      type: isClip ? 'video' : 'playlist',
      dest,
      ordinal: i,
      ...rest,
    };
  });
}

// youtube is the default, although the library in theory can download
// videos from elsewhere. Hence it gets special treatment
function isSomethingOtherThanYoutube({ service = 'youtube' } = {}) {
  return service !== 'youtube';
}

// as opposed to a playlist
function isYoutubeVideo(code = '') {
  // we know all codes of length YOUTUBE_CLIP_CODE are clips, otherwise
  // playlist
  const YOUTUBE_CLIP_CODE = 11;
  return code.toLowerCase && code.length === YOUTUBE_CLIP_CODE;
}

// makes sure sensible defaults are applied
function normaliseInstruction(instruction = {}) {
  instruction.ordinal = instruction.ordinal || 0;
  instruction.attempts = instruction.attempts || 0;
  return instruction;
}

function shouldBeConverted(basename) {
  return !/\.mp4$/.test(basename);
}
