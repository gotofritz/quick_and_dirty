/**
 * script that takes some instructions in yaml format for splitting movie
 * files into sections using ffmpeg
 */

const yaml = require('js-yaml');
const glob = require('glob');
const program = require('commander');
const path = require('path');

program
  .version('0.0.1')
  .option(`-v, --verbose`, `verbose`)
  .option(`-q, --quiet`, `quiet`)
  .option(`-s, --src  [glob]`, `source dir or glob`)
  .parse(process.argv);

program.src = path.join(program.src, '**.mp4');
const yamlOutput = {
  instructions: glob.sync(program.src).map(pth => {
    const src = path.basename(pth, '.mp4');
    const [filename1, filename2 = `${src} 2`] = src.split(',');
    return {
      src,
      cmd: 'split',
      output: [
        {
          filename: `WORD ${filename1.trim()}.mp4`,
          end: { minutes: 14, seconds: 30, milliseconds: 0 },
        },
        { filename: `WORD ${filename2.trim()}.mp4` },
      ],
    };
  }),
};
console.log(yaml.safeDump(yamlOutput, { lineWidth: -1 }));
