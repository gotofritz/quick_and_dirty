const puppeteer = require('puppeteer');
const fs = require('fs');
const Mustache = require('mustache');

const {
  dataIsNotEmpty,
  getPageProcessorStrategy,
  newNotePath
} = require('./lib/lib');

const TEMPLATE_FILE_PATH = __dirname + '/note.mustache';
const PATH_BOOSTNOTE = '/Volumes/WD2T/BOOSTNOTE/notes';
const FOLDER_KEY = '8d6087855d66fe528c03';
const PATH_URLS_FILE = __dirname + '/urls.txt';

const noteTemplate = fs.readFileSync(TEMPLATE_FILE_PATH, 'utf8');
const browser = await puppeteer.launch();

const urls = fs
  .readFileSync(PATH_URLS_FILE, 'utf8')
  .split(/\n+/)
  .filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !/^\s*#/.test(trimmed);
  })
  .map(line => {
    // don't forget .split(xxx, 2) will only stop at two matches and discard the
    // rest, not return you a string with the rest - so we get 'the rest' as an
    // array and then manually join it below
    const [url, ...tags] = line.split(/\s+/);
    return {
      url,
      // so, tags is potentially an array like this:
      // ['my', 'tag', ',', 'and,another', 'tag']
      // and we want to get back to
      // ['my tag', 'and', 'another tag']
      tags: tags
        // we undo the previous split by \s - we only needed it to splut url
        // from list of tag
        .join(' ')
        // that's the split we really wanted
        .split(',')
        .map(tag => tag.trim())
    };
  });
processFile(urls);

async function processFile(queue) {
  const page = await browser.newPage();
  let url;
  let tags;

  let { url, tags } = queue.shift();
  console.log(`Trying ${url} ....`);
  let noteData = {
    folder: FOLDER_KEY,
    url,
    tags,
    updated: new Date().toISOString()
  };

  await page.goto(url);
  try {
    let pageProcessor = await getPageProcessorStrategy(url);
    noteData = await pageProcessor({
      browser,
      page,
      noteData
    });
  } catch (e) {
    console.log('There was an error');
    console.log(e);
  }

  if (dataIsNotEmpty(noteData)) {
    const saveTo = newNotePath(PATH_BOOSTNOTE);
    fs.writeFileSync(
      saveTo,
      Mustache.render(noteTemplate, noteData),
      'utf8'
    );
    console.log(saveTo, noteData);
  }

  if (queue.length === 0) {
    await browser.close();
    return 0;
  }
  processFile(queue);
}
