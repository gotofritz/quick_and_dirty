const program = require('commander');

module.exports = ({ DEFAULT_CONFIG }) =>
  program
    .version('0.0.1')
    .option(
      `-c, --config [path]`,
      `path to a config file, default ${DEFAULT_CONFIG}`,
      DEFAULT_CONFIG,
    )
    .option(`-v, --verbose`, `verbose`)
    .option(`-q, --quiet`, `quiet`)
    .option(`-a, --add <path>`, `add a directory`)
    .option(`-d, --dry-run`, `output file list instead of copying files`)
    .parse(process.argv);
