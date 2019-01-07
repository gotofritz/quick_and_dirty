const {
  consolidateTags,
  getDataFromPage,
  getImage,
  markdownImageFromPath,
} = require('./lib');
const url = require('url');

const generateImagePath = pth => {
  const parts = url
    .parse(pth)
    .path.substr(1)
    .split('/');
  return `https://codepen.io/${parts[0]}/pen/${parts[2]}/image/small.png`;
};

module.exports = {
  consolidateTags: consolidateTags.bind(null, 'do.visual'),
  rewriteUrl: pth => {
    const parts = url
      .parse(pth)
      .path.substr(1)
      .split('/')
      .slice(0, 3);
    parts[1] = 'details';
    return 'https://codepen.io/' + parts.join('/');
  },
  fetchData: async ({ page, noteData }) => {
    const physicalImg = await getImage({
      imageUrl: generateImagePath(noteData.src),
      noteAddress: noteData.noteAddress,
    });
    let additionalData = await getDataFromPage(page, [
      { key: 'title', query: '.pen-title-link' },
      {
        key: 'created',
        query: '[datetime]',
        attr: 'datetime',
      },
      {
        key: 'authors',
        query: '.pen-owner-name',
      },
      {
        key: 'content',
        query: '.pen-description',
        processFn: `const filtered = [...el.children];
      return filtered.reduce((accumulator, current) =>
        accumulator + '\\n\\n' + current.outerHTML.trim().replace(/\\n\\s+/g, '\\n'),
        ''
      );`,
      },
    ]);
    const updatedData = {
      ...noteData,
      ...additionalData,
      preamble: markdownImageFromPath(physicalImg),
    };
    return updatedData;
  },
};
