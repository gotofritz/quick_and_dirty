const path = require('path');
const YAML = require('yaml');

const InstructionsStore = require('../lib/InstructionsStore');

describe('InstructionsStore', () => {
  let sut;
  const PTH_PREFIX = path.join(__dirname, 'mockData');
  const URL_EMPTY = path.join(PTH_PREFIX, 'urlsEmpty.yml');
  const URL_SINGLE = path.join(PTH_PREFIX, 'urlsSingle.yml');
  const URL_MANY = path.join(PTH_PREFIX, 'urls.yml');

  it('can be instantiated', () => {
    expect(() => new InstructionsStore()).not.toThrow();
  });

  it('returns an empty array if no config was loaded', () => {
    sut = new InstructionsStore().load();
    expect(sut.all()).toEqual([]);
  });

  it('returns a copy of the array, not a reference to the original', () => {
    sut = new InstructionsStore();
    const returned = sut.all();
    returned.push(14);
    expect(sut.all()).not.toEqual(returned);
  });

  it("emits an error object if it can't open config file", done => {
    sut = new InstructionsStore({ pth: 'this does not exist' });
    sut.on('error', err => {
      expect(err).toBeDefined();
      done();
    });
    sut.load();
  });

  it('can load empty files', () => {
    sut = new InstructionsStore({
      pth: URL_EMPTY,
    }).load();
    expect(sut.all()).toEqual([]);
  });

  it('emits if YAML is invalid', done => {
    sut = new InstructionsStore({
      pth: path.join(PTH_PREFIX, 'badYAML.yml'),
    });
    sut.on('error', err => {
      expect(err).toBeDefined();
      done();
    });
    sut.load();
  });

  it('can load a file with a single url', () => {
    sut = new InstructionsStore({
      pth: URL_SINGLE,
    }).load();
    expect(sut.all().length).toEqual(1);
  });

  describe('loads a list of instructions', () => {
    beforeEach(
      () =>
        (sut = new InstructionsStore({
          pth: URL_MANY,
        }).load()),
    );

    it('with only instructions that have a src', () => {
      const instructions = sut.all();
      expect(
        instructions.every(instruction => 'src' in instruction),
      ).toBeTruthy();
    });

    it('with each instruction having a an array of tags', () => {
      const instructions = sut.all();
      expect(
        instructions.every(
          instruction =>
            'tags' in instruction && Array.isArray(instruction.tags),
        ),
      ).toBeTruthy();
    });

    it('with arrays of srcs resolved into individual strings', () => {
      const instructions = sut.all();
      expect(
        instructions.every(instruction => !Array.isArray(instruction.src)),
      ).toBeTruthy();
      const file = require('fs').readFileSync(URL_MANY, 'utf8');
      const rawInstructions = YAML.parse(file);
      const extraInstructions = rawInstructions.reduce(
        (accumulator, current) => {
          if (!current.src) return accumulator - 1;
          if (!Array.isArray(current.src)) return accumulator;
          return accumulator + current.src.length - 1;
        },
        0,
      );
      expect(instructions.length).toEqual(
        rawInstructions.length + extraInstructions,
      );
    });
  });

  it("runs a url cleaning function on each instructions's src", () => {
    sut = new InstructionsStore({
      pth: URL_MANY,
      srcCleaner: src => src.substr(0, 5).replace(/./g, '*'),
    }).load();
    const instructions = sut.all();
    expect(instructions.every(instruction => instruction.src === '*****'));
  });
});
