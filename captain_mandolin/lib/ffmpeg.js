const formatted = {
  string: params => `ffmpeg ${params.join(' ')}`,
  args: params => params,
};

module.exports = {
  split: ({ src, start, duration, dest }) =>
    [
      `ffmpeg -y `,
      `-ss ${start} `,
      duration ? `-t ${duration} ` : '',
      `-i "${src}" `,
      '-vcodec copy -acodec copy ',
      `-sn "${dest}"`,
    ].join(''),

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
    const params = [
      '-i',
      `"concat:${src.join('|')}"`,
      '-c',
      'copy',
      '-bsf:a',
      'aac_adtstoasc',
      `"${dest}"`,
    ];
    return formatted[as](params);
  },

  duration: ({ src }, { as = 'string' } = {}) => {
    const params = ['-i', `${src}`, '2>&1'];
    return formatted[as](params);
  },
};
