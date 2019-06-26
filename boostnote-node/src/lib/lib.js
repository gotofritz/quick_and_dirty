const uuidv4 = require('uuid/v4');
const urlParser = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('request');
const YAML = require('yaml');
const mkdirp = require('mkdirp');

const { PATH_BOOSTNOTE, FOLDER_KEY } = require('./const');
const Instruction = require('./Instruction');
const { CMD_CREATE, CMD_FETCH_FROM_PAGE } = require('./commands');

// create an image filename the way boostnote does it
module.exports.imagePaths = (
  root,
  noteAddress,
  imageFile = crypto.randomBytes(10).toString('hex') + '.png',
) => {
  // :storage/0e07f996-6728-48ad-9699-fa15934f92a1/d2bda7dc.png
  return {
    physical: `${root}/attachments/${noteAddress}/${imageFile}`,
    source: `:storage/${noteAddress}/${imageFile}`,
  };
};

module.exports.logsPath = suffix => {
  if (suffix) {
    return path.join(
      process.cwd(),
      '.boostnote',
      new Date().toISOString().replace(/\W/g, '') + `-${suffix}.yml`,
    );
  }
  return path.join(process.cwd(), '.boostnote');
};

module.exports.markdownImageFromPath = destPath => {
  const parts = destPath
    .split('/')
    .slice(-2)
    .join('/');
  return `![img.png](:storage/${parts})`;
};

const downloadImgPath = ({
  noteAddress,
  imageFileName = crypto.randomBytes(10).toString('hex') + '.png',
}) => {
  imageFileName = imageFileName.replace(/\?.*$/, '');
  return `${PATH_BOOSTNOTE}/attachments/${noteAddress}/${imageFileName}`;
};

module.exports.getImage = ({ imageUrl, noteAddress }) => {
  const imageFileName = path.basename(imageUrl);
  const destPath = downloadImgPath({ imageFileName, noteAddress });
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return new Promise((resolve, reject) =>
    request
      .get(imageUrl)
      .on('error', function(err) {
        reject(err);
      })
      .pipe(fs.createWriteStream(destPath))
      .on('finish', () => {
        return resolve(destPath);
      }),
  );
};

module.exports.dumpInstructionsToFile = (instructions, filePath) => {
  if (!filePath) return;
  if (instructions.length === 0) return;

  createLogsDirIfNeeded(filePath);
  const instructionsAsYAML = YAML.stringify(instructions);
  fs.writeFileSync(filePath, instructionsAsYAML, 'utf8');
};

// ensure a data object hassome data into it
module.exports.dataIsNotEmpty = obj => obj && Object.keys(obj).length > 0;

