const { EVENT_FILELIST_WAS_GENERATED } = require('../../types');
const CaptnM = require('../../shared');
const path = require('path');

// macro
const add = (addTo, src, instruction) => {
  if (!src) return;

  addTo.push({
    refToInstruction: instruction.refToInstruction,
    isLast: false,
    src,
    dest: CaptnM.handleBasenameDigits(src),
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
      if (!instruction.reverse)
        // TODO do we actually have to return anything?
        return { instruction, filesToAdd };
      let howMany = (instruction.howMany = instruction.howMany || 1);
      let added = 0;

      // gets the file it needs
      for (let i = allFiles.length - 1; added < howMany; i -= 1, added += 1) {
        const src = allFiles[i];
        add(filesToAdd, src, instruction);
      }

      return {
        instruction,
        filesToAdd,
      };
    },
  );
};
