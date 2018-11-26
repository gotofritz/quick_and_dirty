const puppeteer = require('puppeteer');
const fs = require('fs');
const Mustache = require('mustache');

const {
  dataIsNotEmpty,
  getPageProcessorStrategy,
  loadInstructions,
  newNotePath,
  newNoteRef,
} = require('./lib/lib');

const {
  TEMPLATE_FILE_PATH,
  FOLDER_KEY,
  PATH_URLS_FILE,
} = require('./lib/const');

let browser;
let page;

const noteTemplate = fs.readFileSync(TEMPLATE_FILE_PATH, 'utf8');
const instructionsQueue = loadInstructions({ pth: PATH_URLS_FILE });
processFile(instructionsQueue);

async function processFile(queue) {
  if (!browser) {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  }
  let { src, tags } = queue.shift();
  console.log(`Trying ${src} ....`);
  let noteRef = newNoteRef();
  let noteData = {
    folder: FOLDER_KEY,
    src,
    tags,
    updated: new Date().toISOString(),
    noteRef,
  };

  try {
    let pageProcessor = await getPageProcessorStrategy(src);
    if (pageProcessor.rewriteUrl) {
      src = pageProcessor.rewriteUrl(src);
      console.log(`rewritten as ${src}`);
    }
    await page.goto(src);
    console.log('PAGE LOADED');
    page.on('console', msg =>
      console.log('---------------------PAGE LOG:', msg.text()),
    );
    noteData = await pageProcessor.fetchData({
      browser,
      page,
      noteData,
    });
  } catch (e) {
    console.log(`There was an error with ${src}`);
    console.log(e);
  }

  if (dataIsNotEmpty(noteData)) {
    const saveTo = newNotePath(noteRef);
    fs.writeFileSync(saveTo, Mustache.render(noteTemplate, noteData), 'utf8');
    console.log(saveTo, noteData);
  }

  if (queue.length === 0) {
    await browser.close();
    return 0;
  }
  processFile(queue);
}
