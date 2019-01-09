/**
 * InstructionsStore
 *
 * This handles the user instructions. It loads them from a YAML file (but in
 * future they may come from a web interface or the CLI) and does some simple
 * normalisation and cleansing.
 *
 */
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const mkdirp = require('mkdirp');
const YAML = require('yaml');

class InstructionsStore extends EventEmitter {
  /**
   * @constructor
   * @param {Object} config
   * @param {string} config.pth the path with the YAML file
   * @param {function*} config.srcCleaner a function that will be applied to src
   *                    before adding it to the list, default just pass through
   */
  constructor({ pth, srcCleaner = src => src } = {}) {
    super();
    this.instructions = [];
    this.pth = pth;
    this.srcCleaner = srcCleaner;
    const logsPath = path.join(
      process.cwd(),
      '.boostnote',
      new Date().toISOString().replace(/\W/g, ''),
    );
    this.logsFile = logsPath + '-log.yml';
    this.errorFile = logsPath + '-error.yml';
  }

  /**
   * @returns {Array} all the loaded instructions
   */
  all() {
    return this.instructions.slice(0);
  }

  /**
   * Loads the YAML file and generates an array of instructions from it
   *
   * @return {InstructionsStore} for chaining
   */
  load() {
    if (!this.pth) return this;

    let rawInstructions;
    try {
      const file = fs.readFileSync(this.pth, 'utf8');
      if (file.trim() === '') {
        return this;
      }

      rawInstructions = YAML.parse(file);
      this.instructions = reduceYAMLToArray(rawInstructions, {
        srcCleaner: this.srcCleaner,
      });

      createLogsDirIfNeeded(this.logsFile);
      this.log();
    } catch (err) {
      this.emit('error', `InstructionsStore.load error ${err}`);
    }
    return this;
  }

  log() {
    dumpInstructionsToFile(this.instructions, this.logsFile);
    dumpInstructionsToFile(
      this.instructions.filter(instruction => instruction.error),
      this.errorFile,
    );
  }
}

function reduceYAMLToArray(yamlObj, { srcCleaner }) {
  return yamlObj.reduce((accumulator, current) => {
    if (!current.src) return accumulator;

    let { src, tags = [] } = current;
    if (!Array.isArray(tags)) {
      tags = tags.split(/\s*,\s*/);
    }
    const srcs = [].concat(src);
    return accumulator.concat(
      srcs.map(s => ({
        src: srcCleaner(s),
        tags,
        processed: false,
      })),
    );
  }, []);
}

function createLogsDirIfNeeded(filePath) {
  if (!filePath) return;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir);
  }
}

function dumpInstructionsToFile(instructions, filePath) {
  if (!filePath) return;
  if (instructions.length === 0) return;

  const instructionsAsYAML = YAML.stringify(instructions);
  fs.writeFileSync(filePath, instructionsAsYAML, 'utf8');
}

module.exports = InstructionsStore;
