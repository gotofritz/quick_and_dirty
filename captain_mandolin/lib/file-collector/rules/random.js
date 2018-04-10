const { EVENT_FILELIST_WAS_GENERATED } = require('../../types');

// macro
// adds a file both to the instruction lists, and to the history
const add = (addTo, src, instruction) => {
  addTo.push({
    refToInstruction: instruction.refToInstruction,
    isLast: false,
    src,
    dest: src,
  });
  instruction.history.push(Array.isArray(src) ? src[0] : src);
};

// lists of files which are not in history
const getElegibleFiles = (allFiles, instruction) =>
  allFiles.filter(file => {
    file = Array.isArray(file) ? file[0] : file;
    return !instruction.history.includes(file);
  });

// adds N files picked at random from from allFiles to filesToAdd and adds them
// to the instruction.history so that they can be avoided next time. Clears
// instruction.history as needed if all files were picked N is specified as
// instruction.random instruction.maxHistoryLength can be used to limit the
// length of history
module.exports = fileCollectorEmitter => {
  fileCollectorEmitter.on(
    EVENT_FILELIST_WAS_GENERATED,
    ({ instruction, allFiles, filesToAdd }) => {
      if (!instruction.random || allFiles.length === 0)
        return { instruction, filesToAdd };

      let howMany = (instruction.howMany = instruction.howMany || 1);
      instruction.history = instruction.history || [];

      let added = 0;
      let elegibleFiles = getElegibleFiles(allFiles, instruction);

      // if there aren't enough elegible files, get all those it can directly,
      // reset history, make a new list of elegibleFiles, and update number of
      // files we need to get
      if (elegibleFiles.length <= howMany) {
        instruction.history = [];
        elegibleFiles.forEach(src => add(filesToAdd, src, instruction));
        howMany -= elegibleFiles.length;
        elegibleFiles = Array.from(allFiles);
      }

      // make sure there are no infinite loops
      howMany = Math.min(howMany, elegibleFiles.length);

      // gets the file it needs
      while (added < howMany) {
        const src = elegibleFiles[(elegibleFiles.length * Math.random()) | 0];
        add(filesToAdd, src, instruction);
        added += 1;
      }

      // by default it will not repeat any files until it picked them all before
      // starting again with a new random sequence. It does that by keeping a
      // history of all the choices so far since the last reset. The
      // maxHistoryLength setting allow to shorten that history; if set to 0
      // there is no history at all
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
