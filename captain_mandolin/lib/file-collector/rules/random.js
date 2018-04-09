const { EVENT_FILELIST_WAS_GENERATED } = require('../../types');

const add = (addTo, src, instruction) => {
  addTo.push({
    refToInstruction: instruction.refToInstruction,
    isLast: false,
    src,
    dest: src,
  });
  instruction.history.push(src);
};

const getElegibleFiles = (allFiles, instruction) =>
  allFiles.filter(file => !instruction.history.includes(file));

module.exports = fileCollectorEmitter => {
  fileCollectorEmitter.on(
    EVENT_FILELIST_WAS_GENERATED,
    ({ instruction, allFiles, filesToAdd }) => {
      if (!instruction.random) return { instruction, filesToAdd };
      if (allFiles.length === 0) return { instruction, filesToAdd };

      let howMany = (instruction.howMany = instruction.howMany || 1);
      instruction.history = instruction.history || [];

      let added = 0;
      let elegibleFiles = getElegibleFiles(allFiles, instruction);
      if (elegibleFiles.length <= howMany) {
        instruction.history = [];
        elegibleFiles.forEach(src => add(filesToAdd, src, instruction));
        howMany -= elegibleFiles.length;
        elegibleFiles = getElegibleFiles(allFiles, instruction);
      }
      while (added < howMany) {
        const src = elegibleFiles[(elegibleFiles.length * Math.random()) | 0];
        add(filesToAdd, src, instruction);
        added += 1;
      }
      if ('maxHistoryLength' in instruction) {
        if (instruction.maxHistoryLength) {
          instruction.history = instruction.history.slice(
            -instruction.maxHistoryLength,
          );
        } else {
          instruction.history = [];
        }
      }

      return {
        instruction,
        filesToAdd,
      };
    },
  );
};
