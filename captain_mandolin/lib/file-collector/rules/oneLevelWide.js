const path = require('path');
const { EVENT_POTENTIAL_FILES_WERE_FOUND } = require('../../types');
const { saveToFile } = require('../../shared');

const DEBUG = Boolean(process.env.DEBUG);

// Some movies are long, and split into sub-movies that live in their own folder
// a/a, a/b a/c, a/long/1 a/long/2 a/long/3 a/d ....
// We want to round-robin among all folders, but if encounter one of these
// split movies we want to play all of them in a sequence before carrying on round
// robing
module.exports = fileCollectorEmitter => {
  fileCollectorEmitter.on(EVENT_POTENTIAL_FILES_WERE_FOUND, args => {
    if (!args.instruction.oneLevelWide) return;

    const {
      /* this is an object in this format
      { src: 'ADVENTURE',
        last:
        '/Volumes/WD2T/VIDEO/SHORTS/ADVENTURE/SUPERTED/SUPERTED and the Pearl Fishers.mp4',
        dest: '/Volumes/BLACK_STICK/SHORTS',
        oneLevelWide: true,
        howMany: 1,
        refToInstruction: 0
      }
      */
      instruction,

      // allFiles contains paths in the form
      // /Volumes/WD2T/VIDEO/SHORTS/CLASSICS/ARTHUR/ARTHUR 10b.mp4
      allFiles,
    } = args;

    const destLength = instruction.dest.length;

    /* here we get an object with an array for every folder
       "CORTO MALTESE": [
        "/Volumes/WD2T/VIDEO/SHORTS/ITALIAN/CORTO MALTESE/CORTO Concerto In ò minore per Arpa e Nitroglicerina.mp4",
        [
          "/Volumes/WD2T/VIDEO/SHORTS/ITALIAN/CORTO MALTESE/CORTO Corte Sconta detta Arcana/CORTO Corte Sconta detta Arcana 01.mp4",
          "/Volumes/WD2T/VIDEO/SHORTS/ITALIAN/CORTO MALTESE/CORTO Corte Sconta detta Arcana/CORTO Corte Sconta detta Arcana 02.mp4",
          "/Volumes/WD2T/VIDEO/SHORTS/ITALIAN/CORTO MALTESE/CORTO Corte Sconta detta Arcana/CORTO Corte Sconta detta Arcana 03.mp4",
          ...
      */
    const tempStorage = allFiles.reduce((accumulator, current) => {
      // example:
      // ITALIAN/CORTO MALTESE/CORTO La casa dorata di Samarcanda
      // or
      // ITALIAN/CORTO MALTESE
      const endOfPath = path.dirname(current.substr(destLength));

      // this will either be the same as dirName or not
      const key = endOfPath.split('/')[1];

      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      let lastIndex = Math.max(accumulator[key].length - 1, 0);

      // if it's one of those split movies, we store them in an array inside
      // the array
      const separators = endOfPath.match(/\//g) || [];
      if (separators.length > 1) {
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
        accumulator[key].push(current);
      }
      return accumulator;
    }, {});

    let maxLength = Object.values(tempStorage).reduce(
      (accumulator, current) => {
        return Math.max(accumulator, current.length);
      },
      0,
    );

    DEBUG && saveToFile('log-tempStorage', tempStorage);

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

    DEBUG && saveToFile('log-tempArrayStorage.txt', tempArrayStorage);

    args.allFiles.length = 0;

    // now we round-robin through the object to get the final list
    while (tempArrayStorage.length > 0) {
      for (let i = tempArrayStorage.length - 1; i >= 0; i--) {
        const filesToPush = tempArrayStorage[i].shift();
        if (Array.isArray(filesToPush)) {
          args.allFiles.push(...filesToPush);
        } else {
          args.allFiles.push(filesToPush);
        }
        if (tempArrayStorage[i].length === 0) {
          tempArrayStorage.splice(i, 1);
        }
      }
    }

    DEBUG && saveToFile('log-filesToPush.txt', args.filesToAdd);
  });
};
