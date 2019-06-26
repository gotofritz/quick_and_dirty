const YAML = require('yaml');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const NotesStore = require('../lib/NotesStore');

describe('NotesStore', () => {
  let sut;
  let validNote;
  let incompleteNote;
  let invalidNote;
  let noteWithNoSrc;
  const PTH_PREFIX = path.join(__dirname, 'mockData');
  const NOTE_VALID = path.join(PTH_PREFIX, 'validNote.yml');
  const NOTE_INCOMPLETE = path.join(PTH_PREFIX, 'validButIncompleteNote.yml');
  const NOTE_INVALID = path.join(PTH_PREFIX, 'invalidNote.yml');
  const FOLDER_PATH = path.join(process.cwd(), '.boostnote');
  let validKeys;

  beforeAll(() => {
    let file;

    file = fs.readFileSync(NOTE_VALID, 'utf8');
    validNote = YAML.parse(file);
    validKeys = ['key'].concat(Object.keys(validNote));
    file = fs.readFileSync(NOTE_INCOMPLETE, 'utf8');
    incompleteNote = YAML.parse(file);
    file = fs.readFileSync(NOTE_INVALID, 'utf8');
    invalidNote = YAML.parse(file);
    noteWithNoSrc = Object.assign({}, validNote);
    delete noteWithNoSrc.src;
  });

  it('can be instantiated', () => {
    expect(() => new NotesStore()).not.toThrow();
  });

  describe('read', () => {
    beforeEach(() => {
      sut = new NotesStore();
      sut.on('error', Function.prototype);
    });

    it('returns an empty array if not inited', () => {
      expect(sut.read()).toEqual([]);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      sut = new NotesStore();
      sut.on('error', Function.prototype);
    });

    it('adds one record', () => {
      let noteData;
      noteData = sut.read();
      expect(noteData).toHaveLength(0);
      sut.create(validNote);
      noteData = sut.read();
      expect(noteData).toHaveLength(1);
      expect(noteData[0]).toMatchObject(validNote);
    });

    it('adds many records', () => {
      let noteData;
      noteData = sut.read();
      expect(noteData).toHaveLength(0);
      sut.create([validNote, validNote, validNote]);
      noteData = sut.read();
      expect(noteData).toHaveLength(3);
      expect(noteData[0]).toMatchObject(validNote);
    });

    it('adds an extra key field when creating a record', () => {
      let noteData;
      sut.create(validNote);
      noteData = sut.read();
      expect(noteData[0]).not.toEqual(validNote);
      expect(noteData[0]).toMatchObject(validNote);
      expect(validNote).not.toHaveProperty('key');
      expect(noteData[0]).toHaveProperty('key');
    });

    it('makes sure the keys when creating many fields are different', () => {
      let noteData;
      sut.create([validNote, validNote, validNote]);
      noteData = sut.read();
      expect(noteData[0].key).not.toEqual(noteData[1].key);
      expect(noteData[1].key).not.toEqual(noteData[2].key);
    });

    it('does not break when called with no arguments', () => {
      expect(sut.create).not.toThrow();
      sut.create();
      expect(sut.read()).toHaveLength(0);
    });

    it('returns a key as a string when adding a single record', () => {
      const key = sut.create(validNote);
      expect(key).toMatch(/^[a-z0-9-]+$/);
      const noteData = sut.read()[0];
      expect(noteData.key).toEqual(key);
    });

    it('returns an array of keys when adding multiple records', () => {
      const keys = sut.create([validNote, validNote, validNote]);
      expect(keys).toBeInstanceOf(Array);
      keys.forEach((key, i) => {
        expect(key).toMatch(/^[a-z0-9-]+$/);
        const noteData = sut.read()[i];
        expect(noteData.key).toEqual(key);
      });
    });

    it('creates all needed fields if not passed', () => {
      expect(Object.keys(incompleteNote)).not.toEqual(Object.keys(validNote));
      sut.create(incompleteNote);
      let noteData = sut.read()[0];
      expect(noteData).toContainAllKeys(validKeys);
    });

    it("doesn't add disallowed fields", () => {
      // toMatchObject works the opposite of one may think.
      // expect(SET).toMatchObject(SUBSET)
      // i.e. the object with more field is the first one
      expect(invalidNote).toMatchObject(validNote);
      expect(validNote).not.toMatchObject(invalidNote);
      sut.create(invalidNote);
      let insertedNote = sut.read()[0];
      expect(insertedNote).toContainAllKeys(validKeys);
    });

    it('does not add note if it lacks src field', () => {
      let actual = sut.read();
      expect(actual).toHaveLength(0);
      sut.create(noteWithNoSrc);
      actual = sut.read();
      expect(actual).toHaveLength(0);
    });

    it('emits error event if a record is not insertable', done => {
      sut.off('error', Function.prototype).on('error', err => {
        expect(err).toBeDefined();
        done();
      });
      sut.create(noteWithNoSrc);
    });
  });

  describe('logs', () => {
    beforeEach(() => {
      rimraf.sync(path.join(FOLDER_PATH, '*'));
      const logFiles = fs.readdirSync(FOLDER_PATH);
      expect(logFiles).toHaveLength(0);
      sut = new NotesStore();
    });

    // Rimraf doesn't run suncrhonously in hustky, so this will fail

    // it('to a file', () => {
    //   sut.create([validNote, validNote, validNote]);
    //   // const expected = YAML.parse(validNote);
    //   const noteData = sut.read();
    //   expect(noteData).toHaveLength(3);
    //   sut.log();

    //   const key = 0;
    //   const logFiles = fs.readdirSync(FOLDER_PATH);
    //   const fileContents = fs.readFileSync(
    //     path.join(FOLDER_PATH, logFiles[key]),
    //     'utf8',
    //   );
    //   const notes = YAML.parse(fileContents);
    //   console.log('-------------------------', notes);
    //   expect(Object.keys(notes)).toHaveLength(3);
    //   Object.keys(notes).forEach(k => {
    //     expect(notes[k]).toMatchObject(validNote);
    //   });
    // });
  });
});
