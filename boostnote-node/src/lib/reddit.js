const { getDataFromPage, getImage, markdownImageFromPath } = require('./lib');

const getPreambleData = page =>
  page.evaluate(() => {
    return {
      href: document.querySelector('.top-matter a.title').getAttribute('href'),
      txt: document.querySelector('.expando .usertext-body')
        ? document.querySelector('.expando .usertext-body').innerHtml
        : '',
      img:
        document.querySelectorAll('.media-preview-content img').length > 0
          ? document
              .querySelector('.media-preview-content img')
              .getAttribute('src')
          : null,
    };
  });

module.exports = {
  rewriteUrl: pth => pth.replace(/www\.reddit/, 'old.reddit'),
  fetchData: async ({ page, noteData }) => {
    const preambleData = await getPreambleData(page);
    const physicalImg = preambleData.img
      ? await getImage({
          imageUrl: preambleData.img,
          noteAddress: noteData.noteAddress,
        })
      : null;
    let preamble = '';
    if (!preambleData.href.match(/^\/r\//)) {
      preamble += preambleData.href + '\n';
    }
    if (physicalImg) {
      preamble += markdownImageFromPath(physicalImg) + '\n\n';
    }
    if (preambleData.txt) {
      preamble += preambleData.txt;
    }

    let additionalData = await getDataFromPage(page, [
      { key: 'title', query: '.top-matter a.title' },
      {
        key: 'created',
        query: '.date [datetime]',
        attr: 'datetime',
      },
      {
        key: 'authors',
        query: '.top-matter a.author',
      },
      {
        key: 'content',
        queryAll: '.thing .usertext-body .md',
      },
    ]);
    const updatedData = {
      ...additionalData,
      preamble,
    };
    return updatedData;
  },
};
