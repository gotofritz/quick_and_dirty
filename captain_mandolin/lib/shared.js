const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

module.exports.as = (pth, suffix = '.mp4') => {
  if (suffix[0] !== '.') {
    suffix = '.' + suffix;
  }
  return `${path.basename(pth, suffix)}${suffix}`;
};

module.exports.defaultConfigPath = (pth = module.parent.filename) =>
  path.join(
    path.dirname(pth),
    'config',
    path.basename(pth, '.js') + '.config.yml',
  );

// loads YAML or exits program
module.exports.getConfigOrDie = (pth) => {
  if (!path.isAbsolute(pth)) {
    pth = path.join(process.cwd(), pth);
  }
  try {
    return yaml.safeLoad(fs.readFileSync(pth, 'utf8'));
  } catch (e) {
    console.log(`Did not find or load a valid config from ${pth}`, e);
    process.exit(1);
  }
};

// how many digits needed to represent a number
module.exports.getDigitsNeeded = (forNumber) => {
  return Math.ceil(Math.log10(forNumber + 1));
};

// console.log allowing flags to control whether to log or not
module.exports.log = (shouldLog, ...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

// simple error handling
module.exports.logError = (...args) => {
  console.log('ERROR:', ...args);
};

// creates a function that can match the beginning of a path with a seed one
module.exports.matcherFactory = (matchUpTo) => {
  const matchUpToRE = new RegExp(`^(.+)${matchUpTo}`);
  return (pth) => (pth.match(matchUpToRE) || [undefined, pth])[1].trim();
};

// ensures path is absolite
module.exports.normalisePath = (pth, dirname) => {
  if (path.isAbsolute(pth)) {
    return pth;
  }
  return path.join(dirname, pth);
};

/**
 * Does it synchronously
 * @param {string} pth where it is written
 * @param {object} settings what is written
 * @returns
 */
module.exports.writeYaml = (pth, settings) => {
  const updatedSettings = {
    ...settings,
    instructions: settings._config.resetDisabled
      ? settings.instructions.map((inst) => ({
          ...inst,
          disabled: false,
        }))
      : settings.instructions.slice(0),
  };
  fs.writeFileSync(
    pth,
    yaml.safeDump(updatedSettings, { lineWidth: -1 }),
    'utf8',
  );
  return updatedSettings;
};

module.exports.mustacheLite = (template, data, padding = 2) =>
  template
    .replace(/\{basename\}/g, data.basename)
    .replace(/\{i\}/g, String(data.i).padStart(padding, '0'));

module.exports.saveToFile = (name, content) => {
  require('fs').writeFileSync(
    path.join(process.cwd(), name),
    JSON.stringify(content, null, 2),
    'utf8',
  );
};
