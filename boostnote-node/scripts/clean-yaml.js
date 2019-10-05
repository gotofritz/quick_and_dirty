#! /usr/bin/env node
const YAML = require('yaml');
const fs = require('fs');

const SRC = '/Users/fritz/Dropbox/_TRANSFER/URLS.yml';
const TRGT = './URLS.yml';

const srcContents = fs.readFileSync(SRC, 'utf8');
if (srcContents.trim() === '') {
  console.log('EMPTY FILE');
  process.exit(1);
}
const rawInstructions = YAML.parse(srcContents);
const compressedBlocks = rawInstructions.reduce((soFar, next) => {
  const { tags, src } = normaliseBlock(next);
  soFar[tags] = (soFar[tags] || []).concat(src);
  return soFar;
}, {});
const cleanedInstructions = Object.entries(compressedBlocks)
  .sort(([aKeys, aValues], [bKeys, bValues]) => (aKeys < bKeys ? -1 : 1))
  .map(([tags, src]) => ({ tags, src }));
console.log(rawInstructions[0]);
console.log(rawInstructions[1]);
console.log('---------------------');
console.log(cleanedInstructions[0]);
console.log(cleanedInstructions[1]);

const trgtContents = YAML.stringify(cleanedInstructions);
// const trgtContents = JSON.stringify(compressedBlocks, null, 2);
fs.writeFileSync(TRGT, trgtContents, 'utf8');
console.log('DONE');
process.exit(0);

function normaliseBlock(block) {
  const tagsMap = {
    blockchain: 'b',
    node: 'n.',
  };
  const { src } = block;
  let tagsArray = Array.isArray(block.tags)
    ? block.tags
    : (block.tags || '').split(/, */);
  tagsArray = tagsArray.map(tag => {
    tag = tag.toLowerCase();
    return tagsMap[tag] || tag;
  });
  tagsArray.sort();
  const tags = tagsArray.join(', ');
  return {
    src,
    tags,
  };
}
