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
const YAML = require('yaml');

const { dumpInstructionsToFile, logsPath } = require('./lib');

class InstructionsStore extends EventEmitter {
  /**
   * @constructor
   * @param {Object} config
   * @param {string} config.pth the path with the YAML file
   * @param {function*} config.srcCleaner a function that will be applied to src
   *                    before adding it to the list, default just pass through
   */
  constructor({ urls, srcCleaner = src => src } = {}) {
    super();
    this.instructions = [];
    this.urls = urls;
    this.srcCleaner = srcCleaner;
    this.logsFile = logsPath('log');
    this.errorFile = logsPath('error');
    this.unprocessedFile = logsPath('unprocessed');
  }

  one(key) {
    if (Number.isInteger(key) && key >= 0 && key < this.instructions.length) {
      return Object.assign({}, this.instructions[key]);
    }
  }

  get length() {
    return this.instructions.length;
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
    if (!this.urls) return this;

    let rawInstructions;
    try {
      const file = fs.readFileSync(this.urls, 'utf8');
      if (file.trim() === '') {
        return this;
      }

      rawInstructions = YAML.parse(file);
      this.instructions = reduceYAMLToArray(rawInstructions, {
        srcCleaner: this.srcCleaner,
      });

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
    dumpInstructionsToFile(
      this.instructions.filter(instruction => instruction.processed === false),
      this.unprocessedFile,
    );
  }

  forEach(cb) {
    this.instructions.forEach(cb);
  }

  update(key, fields = {}) {
    if (key == undefined) return;
    if (Object.keys(fields).length === 0) return;
    if (Number.isInteger(key) && key >= 0 && key < this.instructions.length) {
      this.instructions[key] = Object.assign(
        {},
        this.instructions[key],
        fields,
      );
    }
    this.log();
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

module.exports = InstructionsStore;
