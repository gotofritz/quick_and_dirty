const path = require('path');
const YAML = require('yaml');
const fs = require('fs');
const rimraf = require('rimraf');

const InstructionsStore = require('../lib/InstructionsStore');

describe('InstructionsStore', () => {
  let sut;
  const PTH_PREFIX = path.join(__dirname, 'mockData');
  const URL_EMPTY = path.join(PTH_PREFIX, 'urlsEmpty.yml');
  const URL_SINGLE = path.join(PTH_PREFIX, 'urlsSingle.yml');
  const URL_MANY = path.join(PTH_PREFIX, 'urls.yml');
  const URL_FEW = path.join(PTH_PREFIX, 'urlsAFew.yml');
  const FOLDER_PATH = path.join(process.cwd(), '.boostnote');

  it('can be instantiated', () => {
    expect(() => new InstructionsStore()).not.toThrow();
  });

  describe('handles edge cases', () => {
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
      expect(sut.all()).toHaveLength(1);
    });
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
      const file = fs.readFileSync(URL_MANY, 'utf8');
      const rawInstructions = YAML.parse(file);
      const extraInstructions = rawInstructions.reduce(
        (accumulator, current) => {
          if (!current.src) return accumulator - 1;
          if (!Array.isArray(current.src)) return accumulator;
          return accumulator + current.src.length - 1;
        },
        0,
      );
      expect(instructions).toHaveLength(
        rawInstructions.length + extraInstructions,
      );
    });

    it("runs a url cleaning function on each instructions's src", () => {
      sut = new InstructionsStore({
        pth: URL_MANY,
        srcCleaner: src => src.substr(0, 5).replace(/./g, '*'),
      }).load();
      const instructions = sut.all();
      expect(
        instructions.every(instruction => instruction.src === '*****'),
      ).toBeTrue();
    });
  });

  describe('writes YAML files', () => {
    beforeEach(() => {
      rimraf.sync(FOLDER_PATH);
    });

    it("to a folder that is created if it doesn't esist", () => {
      expect(fs.existsSync(FOLDER_PATH)).toBeFalse();
      sut = new InstructionsStore({
        pth: URL_MANY,
      }).load();
      expect(fs.existsSync(FOLDER_PATH)).toBeTrue();
    });

    it("with filename which starts with today's timestamp", () => {
      sut = new InstructionsStore({
        pth: URL_MANY,
      }).load();
      const logFiles = fs.readdirSync(FOLDER_PATH);
      expect(logFiles).toHaveLength(1);

      // filename is something like "20190109T212517606Z-log.yml"
      // i.e., a ISO date with all the punctuation removed
      const actual = path.basename(logFiles[0], '.yml');
      const [, y, m, d, h, min, s, mil, z] = actual.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})([A-Z])-/,
      );
      const logDate = new Date(y, m, d, h, min, s, mil, z);
      expect(logDate).toBeValidDate();
      expect(logDate).toBeAfter(
        new Date().setMinutes(new Date().getMinutes() - 5),
      );
    });
  });

  describe('iterates through instructions', () => {
    beforeEach(
      () =>
        (sut = new InstructionsStore({
          pth: URL_FEW,
        }).load()),
    );

    it('has a forEach method that takes a callback', () => {
      const mockCallback = jest.fn();
      const soManyInstructions = 4;
      sut.forEach(mockCallback);
      expect(mockCallback.mock.calls).toHaveLength(soManyInstructions);
      for (let i = 0; i < soManyInstructions; i++) {
        expect(mockCallback.mock.calls[i][1]).toBe(i);
      }
      for (let i = 0; i < soManyInstructions; i++) {
        expect(mockCallback.mock.calls[i][0]).toContainKeys(['src', 'tags']);
      }
    });

    it('updates actual instruction', () => {
      const callback = instruction => (instruction.guitar = 'john');
      sut.forEach(callback);
      expect(
        sut.all().every(instruction => instruction.guitar === 'john'),
      ).toBeTrue();
    });
  });

  describe('reads and updates', () => {
    beforeEach(() => {
      rimraf.sync(FOLDER_PATH);
      sut = new InstructionsStore({
        pth: URL_FEW,
      }).load();
    });

    it("doesn't do anything if no arguments passed", () => {
      const original = sut.all();
      sut.update();
      expect(sut.all()).toEqual(original);
      sut.update(0);
      expect(sut.all()).toEqual(original);
      sut.update(0, {});
      expect(sut.all()).toEqual(original);
    });

    it("doesn't do anything if number is a digit outside of range", () => {
      const original = sut.all();
      sut.update(12, { key: 123 });
      expect(sut.all()).toEqual(original);
      expect(sut.one(12)).toBeUndefined();
    });

    it('updates a field with a value', () => {
      const key = 0;
      const original = Object.keys(sut.one(key));
      expect(sut.one(key)).not.toContainKey('key');
      sut.update(0, { key: 123 });
      expect(sut.one(key)).toContainKeys(original);
      expect(sut.one(key)).toContainKey('key');
    });

    it('updates a field with many values', () => {
      const key = 0;
      const fields = { guitar: 'john', drums: 'ringo' };
      const newKeys = Object.keys(fields);
      const original = Object.keys(sut.one(key));
      expect(sut.one(key)).not.toContainKeys(newKeys);
      sut.update(0, fields);
      expect(sut.one(key)).toContainKeys(original);
      expect(sut.one(key)).toContainKeys(newKeys);
      for (let i = 1; i <= 3; i++) {
        expect(sut.one(key + i)).not.toContainKeys(['guitar', 'drums']);
      }
    });

    it('logs when it updates', () => {
      const key = 0;
      const fields = { guitar: 'john', drums: 'ringo' };
      const newKeys = Object.keys(fields);
      sut.update(0, fields);

      const logFiles = fs.readdirSync(FOLDER_PATH);
      expect(logFiles).toHaveLength(1);
      const file = fs.readFileSync(path.join(FOLDER_PATH, logFiles[0]), 'utf8');
      const rawInstructions = YAML.parse(file);
      expect(rawInstructions[key]).toContainKeys(newKeys);
      for (let i = 1; i <= 3; i++) {
        expect(rawInstructions[key + i]).not.toContainKeys(['guitar', 'drums']);
      }
    });
  });
});
