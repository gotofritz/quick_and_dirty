#!/usr/bin/env node

/**
 * A quick and dirty script to create anki cards of adjectives from wiktionary
 *
 * The cards this is exporting to are custom Anki cards with 5 tab separated
 * fields plus tags, treated as a fourth field by Anki. You can see the format
 * in the template
 *
 * Input is the complete wiktionary as JSON files, which I have downloaded
 *
 * The task
 * - go through each json file
 * - discard those that do not apply (not an adjective, starts with a capital,
 *   it's a variation, etc)
 * - append to card list
 *
 * The original JSON list comes from
 * https://github.com/dan1wang/jsonbook-builder
 */

const path = require('path');
const glob = require('glob');

const Anki = require('./lib/anki');

const PATH_SRC_DATA = '/Volumes/WD2T/BACKUP/WIKTIONARY-GERMAN/';
const PATH_OUTPUT_FILE = __dirname + '/adjectives_output.txt';
const DEFAULT_TAGS = 'deu.adjective';

Anki.loadTemplate('ADJECTIVES')
  .catch(err => {
    console.log(`ERROR LOADING TEMPLATE ${err}`);
    process.exit(1);
  })
  .then(() => {
    const fileList = glob.sync('**/*.json', { cwd: PATH_SRC_DATA });

    for (let i = 0; i < fileList.length; i++) {
      const { title, text: [{ subSections }] } = require(path.join(
        PATH_SRC_DATA,
        fileList[i],
      ));
      const de = title;
      const relevant = subSections
        .filter(subSection => subSection.title === 'German')
        .map(subSection => subSection.subSections)
        .filter(
          subs =>
            subs &&
            Array.isArray(subs) &&
            subs.length &&
            subs.some(
              sub => sub.title === 'Adjective' && !/inflected/.test(sub.text),
            ),
        )[0];
      if (!relevant) continue;

      const german = relevant
        .map(sub => {
          let { title, text } = sub;

          let phonetic;
          if (title === 'Pronunciation') {
            [, phonetic] = text.match(/\{\{IPA\|\/(.+?)\//) || [];
            return phonetic ? { phonetic } : undefined;
          }
          if (title === 'Adjective') {
            text = text
              .replace(/^.+?\n\n#/s, '')
              .replace(/\n#?\*.+$/s, '')
              .replace(/\{\{.+?\}\},?/g, '')
              .replace(/\s+/, '')
              .replace(/[\[\]]/g, '')
              .replace(/ *\n# */gs, '<br>');
            return text ? { en: text } : undefined;
          }
        })
        .filter(x => x)
        .reduce((soFar, now) => ({ ...soFar, ...now }), {
          en: undefined,
          de,
          phonetic: undefined,
          tags: DEFAULT_TAGS,
        });
      if (german.de && german.en) Anki.add(german);
    }
    return Anki.write(PATH_OUTPUT_FILE, { randomise: true });
  })
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.log(`ERROR WRITING FILE ${err}`);
    process.exit(1);
  });
