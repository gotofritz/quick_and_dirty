/**
 * 2018-09-08 Models a collection of Anki cards. For now just creating them as a
 * text file that can be imported into Anki, following a template
 */
const fsPromises = require('fs').promises;
const path = require('path');
const mustache = require('mustache');

const PATH_TEMPLATES = 'templates';
const SUFFIX = '.tmpl';
let cards = [];
let errors = [];

class Anki {
  constructor() {
    this.template = '';
  }

  // adds a card to the collection
  add(fields) {
    cards.push(fields);
  }

  // adds an original line of test to the errors collection
  error(line) {
    errors.push(line);
  }

  // template use {{mustache}} syntax to define fields
  async loadTemplate(ref) {
    const raw = await fsPromises.readFile(
      path.join(__dirname, PATH_TEMPLATES, ref.toLowerCase() + SUFFIX),
      'utf8',
    );
    if (raw) {
      this.template = raw;
      mustache.parse(this.template);
    }
  }

  // writes whole list to a text file
  async write(pathToFile) {
    const rendered = cards.map(card => mustache.render(this.template, card));
    await fsPromises
      .writeFile(pathToFile, rendered.join('\n'), 'utf8')
      .then(() =>
        console.log(`Written ${rendered.length} records to ${pathToFile}`),
      );
  }

  // writes whole list to a text file
  async writeErrors(pathToFile) {
    return await fsPromises
      .writeFile(pathToFile, errors.join('\n'), 'utf8')
      .then(() =>
        console.log(`Written ${errors.length} errors to ${pathToFile}`),
      );
  }
}

module.exports = new Anki();
