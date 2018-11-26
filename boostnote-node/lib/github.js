const { consolidateTags, getDataFromPage, pathinfo } = require('./lib');
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
  await page.goto(readmeUrl);
  return await page.$eval('body > pre', el => el.textContent);
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
  } catch (e) {}
  return author;
};

module.exports = {
  fetchData: async ({ browser, page, noteData }) => {
    const { src, tags } = noteData;
    let additionalData = await getDataFromPage(page, [
      // this is the paragraph of text at the top of a github page
      { key: 'preamble', query: '[itemprop=about]' },
      // we look for the link to the README.md, there is usually a date next to it
      {
        key: 'created',
        query: 'a[title="README.md"]',
        processFn:
          'return el.parentNode.parentNode.parentNode.querySelector(".age [datetime]").getAttribute("datetime")',
      },
    ]);
    const updatedData = {
      ...noteData,
      ...additionalData,
      tags: consolidateTags(tags),
      authors: await getAuthorDetails(browser, src),
      content: await getContent(browser, src),
    };
    return updatedData;
  },
};
