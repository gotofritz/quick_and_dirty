const puppeteer = require('puppeteer');
const fs = require('fs');
const Mustache = require('mustache');

const {
  cleanPageContent,
  dataIsNotEmpty,
  generateQueue,
  getPageProcessorStrategy,
  loadInstructions,
  newNotePath,
} = require('./lib/lib');

const { log, divider } = require('./lib/utils');
const { CMD_CREATE, CMD_FETCH_FROM_PAGE } = require('./lib/commands');

const {
  TEMPLATE_FILE_PATH,
  FOLDER_KEY,
  PATH_URLS_FILE,
} = require('./lib/const');

let browser;
let page;
let pageData;

const program = require('./lib/readCliParams')({
  PATH_URLS_FILE,
});
if (program.dryRun) {
  log(!program.quiet, 'Running in dry-run mode...');
}
const noteTemplate = fs.readFileSync(TEMPLATE_FILE_PATH, 'utf8');
const rawIntructions = loadInstructions({ pth: PATH_URLS_FILE });
log(program.verbose, rawIntructions);
const instructionsQueue = generateQueue(rawIntructions);
log(program.verbose, instructionsQueue);

const notes = {};

processQueue(instructionsQueue);

async function processQueue(queue) {
  const instruction = queue.shift();
  switch (instruction.cmd) {
    case CMD_CREATE:
      notes[instruction.payload.key] = instruction.payload;
      break;

    case CMD_FETCH_FROM_PAGE:
      if (!browser) {
        browser = await puppeteer.launch();
      }
      page = await browser.newPage();
      try {
        await page.goto(instruction.payload.src);
        log(!program.quiet, 'PAGE LOADED');
        // page.on('console', msg =>
        //   console.log('---------------------PAGE LOG:', msg.text()),
        // );
        pageData = await instruction.payload.processor({
          browser,
          page,
        });
        notes[instruction.payload.key] = Object.assign(
          notes[instruction.payload.key],
          pageData,
        );
      } catch (e) {
        console.log(`There was an error with ${instruction.payload.src}`);
        console.log(e);
      }
      break;

    default:
      log(!program.quiet, `ERROR: unknown command ${instruction.cmd}`);
      return;
  }
  if (queue.length === 0) {
    if (browser) {
      await browser.close();
    }
    log(!program.quiet, 'finished process queue');
    log(!program.quiet, notes);
    writeNotes(notes);
  } else {
    processQueue(queue);
  }
}

function writeNotes(noteStore) {
  Object.entries(noteStore).forEach(([key, note]) => {
    if (dataIsNotEmpty(note)) {
      note.preamble = cleanPageContent(note.preamble);
      note.content = cleanPageContent(note.content);
      const saveTo = newNotePath(key);
      const rendered = Mustache.render(noteTemplate, note);
      if (program.dryRun) {
        divider(!program.quiet);
        log(!program.quiet, note);
        divider(!program.quiet);
        log(!program.quiet, rendered);
      } else {
        fs.writeFileSync(saveTo, rendered, 'utf8');
        log(!program.quiet, saveTo, note);
      }
      divider(!program.quiet);
    }
  });
  log(!program.quiet, 'FINISHED');
  return 0;
}

// processFile(rawIntructions);

async function processFile(queue) {
  let { key, src, tags } = queue.shift();
  divider(!program.quiet);
  log(!program.quiet, `Source: ${src} ....`);

  let pageProcessor = getPageProcessorStrategy(src);
  src = pageProcessor.rewriteUrl(src);
  log(!program.quiet, `Rewritten as: ${src}`);

  let noteData = {
    folder: FOLDER_KEY,
    src,
    tags: pageProcessor.consolidateTags(tags),
    updated: new Date().toISOString(),
    noteAddress: key,
  };

  if (!notes[key]) {
    notes[key] = noteData;
  }

  if (!browser) {
    browser = await puppeteer.launch();
  }
  const page = await browser.newPage();
  try {
    await page.goto(src);
    log(!program.quiet, 'PAGE LOADED');
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
    const saveTo = newNotePath(key);
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
