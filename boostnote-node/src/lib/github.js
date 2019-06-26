const { getDataFromPage, pathinfo } = require('./lib');
const { log } = require('./utils');

//https://raw.githubusercontent.com/s0md3v/XSStrike/master/README.md

// for content we use the raw content of the README.md
const getContent = async (browser, src) => {
  let info = pathinfo(src);
  let fragment = info.pathname
    .split('/', 3)
    .slice(1, 3)
    .join('/');
  let readmeUrl = `https://raw.githubusercontent.com/${fragment}/master/README.md`;
  const page = await browser.newPage();
  let content = '';
  try {
    let response = await page.goto(readmeUrl);
    if (response.status() < 300) {
      content = await page.$eval('body > pre', el => el.textContent);
    } else {
      readmeUrl = readmeUrl.replace(/README/, 'readme');
      response = await page.goto(readmeUrl);
      if (response.status() < 300) {
        content = await page.$eval('body > pre', el => el.textContent);
      }
    }
  } catch (e) {
    log(true, 'ERROR', e);
  }
  return content || '';
};

// we load the author's page to get their full name
const getAuthorDetails = async (browser, src) => {
  let info = pathinfo(src);
  let username = info.pathname.split('/', 2).pop();
  let authorUrl = `https://github.com/${username}`;
  const page = await browser.newPage();
  await page.goto(authorUrl);
  let author = '';
  try {
    author = await page.$eval('.vcard-fullname', el => el.textContent);
  } catch (e) {} // eslint-disable-line no-empty
  return author;
};

module.exports = {
  fetchData: async ({ browser, page, noteData }) => {
    const { src } = noteData;
    let additionalData = await getDataFromPage(page, [
      // the title is generally too long
      {
        key: 'title',
        query: 'h1 [itemprop=name] a',
        processFn: function(el) {
          return el.getAttribute('href').substring(1);
        },
      },
      // this is the paragraph of text at the top of a github page
      { key: 'preamble', query: '[itemprop=about]' },
      // we look for the link to the README.md, there is usually a date next to it
      {
        key: 'created',
        query: 'a[title="README.md" i]',
        processFn:
          'return el.parentNode.parentNode.parentNode.querySelector(".age [datetime]").getAttribute("datetime")',
      },
    ]);
    const updatedData = {
      ...noteData,
      ...additionalData,
      authors: await getAuthorDetails(browser, src),
      content: await getContent(browser, src),
    };
    return updatedData;
  },
};
