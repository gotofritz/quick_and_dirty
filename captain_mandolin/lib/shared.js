const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// loads YAML or exits program
const getConfigOrDie = pth => {
  if (!path.isAbsolute(pth)) {
    pth = path.join(__dirname, pth);
  }
  try {
    return yaml.safeLoad(fs.readFileSync(pth, 'utf8'));
  } catch (e) {
    console.log(`Did not find or load a valid config from ${pth}`);
    process.exit(1);
  }
};

const writeYaml = (pth, settings) => {
  fs.writeFileSync(pth, yaml.safeDump(settings, { lineWidth: -1 }), 'utf8');
  return settings;
};

// how many digits needed to represent a number
const getDigitsNeeded = forNumber => {
  return Math.ceil(Math.log10(forNumber + 1));
};

const logError = (...args) => {
  console.log('ERROR:', ...args);
};

const log = (shouldLog, ...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

// creates a function that can match the beginning of a path with a seed one
const matcherFactory = matchUpTo => {
  const matchUpToRE = new RegExp(`^(.+)${matchUpTo}`);
  return pth => (pth.match(matchUpToRE) || [, pth])[1].trim();
};

const normalisePath = (pth, dirname) => {
  if (path.isAbsolute(pth)) {
    return pth;
  }
  return path.join(dirname, pth);
};

module.exports = {
  getConfigOrDie,
  getDigitsNeeded,
  log,
  logError,
  matcherFactory,
  normalisePath,
  writeYaml,
};
