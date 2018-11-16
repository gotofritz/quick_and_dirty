const uuidv4 = require('uuid/v4');
const url = require('url');

// ensure a data object hassome data into it
module.exports.dataIsNotEmpty = obj =>
  obj && Object.keys(obj).length > 0;

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
  const defaultFn = 'return el.textContent.trim()';
  const queriesList = queries
    // only valid data
    .filter(query => query.key && query.query)
    // inserts default queries
    .concat([{ key: 'title', query: 'title' }])
    // adds processFn to those queries that don't have one
    .map(query => {
      query.processFn = query.processFn
        ? query.processFn.toString()
        : defaultFn;
      return query;
    });
  return page.evaluate(
    queriesList =>
      queriesList.reduce((accumulator, { key, query, processFn }) => {
        // this weirdness because processFn cannot be a function
        const fn = new Function('el', processFn);
        const el = document.querySelector(query);
        if (el) {
          accumulator[key] = fn(el);
        }
        return accumulator;
      }, {}),
    queriesList
  );
};

// extends the built-in url by removing www. from host and splitting
// hostname into section
const pathinfo = address => {
  const info = url.parse(address);
  info.hostname = info.hostname
    .replace(/^www\./, '')
    .toLocaleLowerCase();
  info.hostnameFragments = info.hostname.split('.');
  return info;
};
module.exports.pathinfo = pathinfo;

// returns the function that will go and fetch page data
module.exports.getPageProcessorStrategy = address => {
  const {
    hostnameFragments: [strategy]
  } = pathinfo(address);
  if (strategy in pageProcessorStrategies) {
    return pageProcessorStrategies[strategy];
  }
  console.log(`Strategy not found: ${pageProcessorStrategies}`);
  return;
};

// generates a path for a newly created file
module.exports.newNotePath = (root = '') => {
  return `${root}/${uuidv4()}.cson`;
};

// takes an array of tags ['a', 'b'], allow you to add some hardocded ones, and formats them
// in a boostnote friendly format
module.exports.consolidateTags = (tags = [], ...extraTags) =>
  tags
    .concat(extraTags)
    .map(tag => `"${tag}"`)
    .toString();

// strategy object that returns an object ready to be injected in the Mustache template
const pageProcessorStrategies = {
  github: require('./github'),
  youtube: require('./youtube')
};
