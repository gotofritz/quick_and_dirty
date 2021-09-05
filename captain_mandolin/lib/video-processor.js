const LuxonDuration = require('luxon').Duration;
const path = require('path');

const formatted = {
  string: params => `ffmpeg ${params.join(' ')}`,
  args: params => params,
};

const DATETIME_FORMAT = 'hh:mm:ss.SSS';

const quotes = str => `"${str}"`;
const asDatetime = millis =>
  LuxonDuration.fromMillis(millis).toFormat(DATETIME_FORMAT);

module.exports = {
  mp4: ({ src, dest } = {}, { as = 'args' } = {}) => {
    const asString = as !== 'args';
    let cmd = 'HandbrakeCLI';
    if (asString) {
      src = quotes(src);
      dest = quotes(dest);
    }
    let args = [`-Z`, `Fast 1080p30`, `-i`, src, '-o', dest];
    return asString ? `${cmd} ${args.join(' ')}` : { cmd, args };
  },

  split: (
    { src, start = -1, duration = -1, dest } = {},
    { as = 'args' } = {},
  ) => {
    const asString = as !== 'args';
    let cmd = 'ffmpeg';
    if (asString) {
      src = quotes(src);
      dest = quotes(dest);
    }
    let args = [`-y`];
    if (start >= 0) {
      args.push('-ss', asDatetime(start));
    }
    args.push('-i', src, '-vcodec', 'copy', '-acodec', 'copy', '-sn');
    if (duration >= 0) {
      args.push('-t', asDatetime(duration));
    }
    args.push(dest);
    return asString ? `${cmd} ${args.join(' ')}` : { cmd, args };
  },

  convert: ({ src, start, duration, dest }) =>
    [
      `ffmpeg -y `,
      start ? `-ss ${start} ` : '',
      duration ? `-t ${duration} ` : '',
      `-i "${src}" `,
      ` -c copy -bsf:v h264_mp4toannexb `,
      `-f mpegts "${dest}"`,
    ].join(''),

  // did this work once? because it doesn't now, evern if you copy the commnd to
  // the CLI
  joinWhichDoesntWork: ({ src, dest }, { as = 'args' } = {}) => {
    const asString = as !== 'args';
    let cmd = 'ffmpeg';
    const args = [
      '-i',
      `"concat:${src.join('|')}"`,
      '-c',
      'copy',
      '-bsf:a',
      'aac_adtstoasc',
      `"${dest}"`,
    ];
    return asString ? `${cmd} ${args.join(' ')}` : { cmd, args };
  },

  join: ({ src, dest }, { as = 'args' } = {}) => {
    const asString = as !== 'args';
    let commands = [];
    const INTERMEDIATE = path.resolve('intermedidate');
    for (let i = 0; i < src.length; i += 1) {
      let cmd = 'ffmpeg';
      let args = [
        '-i',
        `${src[i]}`,
        '-y',
        '-c',
        'copy',
        '-bsf:v',
        'h264_mp4toannexb',
        '-f',
        'mpegts',
        `${INTERMEDIATE + i}.ts`,
      ];
      commands.push(asString ? `${cmd} ${args.join(' ')}` : { cmd, args });
    }
    if (commands.length) {
      let cmd = 'ffmpeg';
      let args = [
        '-i',
        `concat:${commands.map((_, i) => `${INTERMEDIATE + i}.ts`).join('|')}`,
        '-c',
        'copy',
        '-bsf:a',
        'aac_adtstoasc',
        `${dest}`,
      ];
      let cmd2 = 'rm';
      let args2 = commands.map((_, i) => `${INTERMEDIATE + i}.ts`);
      commands.push(asString ? `${cmd} ${args.join(' ')}` : { cmd, args });
      commands.push(
        asString ? `${cmd2} ${args2.join(' ')}` : { cmd: cmd2, args: args2 },
      );
    }
    return commands;
  },

  duration: ({ src }, { as = 'string' } = {}) => {
    const params = ['-i', `${src}`, '2>&1'];
    return formatted[as](params);
  },

  mp3: ({ src, dest }, { as = 'args' } = {}) => {
    const asString = as !== 'args';
    let cmd = 'ffmpeg';
    if (asString) {
      src = quotes(src);
      dest = quotes(dest);
    }
    const args = [
      '-i',
      src,
      '-y',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '320k',
      '-profile:v',
      '0',
      dest,
    ];
    return asString ? `${cmd} ${args.join(' ')}` : { cmd, args };
  },
};
