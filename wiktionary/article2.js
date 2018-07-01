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

const DEFAULT_TAGS = 'deu phonetics';
const DEFAULT_PHONETICS = '--';
const wordsQueue = ['hassen', 'Hals', 'fakeeeee', 'wetzte', 'Hasen'];

main();

function main() {
  processQueue(wordsQueue);
}

// asynchronously processes each instruction
function processQueue(inputQueue, processedQueue = []) {
  if (inputQueue.length === 0) {
    return writeOutput(processedQueue);
  }

  const url = makeRequestUrl(inputQueue.shift());
  const request = https.get(url, response => {
    if (response.statusCode < 200 || response.statusCode > 299) {
      logError(`Couldn't get data from API, status: ${response.statusCode}`);
    } else {
      let responseText = '';
      response.setEncoding('utf8');
      response.on('data', chunk => (responseText += chunk));
      response.on('end', () => {
        if (!responseText) {
          logError(`No response text collected`);
        } else {
          const page = JSON.parse(responseText).query.pages[0];
          const phonetics = page.missing
            ? DEFAULT_PHONETICS
            : getPhonetics(page.revisions[0].content);
          const card = `${page.title}\t${phonetics}\t${DEFAULT_TAGS}`;
          processedQueue.push(card);
        }
        processQueue(inputQueue, processedQueue);
      });
    }
  });
  request.on('error', e => {
    logError(`problem with request: ${e.message}`);
  });
  request.end();
}

function getPhonetics(rawText) {
  const phonetics = rawText.match(/\{\{Lautschrift\|(.+?)\}\}/);
  return phonetics ? phonetics[1] : '--';
}

function logError(...args) {
  console.log('ERROR:', ...args);
}

// this could write to a file, but at the moment we just print to STDOUT
// and use standard UNIX pipe to write to a file
function writeOutput(lines) {
  console.log(lines.join('\n'));
}

// creates the options object for the http request, with hard coded URL
function makeRequestUrl(word) {
  return `https://de.wiktionary.org/w/api.php?action=query&titles=${word}&format=json&formatversion=2&prop=revisions&rvprop=content`;
}
