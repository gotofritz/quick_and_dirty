/**
 * Reads instructions from a YAML file on how to download video clips (for now
 * mostly from YouToub) and where to put it, with some post processing of names
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const youtubedl = require('youtube-dl');
const mkdirp = require('mkdirp');
const argv = require('minimist')(process.argv.slice(2));

const { getConfigOrDie } = require('./lib/shared');

const DEFAULT_CONFIG = path.join(__dirname, './downloader.config.yml');
const PREPEND_SEPARATOR = ' ';
const MAX_ATTEMPTS = 3;
const TAB = '  ';
let debug = argv.debug || false;

const userData = getConfigOrDie(argv.config || DEFAULT_CONFIG);
console.log('Loading user data ...', debug ? userData : '');

const config = Object.assign(
  {
    some: 'data'
  },
  userData._config
);

if (Array.isArray(userData.download)) {
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
  console.log('Decoding instructions...', debug ? instructions : '');

  processQueue(instructions);
}

//////////////////////////////////////////////////////

// Called recursively. This is the heart of the script
function processQueue(queue) {
  // stop recursing when finished
  if (!queue.length) {
    console.log('DONE');
    return;
  }

  // prepares to download a new video
  const instruction = normaliseInstruction(queue.shift());
  if (debug) console.log(instruction);

  const url = getUrl(instruction);
  const dest = getDest(instruction, config);

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
  console.log(`Downloading ${url}`);

  // start downloading a new video
  const video = youtubedl(
    url,

    // Optional arguments passed to youtube-dl.
    ['--no-warnings'],

    // Additional options can be given for calling `child_process.execFile()`.
    { cwd: __dirname, maxBuffer: 32000 * 1024 }
  );

  let size = 0;
  let filename;

  // Processes the initial server response to download start command
  video.on('info', infoFromServer => {
    size = infoFromServer.size;

    filename = `${dest}/${prepend}${
      instruction.ordinal
    }${PREPEND_SEPARATOR}${infoFromServer._filename}`.replace(
      /-[^ ].{10}\./,
      '.'
    );
    console.log(`filename: ${filename}
    size: ${(Number(infoFromServer.size) / 1000000).toFixed(
      1
    )}Mb, duration: ${infoFromServer.duration}, ${
      queue.length
    } left to downalod`);
    video.pipe(fs.createWriteStream(filename));
  });

  // Errors are not fatal. We retry a few times
  video.on('error', id => {
    if (
      instruction.attempts >= MAX_ATTEMPTS ||
      /copyright|unavailable/i.test(id)
    ) {
      console.log(`${TAB}COULD NOT DOWNLOAD: ${id}///`);
    } else {
      console.log(
        `${TAB}COULD NOT DOWNLOAD: ${id} - will try again ${
          instruction.attempts
        }`
      );
      queue.push(instruction);
    }
    return processQueue(queue);
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

  // Starts next recursion
  video.on('end', () => {
    console.log('');
    processQueue(queue);
  });

  // Specific to playlist - it gets the list of video and appends it to queue,
  // then processes next item in the queue
  video.on('next', playlist => {
    const howManyDigitsNeeded = getDigitsNeeded(playlist.length);
    const playlistInstructions = playlist.map(({ id }, i) => {
      return {
        ...asYoutubeInstructions({ codes: id, dest })[0],
        ordinal: String(i + 1).padStart(howManyDigitsNeeded, '0'),
        prepend
      };
    });
    if (debug) console.log(playlistInstructions);
    queue = playlistInstructions.concat(queue);
    processQueue(queue);
  });
}

// normalizes all dest, so that they are prepended with global config.dest
// unless they are absolute paths, and number of / makes sense.
// Also ensures it doesn't end with /
function getDest({ dest = '' }, { dest: defaultDest = '' }) {
  return dest[0] === '/'
    ? dest
    : `${defaultDest}/${dest}`
        .replace(/\/{2,}/g, '/')
        .replace(/\/$/, '');
}

// given a service, and a type, formats it into a URL for getting videos
function getUrl({ service, code, type }) {
  return service === 'youtube'
    ? type === 'playlist'
      ? `https://www.youtube.com/playlist?list=${code}`
      : `https://www.youtube.com/watch?v=${code}`
    : '';
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
  config = { dest: __dirname }
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
      ...rest
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

// how many digits needed to represent a number
function getDigitsNeeded(number) {
  return Math.ceil(Math.log10(number + 1));
}

// makes sure sensible defaults are applied
function normaliseInstruction(instruction = {}) {
  instruction.ordinal = instruction.ordinal || 0;
  instruction.attempts = instruction.attempts || 0;
  return instruction;
}
