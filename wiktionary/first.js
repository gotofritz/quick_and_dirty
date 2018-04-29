#!/usr/bin/env node

/**
 * A quick and dirty script to get phonetic transcripts of german words from
 * wiktionary and export them in Anki friendly format.
 *
 * The cards this is exporting to are custom Anki cards with three tab separated
 * fields: Front, Back, note. Plus tags, treated as a fourth field by Anki.
 *
 * Input is a file wiktionary_input.txt, with 2 tab separated fields, copied as
 * is:
 * FRONT OF CARD[TAB]note
 * FRONT OF CARDS is either a single word, or a / separated list of words to
 * look up.
 *
 * Output is a file wiktionary_output.txt with the original fields, some hard-
 * coded tags, and BACK in the same format as FRONT, i.e. wither a word or a
 * / separated list of words
 *
 * TODO: promisify
 * https://medium.com/adobe-io/how-to-combine-rest-api-calls-with-javascript-promises-in-node-js-or-openwhisk-d96cbc10f299
 * https://www.tomas-dvorak.cz/posts/nodejs-request-without-dependencies/
 */

const https = require('https');
const fs = require('fs');

const INPUT_FILE_PATH = __dirname + '/wiktionary_input.txt';
const OUTPUT_FILE_PATH = __dirname + '/wiktionary_output.txt';
const DEFAULT_TAGS = 'deu phonetics';

let wordsQueue = getLinesFromFile();
let cardsQueue = [];

processQueue(wordsQueue, cardsQueue);

// asynchronously processes each instruction
function processQueue(inputQueue, processedQueue) {
  if (inputQueue.length === 0) {
    return writeOutput(processedQueue);
  }

  // translates a tab-separated instruction into an object with fields, and
  // pushes it in the next queue
  const card = createCard({
    tabSeparated: inputQueue.shift(),
  });
  cardsQueue.push(card);

  // front can be either  either a word or a list / of / words
  const words = card.front.split(/\s+\/\s+/);

  // luckily wiktionary allow to look up more than one word at once, so we can
  // process each card as one unit
  const req = https.get(makeRequestUrl(words), requestHandler);
  req.on('error', e => {
    console.error(`problem with request: ${e.message}`);
  });
  req.end();
}

// function getContent() {
//   return new Promise((resolve, reject) => {
//     const request = lib.get(url, (response) => {
//       // handle http errors
//       if (response.statusCode < 200 || response.statusCode > 299) {
//          reject(new Error('Failed to load page, status code: ' + response.statusCode));
//        }
//       // temporary data holder
//       const body = [];
//       // on every content chunk, push it to the data array
//       response.on('data', (chunk) => body.push(chunk));
//       // we are done, resolve promise with those joined chunks
//       response.on('end', () => resolve(body.join('')));
//     });
//     // handle connection errors of the request
//     request.on('error', (err) => reject(err))
//     })
// }

// anki can import a simple tsv file, created here without error checking
function writeOutput(processedQueue, pth = OUTPUT_FILE_PATH) {
  var exportable = processedQueue.reduce(
    (accumulator, { front, back = '', note = '', tag }, i) =>
      `${i === 0 ? '' : accumulator + '\n'}${front}\t${back}\t${note}\t${tag}`,
    '',
  );
  fs.writeFileSync(pth, exportable, 'utf8');
}

// processes the API response
function requestHandler(res) {
  let responseText = '';

  if (res.statusCode !== 200) {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    console.log(cardsQueue.pop());
  }
  res.setEncoding('utf8');

  res.on('data', chunk => {
    responseText += chunk;
  });

  res.on('end', () => {
    if (!responseText) return;

    // this is where all the knowledge of the Wiktionary API data format is
    // it's basically a weird object full of huge strings to be processed with
    // regular expressions (yuck!)
    try {
      const pages = JSON.parse(responseText).query.pages;
      const card = cardsQueue.pop();

      // each 'page' is the data associated with a word in CARD FRONT
      ({ back: card.back, front: card.front } = pages.reduce(
        (accumulator, current, i) => {
          accumulator.front =
            i === 0 ? current.title : `${accumulator.front} / ${current.title}`;
          if (!current.revisions) return accumulator;

          const phonetics = current.revisions[0].content.match(
            /\{\{Lautschrift\|(.+?)\}\}/,
          );
          const back = phonetics ? phonetics[1] : '--';
          accumulator.back =
            i === 0 ? back : `${accumulator.back || '--'} / ${back}`;
          return accumulator;
        },
        {
          back: '',
          front: '',
        },
      ));
      console.log(card);
      cardsQueue.push(card);
      processQueue(wordsQueue, cardsQueue);
    } catch (e) {
      console.log('RESPONSE PARSING ERROR', e);
    }
  });
}

// input is a simple hard coded file with one instruction per line
function getLinesFromFile(pth = INPUT_FILE_PATH) {
  return fs
    .readFileSync(pth)
    .toString()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);
}

// converts a string to an object
// string is FRONT\tNOTE
function createCard({ tabSeparated }) {
  const card = {
    tag: DEFAULT_TAGS,
  };
  [card.front, card.note = ''] = tabSeparated.split('\t');
  return card;
}

// creates the options object for the http request, with hard coded URL
function makeRequestUrl(words) {
  const titles = encodeURIComponent(words.join('|'));
  return `https://de.wiktionary.org/w/api.php?action=query&titles=${titles}&format=json&formatversion=2&prop=revisions&rvprop=content`;
}
