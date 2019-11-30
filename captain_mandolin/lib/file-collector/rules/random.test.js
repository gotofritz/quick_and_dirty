const emitter = require('../emitter');
const { EVENT_FILELIST_WAS_GENERATED } = require('../../types');
const getMinimalData = function() {
  let data = {
    instruction: { random: 1 },
    allFiles: [8],
    filesToAdd: [],
  };
  return data;
};
const getDataWithFilegroups = function() {
  let data = {
    instruction: { random: 1 },
    allFiles: [[8, 18, 28]],
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

describe.skip('Algorithm handles different combination of files and history', () => {});

describe('handles filegroups', () => {
  test('history contains only first item of filegroup', () => {
    const obj = emitter.fileListWasGenerated(getDataWithFilegroups());
    expect(obj.instruction.history[0]).not.toBeInstanceOf(Array);
  });

  test('history contains src', () => {
    const obj = emitter.fileListWasGenerated(getDataWithFilegroups());
    expect(obj.instruction.history[0]).toEqual(obj.filesToAdd[0].src[0]);
  });

  test('if history empty, history and filesToAdd will contain only same file', () => {
    const obj = emitter.fileListWasGenerated(getDataWithFilegroups());
    expect(obj.instruction.history.length).toBe(1);
    expect(obj.filesToAdd.length).toBe(1);
    expect(obj.instruction.history[0]).toEqual(obj.filesToAdd[0].src[0]);
  });

  test('if history has files, filesToAdd will contain only files not in history', () => {
    const input = getDataWithFilegroups();
    const history = [8, 2, 3];
    input.allFiles = [[8, 18, 28], 2, 3, 4];
    input.instruction.history = Array.from(history);
    const obj = emitter.fileListWasGenerated(input);
    const actual = obj.filesToAdd.map(fileOjb => fileOjb.src);
    actual.forEach(file => {
      file = Array.isArray(file) ? file[0] : file;
      expect(history).not.toContain(file);
    });
  });

  test('if history is full, it will be reset', () => {
    const input = getDataWithFilegroups();
    const expected = [[8, 18, 28], 2, 3, 4, 5, 6];
    input.allFiles = Array.from(expected);
    input.instruction.history = expected.map(file =>
      Array.isArray(file) ? file[0] : file,
    );
    const obj = emitter.fileListWasGenerated(input);
    expect(obj.filesToAdd.length).toEqual(1);
    expect(obj.instruction.history.length).toEqual(1);
  });
});
