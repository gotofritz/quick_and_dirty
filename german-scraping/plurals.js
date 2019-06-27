#!/usr/bin/env node

/**
 * A quick and dirty script to get plurals + phonetic transcripts of german
 * words from wiktionary and export them in Anki friendly format.
 *
 * The cards this is exporting to are custom Anki cards with 5 tab separated
 * fields plus tags, treated as a fourth field by Anki. You can see the format
 * in the template
 *
 * Input is two files: one is a list of words already in anki, DEUSingular.tsv.
 * The other is a list of new words, which are only singular, plural and
 * english, DEUPlural.txt.
 *
 * The task is to load the new words, remove the ones I already have, and for
 * all the other get the plural + phonetic from wiktionary, then format the lot
 * so that I can import it into Anki
 *
 * Because the API occasionally throttles me, I write the problematic words to
 * an error file, so that I can try again later
 *
 * The original list of words comes from
 * https://frequencylists.blogspot.com/2015/12/the-2000-most-frequent-german-nouns.html
 */

const https = require('https');
const fs = require('fs');

const Anki = require('./lib/anki');
const CaseInsensitiveSet = require('./lib/CaseInsensitiveSet');

const EXISTING_FILE_PATH = __dirname + '/DEUSingular.tsv';
const CANDIDATE_FILE_PATH = __dirname + '/DEUPlural.txt';
const OUTPUT_FILE_PATH = __dirname + '/plurals_output.txt';
const ERROR_FILE_PATH = __dirname + '/plurals_errors.txt';
const DEFAULT_TAGS = 'deu.noun';

Anki.loadTemplate('PLURALS');

const existingWords = loadExistingWords(EXISTING_FILE_PATH);
const candidateWords = loadCandidateWords(CANDIDATE_FILE_PATH);
const queueToProcess = candidateWords.filter(
  candidate => !existingWords.has(candidate['German Singular']),
);
console.log(
  `candidateWords: ${candidateWords.length}, queueToProcess: ${
    queueToProcess.length
  }`,
);
processQueue(queueToProcess, Anki);

function loadExistingWords(pth) {
  return new CaseInsensitiveSet(
    fs
      .readFileSync(pth)
      .toString()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line),
  );
}

function loadCandidateWords(pth) {
  return fs
    .readFileSync(pth)
    .toString()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      const chunks = line.split('\t');
      if (chunks.length === 3) {
        const card = {
          original: line,
          'German Plural': undefined,
          phonetic: undefined,
          tags: DEFAULT_TAGS,
        };
        [
          card.English,
          card['German article'],
          card['German Singular'],
        ] = chunks;
        card['German article'] = card['German article'].toLowerCase();
        return card;
      } else {
        console.log('>>>>> NOT 3', line, chunks);
      }
    });
}
async function processQueue(queue, dataWriter) {
  if (queue.length === 0) {
    dataWriter.write(OUTPUT_FILE_PATH);
    dataWriter.writeErrors(ERROR_FILE_PATH);
    return;
  }
  const card = queue.shift();
  try {
    const response = await getDataFromAPI(card);
    dataWriter.add(response);
    processQueue(queue, dataWriter);
  } catch (e) {
    dataWriter.error(card.original);
  } finally {
    processQueue(queue, dataWriter);
  }
}

function getDataFromAPI(card) {
  const url = makeRequestUrl(card['German Singular']);

  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode < 200 || response.statusCode > 299) {
        console.log(
          `ERROR: Couldn't get data from API, status code: ${
            response.statusCode
          }`,
        );
        reject(card.original);
      }

      let responseText = '';
      response.setEncoding('utf8');
      response.on('data', chunk => (responseText += chunk));
      response.on('end', () => {
        if (!responseText) {
          console.log(`ERROR: No response text collected`);
          reject(card.original);
        }

        const pages = JSON.parse(responseText).query.pages[0];
        if (pages.missing) {
          // no definition for the card
          console.log(`MISSING ${pages.title}`);
          resolve(card);
        } else {
          try {
            // this is where all the knowledge of the Wiktionary API data format is
            // it's basically a weird object full of huge strings to be processed with
            // regular expressions (yuck!)
            const content = pages.revisions[0].slots.main.content;

            [, card.phonetic] =
              content.match(/\{\{Lautschrift\|(.+?)\}\}/) || [];
            [, card['German Plural']] =
              content.match(/\|Nominativ Plural=(.+?)[\n|]/) || [];
            resolve(card);
          } catch (e) {
            console.log(`PROBLEM: ${e}`);
            console.log(responseText);
            reject(card);
          }
        }
      });
    });
    request.on('error', e => {
      console.log(`ERROR: problem with request`);
      reject(card.original);
    });
    request.end();
  });
}

// creates the options object for the http request, with hard coded URL
function makeRequestUrl(word) {
  const titles = encodeURIComponent(word);
  return `https://de.wiktionary.org/w/api.php?action=query&titles=${titles}&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main`;
}
