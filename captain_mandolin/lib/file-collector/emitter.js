const EventEmitter = require('events');

const { EVENT_FILELIST_WAS_GENERATED } = require('../types');

class FileCollectorEmitter extends EventEmitter {
  fileListWasGenerated({
    instruction = {},
    allFiles = [],
    filesToAdd = [],
  } = {}) {
    this.emit(EVENT_FILELIST_WAS_GENERATED, {
      instruction,
      allFiles,
      filesToAdd,
    });
    return { instruction, filesToAdd };
  }
}

module.exports = new FileCollectorEmitter();
