const path = require('path');
const { EVENT_POTENTIAL_FILES_WERE_FOUND } = require('../../types');

// Some movies are long, and split into sub-movies that live in their own folder
// a/a, a/b a/c, a/long/1 a/long/2 a/long/3 a/d ....
// We want to round-robin among all folders, but if encounter one of these
// split movies we want to play all of them in a sequence before carrying on round
// robing
module.exports = fileCollectorEmitter => {
  fileCollectorEmitter.on(
    EVENT_POTENTIAL_FILES_WERE_FOUND,
    ({ instruction, allFiles, filesToAdd }) => {
      if (!instruction.oneLevelWide) return { instruction, filesToAdd };
      const destLength = instruction.dest.length;

      // here we get an object with an array for every folder
      const tempStorage = allFiles.reduce((accumulator, current) => {
        const endOfPath = path.dirname(current.substr(destLength));

        // this will either be the same as dirName or not
        const key = endOfPath.split('/')[0];

        if (!accumulator[key]) {
          accumulator[key] = [];
        }
        let lastIndex = Math.max(accumulator[key].length - 1, 0);
        // if it's one of those split movies, we store them in an array inside
        // the array
        if (endOfPath.includes('/')) {
          if (!Array.isArray(accumulator[key][lastIndex])) {
            accumulator[key].push([current]);
          } else if (
            path.dirname(accumulator[key][lastIndex][0].substr(destLength)) !==
            endOfPath
          ) {
            accumulator[key].push([current]);
          } else {
            accumulator[key][lastIndex].push(current);
          }
        } else {
          if (accumulator[key].length <= 4) accumulator[key].push(current);
        }
        return accumulator;
      }, {});

      let maxLength = Object.values(tempStorage).reduce(
        (accumulator, current) => {
          return Math.max(accumulator, current.length);
        },
        0,
      );

      let tempArrayStorage = Object.values(tempStorage).reduce(
        (accumulator, current) => {
          let pointer = accumulator.length;
          accumulator[pointer] = [];
          while (accumulator[pointer].length < maxLength) {
            accumulator[pointer] = accumulator[pointer].concat(current);
            current.sort(() => (Math.random() < 0.5 ? -1 : 1));
          }
          if (accumulator[pointer].length > maxLength) {
            accumulator[pointer].splice(maxLength);
          }
          return accumulator;
        },
        [],
      );

      filesToAdd = [];

      // now we round-robin through the object to get the final list
      while (tempArrayStorage.length > 0) {
        for (let i = tempArrayStorage.length - 1; i >= 0; i--) {
          const filesToPush = tempArrayStorage[i].shift();
          if (Array.isArray(filesToPush)) {
            filesToAdd.push(...filesToPush);
          } else {
            filesToAdd.push(filesToPush);
          }
          if (tempArrayStorage[i].length === 0) {
            tempArrayStorage.splice(i, 1);
          }
        }
      }

      return {
        instruction,
        filesToAdd,
      };
    },
  );
};
