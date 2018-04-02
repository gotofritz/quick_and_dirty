const path = require('path');
const { matcherFactory } = require('../shared');
const { EVENT_FILELIST_WAS_GENERATED } = require('../types');

const MAX_HISTORY_LENGTH = 8;

module.exports = hook => {
  hook.subscribe(
    EVENT_FILELIST_WAS_GENERATED,
    ({ instruction, files, candidates }) => {
      if (!instruction.random) return { instruction, files, candidates };

      instruction.howMany = instruction.howMany || 1;
      instruction.history = instruction.history || [];

      while (candidates.length < instruction.howMany) {
        const src = files[(files.length * Math.random()) | 0];
        let candidate = path.basename(src, '.mp4');
        if (instruction.matchUpTo) {
          candidate = matcherFactory(instruction.matchUpTo)(candidate);
        }
        if (!instruction.history.includes(candidate)) {
          candidates.push({
            refToInstruction: instruction.refToInstruction,
            isLast: false,
            src,
            dest: path.basename(src),
          });
          instruction.history.unshift(candidate);
          instruction.history = instruction.history.slice(
            0,
            MAX_HISTORY_LENGTH,
          );
        }
      }

      return {
        instruction,
        candidates,
      };
    },
  );
};
