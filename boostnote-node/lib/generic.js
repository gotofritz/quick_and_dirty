const { getDataFromPage } = require('./lib');

module.exports = {
  fetchData: async ({ page, noteData }) => {
    let additionalData = await getDataFromPage(page, [
      { key: 'title', query: ['#main-title h1', 'h1'] },
      {
        key: 'created',
        query: ['[itemprop="dateModified"]', '.published-at'],
      },
      {
        key: 'created',
        query: ['.article__date', '[datetime]'],
        attr: 'datetime',
      },
      {
        key: 'authors',
        query: [
          '.author__desc__image-placeholder',
          '.author [itemprop="name"]',
          '.author-card-name',
        ],
        // that goes with .author__desc__image
        // attr: 'data-alt',
      },
      {
        key: 'preamble',
        query: '.article__summary',
      },
      {
        key: 'content',
        query: ['.article__content > div', '#article-body', '.post-content'],
        processFn: `const filtered = [...el.children].filter(
        chld =>
          !['header', 'aside', 'div'].includes(chld.tagName.toLowerCase()) &&
          !chld.classList.contains('author') &&
          !chld.classList.contains('c-promo-box') &&
          !chld.classList.contains('books__book__meta') &&
          !chld.classList.contains('article__summary')
      );
      return filtered.reduce((accumulator, current) =>
        accumulator + '\\n\\n' + current.outerHTML.trim().replace(/\\n\\s+/g, '\\n'),
        ''
      );`,
      },
    ]);
    const updatedData = {
      ...noteData,
      ...additionalData,
    };
    return updatedData;
  },
};
