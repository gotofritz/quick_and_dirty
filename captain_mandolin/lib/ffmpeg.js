module.exports = {
  split: ({ src, start, duration, dest }) =>
    [
      `ffmpeg -y`,
      `-ss ${start}`,
      duration ? `-t ${duration}` : '',
      `-i "${src}"`,
      '-vcodec copy -acodec copy',
      `-sn "${dest}"`,
    ].join(' '),

  convert: ({ src, dest }) =>
    `ffmpeg -y -i "${src}" -c copy -bsf:v h264_mp4toannexb -f mpegts "${dest}"`,

  join: ({ src, dest }) =>
    [
      `ffmpeg -i "concat:${src}"`,
      '-c copy -bsf:a aac_adtstoasc',
      `"${dest}"`,
    ].join(' '),
};
