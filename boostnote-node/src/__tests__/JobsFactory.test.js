const path = require('path');
const JobsFactory = require('../lib/JobsFactory');

describe('JobsFactory', () => {
  let sut;

  it('can be instantiated', () => {
    expect(() => new JobsFactory()).not.toThrow();
  });

  describe('loads routes', () => {
    beforeEach(() => {
      sut = new JobsFactory({
        routesPath: path.join(__dirname, 'mockData', 'routes'),
      });
      sut.on('error', Function.prototype);
    });

    it("doesn't add to jobs queue if no src", () => {
      const jobs = sut.generateJobs({
        tags: [],
        key: '123-123',
      });
      expect(jobs).toBeArray();
      expect(jobs).toHaveLength(0);
    });

    it('adds to the jobs queue', () => {
      const jobs = sut.generateJobs({
        src: 'anything',
        tags: [],
        key: '123-123',
      });
      expect(jobs).toBeArray();
      expect(jobs[0]).toBeObject();
    });
  });
});
