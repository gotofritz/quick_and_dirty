const { consolidateTags } = require('./lib');

// one section of the YT data
const getYtplayerData = page =>
  page.evaluate(() =>
    window.ytplayer && window.ytplayer.config
      ? window.ytplayer.config.args
      : null
  );

// another section of the YT data
const getYtInitialData = page =>
  page.evaluate(
    () =>
      window.ytInitialData.contents.twoColumnWatchNextResults.results
        .results.contents[1].videoSecondaryInfoRenderer
  );

// the actual page manipulating function
module.exports = async ({ page, noteData }) => {
  const { url, tags } = noteData;
  let additionalData = await getYtplayerData(page);

  noteData.tags = consolidateTags(tags, 'screencast');
  noteData.title = additionalData.title;
  noteData.authors = additionalData.author;
  noteData.preamble = `<iframe width="560" height="315" src="${url.replace(
    /watch\?v=/,
    'embed/'
  )}" frameborder="0" allowfullscreen></iframe>`;

  additionalData = await getYtInitialData(page);
  let [, d, m, y] =
    additionalData.dateText.simpleText.match(
      /(\d\d)\.(\d\d)\.(\d\d\d\d)/
    ) || [];
  if (d && m && y) {
    noteData.created = new Date(y, Number(m) - 1, d).toISOString();
  } else {
    noteData.created = noteData.updated;
  }

  noteData.content = additionalData.description.runs
    ? additionalData.description.runs.reduce((accumulator, current) => {
        const text = current.text;
        if (/^http/.test(text)) {
          return accumulator + `[${text}](${text})`;
        }
        return accumulator + text;
      }, '')
    : '';

  return noteData;
};