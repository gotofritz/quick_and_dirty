const puppeteer = require('puppeteer');
const fs = require('fs');

const INPUT_FILE_PATH = __dirname + '/deepl_input.txt';
const OUTPUT_FILE_PATH = __dirname + '/deepl_output.txt';
const DEFAULT_TAGS = 'deu.wortschatz';

const sentences = getLinesFromFile();
const errors = [];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const result = [];

  for (const de of sentences) {
    const url = `https://www.deepl.com/translator#de/en/${de}`;
    await page.goto(url);
    await page.waitFor(1200);
    const translated = await page.evaluate(
      () => document.querySelectorAll('.lmt__textarea')[1].value,
    );
    if (translated) {
      result.push(`${translated}\t${de}\t\t${DEFAULT_TAGS}`);
    } else {
      errors.push(de);
    }
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE_PATH, result.join('\n'), 'utf8');
  console.log(`Got ${result.length} sentences`);
  if (errors.length) {
    fs.copyFileSync(INPUT_FILE_PATH, INPUT_FILE_PATH + '.bak');
    fs.writeFileSync(INPUT_FILE_PATH, errors.join('\n'), 'utf8');
    console.log(`Couldn't translate ${errors.length} entries`);
  }
})();

// input is a simple hard coded file with one instruction per line
function getLinesFromFile(pth = INPUT_FILE_PATH) {
  return fs
    .readFileSync(pth)
    .toString()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);
}
