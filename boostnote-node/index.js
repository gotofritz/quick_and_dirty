const puppeteer = require('puppeteer');
const fs = require('fs');
const Mustache = require('mustache');

const {
  cleanPageContent,
  cleanseUrl,
  dataIsNotEmpty,
  getPageProcessorStrategy,
  loadInstructions,
  newNoteAddress,
  newNotePath,
} = require('./lib/lib');

const { log, divider } = require('./lib/utils');

const {
  TEMPLATE_FILE_PATH,
  FOLDER_KEY,
  PATH_URLS_FILE,
} = require('./lib/const');

let browser;

const program = require('./lib/readCliParams')({
  PATH_URLS_FILE,
});
if (program.dryRun) {
  log(!program.quiet, 'Running in dry-run mode...');
}
const noteTemplate = fs.readFileSync(TEMPLATE_FILE_PATH, 'utf8');
const instructionsQueue = loadInstructions({ pth: PATH_URLS_FILE });
log(program.verbose, instructionsQueue);

const notes = {};

processFile(instructionsQueue);

async function processFile(queue) {
  if (!browser) {
    browser = await puppeteer.launch();
  }
  const page = await browser.newPage();

  let instruction = queue.shift();
  let { src, tags } = instruction;
  src = cleanseUrl(src);
  divider(!program.quiet);
  log(!program.quiet, `Source: ${src} ....`);
  if (src !== instruction.src) {
    log(program.verbose, `(original source was: ${instruction.src})`);
  }

  let pageProcessor = getPageProcessorStrategy(src);
  src = pageProcessor.rewriteUrl(src);
  log(!program.quiet, `Rewritten as: ${src}`);

  let noteAddress = newNoteAddress();
  let noteData = {
    folder: FOLDER_KEY,
    src,
    tags: pageProcessor.consolidateTags(tags),
    updated: new Date().toISOString(),
    noteAddress,
  };

  try {
    await page.goto(src);
    console.log('PAGE LOADED');
    // page.on('console', msg =>
    //   console.log('---------------------PAGE LOG:', msg.text()),
    // );
    noteData = await pageProcessor.fetchData({
      browser,
      page,
      noteData,
    });
  } catch (e) {
    console.log(`There was an error with ${src}`);
    console.log(e);
  }

  noteData.preamble = cleanPageContent(noteData.preamble);
  noteData.content = cleanPageContent(noteData.content);

  if (dataIsNotEmpty(noteData)) {
    const saveTo = newNotePath(noteAddress);
    const rendered = Mustache.render(noteTemplate, noteData);
    if (program.dryRun) {
      divider(!program.quiet);
      log(!program.quiet, noteData);
      divider(!program.quiet);
      log(!program.quiet, rendered);
    } else {
      fs.writeFileSync(saveTo, rendered, 'utf8');
      log(!program.quiet, saveTo, noteData);
    }
    delete noteData.content;
    divider(!program.quiet);
  }

  if (queue.length === 0) {
    await browser.close();
    return 0;
  }
  processFile(queue);
}
