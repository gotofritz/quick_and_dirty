/* eslint-disable no-console */
// console.log allowing flags to control whether to log or not
module.exports.log = (shouldLog, ...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

module.exports.divider = shouldLog => {
  if (shouldLog) {
    console.log('-'.repeat(62));
  }
};
// eslint-enable no-console

// simple error handling
module.exports.die = (...args) => {
  args.unshift('DIE');
  throw Error(args.join(' '));
};
