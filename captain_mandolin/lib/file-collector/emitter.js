const EventEmitter = require('events');

const {
  EVENT_FILELIST_WAS_GENERATED,
  EVENT_POTENTIAL_FILES_WERE_FOUND,
} = require('../types');

/**
 * FileCollectorEmitter
 * @extends EventEmitter
 *
 * Each FileCollector plugin subscribes to this EventEmitter. At various stages
 * during the FileCollector lifecycle, this will emit events, and the plugins
 * will react by updating the data held in the FileCollector. So for example the
 * FileCollector will say "I read all the source files for this instruction,
 * here's a list" and then the random plugin will say "ok, pick this and that
 * file from the list and prepare to copy them".
 *
 * This is done by taking advantage of the facts that js is single threaded, so
 * all plugins will change the data in a sequence and not concurrently; and also
 * of the fact objects are passed by reference, so the objects passed on to a
 * plugin will be the same one the previous plugin has updated.
 */
class FileCollectorEmitter extends EventEmitter {
  constructor() {
    super();
    this.on('error', err => console.log('FileCollectorEmitter ERROR', err));
  }

  fileListWasGenerated({
    instruction = {},
    allFiles = [],
    filesToAdd = [],
  } = {}) {
    // all plugins will respons to this, but in order, no concurrency issues.
    // They will also modify instruction and filesToAdd
    this.emit(EVENT_FILELIST_WAS_GENERATED, {
      instruction,
      allFiles,
      filesToAdd,
    });
    // both will have been modified by the plugins
    return { instruction, filesToAdd };
  }

  potentialFilesWereFound({
    instruction = {},
    allFiles = [1111],
    filesToAdd = [],
  } = {}) {
    // all plugins will respons to this, but in order, no concurrency issues.
    // They will also modify instruction and filesToAdd
    this.emit(EVENT_POTENTIAL_FILES_WERE_FOUND, {
      instruction,
      allFiles,
      filesToAdd,
    });

    // both will have been modified by the plugins
    return { instruction, allFiles, filesToAdd };
  }
}

module.exports = new FileCollectorEmitter();