// allow you to extract data from page, by providing an array of queries
// [{ key: key1, query: query1, processFn: .. },
//  { key: key2, query: query2 }, ...
//  ]
// processFn is the body of a function as a string (that's the only way
// we can pass it to the page in puppeteer...)
// it will transform the found element (default: textContent.trim())
// This function will return an object { key1: data1, key2: data2 }
// it provides a few built in queries: title
module.exports.getDataFromPage = (page, queries = []) => {
  // RADAR
  // (this part is growing in complexity and should become more elaborate).
  // There are different functions that we can apply to a node on the page
  // to extract data from it.
  // - if query contains 'processFn', a function, that will be used
  // - if query contains 'attr', a string, an attribute of that name
  // - otherwise just return the textContent of the node
  const getTextContent = 'return el.textContent.trim()';
  const getAttr = attr => `return el.getAttribute("${attr}")`;

  const queriesList = queries
    // only valid data
    .filter(query => query.key)
    // inserts default queries
    .concat([{ key: 'title', query: 'title' }])
    // adds processFn to those queries that don't have one
    .map(query => {
      query.processFn = query.processFn
        ? // ugly hack to extract the body of a function to them pass it on
          // Because there is no easy way to pass functions to pageEValuate
          query.processFn
            .toString()
            .replace(/^[^{]+\{(.+)\}\s*$/s, '$1')
            .trim()
        : query.attr
        ? getAttr(query.attr)
        : getTextContent;
      if (query.query) {
        query.query = [].concat(query.query);
      }
      return query;
    });
  return page.evaluate(
    queriesList =>
      // reduceRight because the default "key: 'title'" was concat at the end
      // of the queries, so if you passed your own "key: title" it would
      // be overwritten.
      queriesList.reduceRight(
        (accumulator, { key, query = [], queryAll, processFn }) => {
          // this weirdness because processFn cannot be a function
          const fn = new Function('el', processFn);
          if (query.length > 0) {
            // if we find too many nodes we store one - in case we find no single one
            let found;
            for (let i = 0; i < query.length; i++) {
              const els = document.querySelectorAll(query);
              if (els.length === 1) {
                found = els[0];
                break;
              }
              if (!found && els.length > 0) {
                found = els[0];
              }
            }
            if (found) {
              accumulator[key] = fn(found);
            }
          } else if (queryAll) {
            const els = document.querySelectorAll(queryAll);
            if (els.length) {
              accumulator[key] = [...els].reduce(
                (acc, curr) => acc + '<hr>\n\n' + curr.innerHTML,
                '',
              );
            }
          }
          return accumulator;
        },
        {},
      ),
    queriesList,
  );
};

// extends the built-in url by removing www. from host and splitting
// hostname into section
const pathinfo = url => {
  const info = urlParser.parse(url);
  info.hostname = info.hostname.replace(/^www\./, '').toLocaleLowerCase();
  info.hostnameFragments = info.hostname.split('.');
  return info;
};
module.exports.pathinfo = pathinfo;

// returns the function that will go and fetch page data
module.exports.getPageProcessorStrategy = address => {
  const DEFAULT_STRATEGY = 'generic';
  // extracts 'youtube' from a youtube url, etc
  let {
    hostnameFragments: [strategy],
  } = pathinfo(address);
  if (!pageProcessorStrategies[strategy]) {
    strategy = DEFAULT_STRATEGY;
  }
  return {
    rewriteUrl: x => x,
    consolidateTags,
    ...pageProcessorStrategies[strategy],
  };
};

// generates a path for a newly created file
module.exports.newNoteAddress = () => uuidv4();

// generates a path for a newly created file
module.exports.newNotePath = (filename = '') => {
  return `${PATH_BOOSTNOTE}/notes/${filename}.cson`;
};

module.exports.generateQueue = rawInstructions => {
  const queue = rawInstructions.reduce(
    (accumulator, { key = uuidv4(), src, tags }) => {
      let pageProcessor = module.exports.getPageProcessorStrategy(src);
      src = pageProcessor.rewriteUrl(src);

      let noteData = {
        folder: FOLDER_KEY,
        src,
        tags: pageProcessor.consolidateTags(tags),
        updated: new Date().toISOString(),
        key,
      };

      accumulator.push(new Instruction(CMD_CREATE, noteData));
      accumulator.push(
        new Instruction(CMD_FETCH_FROM_PAGE, {
          key,
          src,
          processor: pageProcessor.fetchData,
        }),
      );
      return accumulator;
    },
    [],
  );
  return queue;
};

module.exports.cleanseUrl = url => {
  if (url.substr(-1) === '/') {
    url = url.replace(/\/$/, '');
  }
  return url;
};

// takes an array of tags ['a', 'b'], allow you to add some hardocded ones, and formats them
// in a boostnote friendly format
const consolidateTags = (...tags) =>
  tags
    // make sure comma separate strings are turned into arrays
    .reduce((accumulator, current) => {
      if (current) {
        return accumulator.concat(current);
      }
      return accumulator;
    }, [])
    .map(tag => `"${tag}"`)
    .toString();
module.exports.consolidateTags = consolidateTags;

module.exports.cleanPageContent = (contentString = '') =>
  contentString
    .replace(/\n\s+\n/g, '')
    .replace(/\n\{3,}/g, '\n\n')
    .trim();

// strategy object that returns an object ready to be injected in the Mustache template
const pageProcessorStrategies = {
  github: require('./github'),
  youtube: require('./youtube'),
  generic: require('./generic'),
  codepen: require('./codepen'),
  reddit: require('./reddit'),
};

function createLogsDirIfNeeded(filePath) {
  if (!filePath) return;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir);
  }
}
