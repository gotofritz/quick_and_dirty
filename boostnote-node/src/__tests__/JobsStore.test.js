const JobsStore = require('../lib/JobsStore');

describe('JobsStore', () => {
  let sut;

  it('can be instantiated', () => {
    expect(() => new JobsStore()).not.toThrow();
  });

  describe('create and read', () => {
    beforeEach(() => {
      sut = new JobsStore();
      sut.on('error', Function.prototype);
    });

    it('adds to the jobs queue', () => {
      expect(sut.all()).toHaveLength(0);
      sut.create({ a: 1, b: 2 });
      expect(sut.all()).toHaveLength(1);
    });
  });
});
