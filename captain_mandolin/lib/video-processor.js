const LuxonDuration = require('luxon').Duration;

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

  join: ({ src, dest }, { as = 'string' } = {}) => {
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
