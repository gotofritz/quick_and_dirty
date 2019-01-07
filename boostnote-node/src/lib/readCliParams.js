const program = require('commander');

module.exports = ({ PATH_URLS_FILE }) =>
  program
    .version('0.0.1')
    .option(
      `-u, --urls [path]`,
      `path to a list of urls, default ${PATH_URLS_FILE}`,
      PATH_URLS_FILE,
    )
    .option(`-v, --verbose`, `verbose`)
    .option(`-q, --quiet`, `quiet`)
    .option(`-d, --dry-run`, `output file list instead of copying files`)
    .parse(process.argv);
