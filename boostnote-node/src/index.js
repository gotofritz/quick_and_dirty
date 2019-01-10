const puppeteer = require('puppeteer');
const fs = require('fs');
const Mustache = require('mustache');

const {
  cleanPageContent,
  dataIsNotEmpty,
  generateQueue,
  newNotePath,
} = require('./lib/lib');

const { CMD_CREATE, CMD_FETCH_FROM_PAGE } = require('./lib/commands');

const { TEMPLATE_FILE_PATH, PATH_URLS_FILE } = require('./lib/const');

const InstructionsStore = require('./lib/InstructionsStore');
const Logger = require('./lib/Logger');
const NotesStore = require('./lib/NotesStore');

let browser;
let page;
let pageData;

const program = require('./lib/readCliParams')({
  PATH_URLS_FILE,
});
const logger = new Logger(program);

if (program.dryRun) {
  logger.log('Running in dry-run mode...');
}
const noteTemplate = fs.readFileSync(TEMPLATE_FILE_PATH, 'utf8');
const rawIntructions = new InstructionsStore({
  pth: PATH_URLS_FILE,
  srcCleaner: require('./lib/lib').cleanseUrl,
});
rawIntructions.on('error', err => {
  logger.error(`rawIntructions error: ${err}`);
  process.exit(1);
});
rawIntructions.load();
const notes = new NotesStore();
notes.on('error', err => {
  logger.error(`notes error: ${err}`);
});
rawIntructions.forEach((instruction, i) => {
  const key = notes.create(instruction);
  rawIntructions.update(i, { key });
});
const instructionsQueue = generateQueue(rawIntructions.all());
logger.info(rawIntructions.all(), instructionsQueue);

const notesTemp = {};

processQueue(instructionsQueue);

async function processQueue(queue) {
  const instruction = queue.shift();
  switch (instruction.cmd) {
    case CMD_CREATE:
      notesTemp[instruction.payload.key] = instruction.payload;
      break;

    case CMD_FETCH_FROM_PAGE:
      if (!browser) {
        browser = await puppeteer.launch();
      }
      page = await browser.newPage();
      try {
        await page.goto(instruction.payload.src);
        logger.info('PAGE LOADED');
        // page.on('console', msg =>
        //   console.log('---------------------PAGE LOG:', msg.text()),
        // );
        pageData = await instruction.payload.processor({
          browser,
          page,
        });
        notesTemp[instruction.payload.key] = Object.assign(
          notesTemp[instruction.payload.key],
          pageData,
        );
      } catch (e) {
        logger.error(`There was an error with ${instruction.payload.src}`);
        logger.error(e);
      }
      break;

    default:
      logger.error(`ERROR: unknown command ${instruction.cmd}`);
      return;
  }
  if (queue.length === 0) {
    if (browser) {
      await browser.close();
    }
    logger.log('finished process queue');
    logger.info(notesTemp);
    writeNotes(notesTemp);
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
        logger.divider();
        logger.info(note);
        logger.divider();
        logger.info(rendered);
      } else {
        fs.writeFileSync(saveTo, rendered, 'utf8');
        logger.info(saveTo, note);
      }
      logger.divider();
    }
  });
  logger.log('FINISHED');
  return 0;
}

// processFile(rawIntructions);

// async function processFile(queue) {
//   let { key, src, tags } = queue.shift();
//   logger.divider();
//   logger.log(`Source: ${src} ....`);

//   let pageProcessor = getPageProcessorStrategy(src);
//   src = pageProcessor.rewriteUrl(src);
//   logger.log(`Rewritten as: ${src}`);

//   let noteData = {
//     folder: FOLDER_KEY,
//     src,
//     tags: pageProcessor.consolidateTags(tags),
//     updated: new Date().toISOString(),
//     noteAddress: key,
//   };

//   if (!notes[key]) {
//     notes[key] = noteData;
//   }

//   if (!browser) {
//     browser = await puppeteer.launch();
//   }
//   const page = await browser.newPage();
//   try {
//     await page.goto(src);
//     logger.log('PAGE LOADED');
//     // page.on('console', msg =>
//     //   console.log('---------------------PAGE LOG:', msg.text()),
//     // );
//     noteData = await pageProcessor.fetchData({
//       browser,
//       page,
//       noteData,
//     });
//   } catch (e) {
//     console.log(`There was an error with ${src}`);
//     console.log(e);
//   }

//   noteData.preamble = cleanPageContent(noteData.preamble);
//   noteData.content = cleanPageContent(noteData.content);

//   if (dataIsNotEmpty(noteData)) {
//     const saveTo = newNotePath(key);
//     const rendered = Mustache.render(noteTemplate, noteData);
//     if (program.dryRun) {
//       logger.divider();
//       logger.log(noteData);
//       logger.divider();
//       logger.log(rendered);
//     } else {
//       fs.writeFileSync(saveTo, rendered, 'utf8');
//       logger.log(saveTo, noteData);
//     }
//     delete noteData.content;
//     logger.divider();
//   }

//   if (queue.length === 0) {
//     await browser.close();
//     return 0;
//   }
//   processFile(queue);
// }
