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

// Adds the first N files from allFiles to filesToAdd and use
// moveToWhenDone attribute to move files
module.exports = (fileCollectorEmitter) => {
  fileCollectorEmitter.on(
    EVENT_FILELIST_WAS_GENERATED,
    ({ instruction, allFiles, filesToAdd }) => {
      const shouldBailEarly =
        instruction.random ||
        instruction.reverse ||
        !instruction.moveToWhenDone ||
        allFiles.length === 0;
      if (shouldBailEarly) return { instruction, filesToAdd };

      let howMany = (instruction.howMany = instruction.howMany || 1);
      howMany = Math.min(howMany, allFiles.length);

      for (let added = 0; added < howMany; added += 1) {
        add(filesToAdd, allFiles[added], instruction);
      }
      return {
        instruction,
        filesToAdd,
      };
    },
  );
};
