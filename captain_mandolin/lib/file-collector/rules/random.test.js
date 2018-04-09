const emitter = require('../emitter');
const random = require('./random')(emitter);
const { EVENT_FILELIST_WAS_GENERATED } = require('../../types');
const getMinimalData = function() {
  let data = {
    instruction: { random: 1 },
    allFiles: [8],
    filesToAdd: [],
  };
  return data;
};

describe('Behaves like all EVENT_FILELIST_WAS_GENERATED listeners', () => {
  test('returns instruction and filesToAdd', () => {
    const obj = emitter.fileListWasGenerated();
    expect(Object.keys(obj).length).toBe(2);
    expect(obj).toHaveProperty('instruction');
    expect(obj.filesToAdd).toBeInstanceOf(Array);
  });

  test('only listens to EVENT_FILELIST_WAS_GENERATED', () => {
    const eventNames = emitter.eventNames();
    const expected = Array.of(EVENT_FILELIST_WAS_GENERATED);
    expect(eventNames).toEqual(expected);
  });
});

describe('exits early when', () => {
  test('no random rule was specified', () => {
    const expected = {
      a: 1,
      b: 2,
      instruction: { history: [2, 3] },
      allFiles: [1, 4],
    };
    const obj = emitter.fileListWasGenerated({
      instruction: expected,
    });
    expect(obj.instruction).toBe(expected);
  });

  test('filelist is empty', () => {
    const expected = { a: 1, b: 2 };
    const obj = emitter.fileListWasGenerated({
      instruction: expected,
    });
    expect(obj.instruction).toBe(expected);
  });
});

describe('Changes arguments in place', () => {
  test('adds history and howMany to instruction', () => {
    const obj = emitter.fileListWasGenerated(getMinimalData());
    expect(obj.instruction.history).toBeInstanceOf(Array);
    expect(obj.instruction.howMany).toEqual(1);
  });

  test('filesToAdd contains at least a file', () => {
    const expected = getMinimalData();
    const obj = emitter.fileListWasGenerated(expected);
    expect(obj.filesToAdd).toBeInstanceOf(Array);
    expect(obj.filesToAdd.length).toEqual(1);
    expect(obj.filesToAdd[0].src).toEqual(expected.allFiles[0]);
  });

  test('history contains src', () => {
    const obj = emitter.fileListWasGenerated(getMinimalData());
    expect(obj.instruction.history[0]).toEqual(obj.filesToAdd[0].src);
  });

  test('existing files in filesToAdd are preserved', () => {
    const instruction = { ...getMinimalData(), filesToAdd: [10, 20] };
    const expected = instruction.filesToAdd.length + 1;
    const obj = emitter.fileListWasGenerated(instruction);
    expect(obj.filesToAdd.length).toEqual(expected);
  });
});

describe('Algorithm handles different combination of files and history', () => {
  test('if history empty, history and filesToAdd will contain only same file', () => {
    const obj = emitter.fileListWasGenerated(getMinimalData());
    expect(obj.instruction.history.length).toBe(1);
    expect(obj.filesToAdd.length).toBe(1);
    expect(obj.instruction.history[0]).toEqual(obj.filesToAdd[0].src);
  });

  test('if history has files, filesToAdd will contain only files not in history', () => {
    const input = getMinimalData();
    const expected = [1, 2, 3];
    input.allFiles = [1, 2, 3, 4, 5, 6];
    input.instruction.history = Array.from(expected);
    const obj = emitter.fileListWasGenerated(input);
    const actual = obj.filesToAdd.map(fileOjb => fileOjb.src);
    expect(actual).not.toEqual(expect.arrayContaining(expected));
  });

  test('...even if howMany is greater than 1', () => {
    const input = getMinimalData();
    const expected = [1, 2, 3];
    input.allFiles = [1, 2, 3, 4, 5, 6];
    input.instruction.history = Array.from(expected);
    input.instruction.howMany = 2;
    const obj = emitter.fileListWasGenerated(input);
    const actual = obj.filesToAdd.map(fileOjb => fileOjb.src);
    expect(actual).not.toEqual(expect.arrayContaining(expected));
  });

  test('if history is full, it will be reset', () => {
    const input = getMinimalData();
    const expected = [1, 2, 3, 4, 5, 6];
    input.allFiles = Array.from(expected);
    input.instruction.history = Array.from(expected);
    const obj = emitter.fileListWasGenerated(input);
    expect(obj.filesToAdd.length).toEqual(1);
    expect(obj.instruction.history.length).toEqual(1);
  });

  test('if howMany is bigger than elegible files, it will add all elegible files plus others', () => {
    const input = getMinimalData();
    input.allFiles = [1, 2, 3, 4, 5, 6];
    input.instruction.history = [1, 2, 3, 4];
    input.instruction.howMany = 3;
    const expected = [5, 6];
    const obj = emitter.fileListWasGenerated(input);
    const actual = obj.filesToAdd.map(fileOjb => fileOjb.src);
    // the last two items are in there...
    expect(actual).toEqual(expect.arrayContaining(expected));
    // ..and then more
    expect(actual.length).toBeGreaterThan(expected.length);
    // but without duplicates
    expect(actual.length).toEqual(new Set(actual).size);
  });

  test('maxHistoryLength limits the length of history', () => {
    const input = getMinimalData();
    input.allFiles = [1, 2, 3, 4, 5, 6];
    input.instruction.history = [1, 2, 3, 4];
    input.instruction.maxHistoryLength = 2;
    const obj = emitter.fileListWasGenerated(input);
    expect(obj.instruction.history.length).toEqual(
      obj.instruction.maxHistoryLength,
    );
  });

  test('maxHistoryLength disables history', () => {
    const input = getMinimalData();
    input.allFiles = [1, 1, 1, 1, 1];
    input.instruction.maxHistoryLength = 0;
    let obj = emitter.fileListWasGenerated(input);
    expect(obj.instruction.history.length).toEqual(0);
    obj = emitter.fileListWasGenerated(input);
    expect(obj.instruction.history.length).toEqual(0);
  });
});
