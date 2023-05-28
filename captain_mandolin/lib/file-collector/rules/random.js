const { EVENT_FILELIST_WAS_GENERATED } = require('../../types');
const CaptnM = require('../../shared');
const path = require('path');

// macro
const add = (addTo, src, instruction) => {
  addTo.push({
    refToInstruction: instruction.refToInstruction,
    isLast: false,
    src,
    dest: path.basename(src),
  });
  if (instruction.moveToWhenDone) {
    addTo.push({
      move: true,
      isLast: false,
      src,
    });
  }
};

// Adds N files picked at random from from allFiles to filesToAdd. If there is a
// moveToWhenDone attribute moves files there
module.exports = (fileCollectorEmitter) => {
  fileCollectorEmitter.on(
    EVENT_FILELIST_WAS_GENERATED,
    ({ instruction, allFiles, filesToAdd }) => {
      if (!instruction.random || allFiles.length === 0)
        // TODO do we actually have to return anything?
        return { instruction, filesToAdd };

      let howMany = (instruction.howMany = instruction.howMany || 1);

      let added = 0;

      // make sure there are no infinite loops
      howMany = Math.min(howMany, allFiles.length);

      // gets the file it needs
      while (added < howMany) {
        const src = allFiles[(allFiles.length * Math.random()) | 0];
        add(filesToAdd, src, instruction);
        added += 1;
      }

      return {
        instruction,
        filesToAdd,
      };
    },
  );
};
