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

// simple error handling
module.exports.die = (...args) => {
  args.unshift('DIE');
  throw Error(args.join(' '));
};
