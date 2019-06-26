// simple error handling
module.exports.die = (...args) => {
  args.unshift('DIE');
  throw Error(args.join(' '));
};
