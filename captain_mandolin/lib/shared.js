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
  fs.writeFileSync(
    pth,
    yaml.safeDump(settings, { lineWidth: -1 }),
    'utf8'
  );
  return settings;
};

module.exports = {
  getConfigOrDie,
  writeYaml
};
