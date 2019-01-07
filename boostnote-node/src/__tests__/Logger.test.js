const Logger = require('../lib/Logger');

describe('Logger', () => {
  let sut;
  let spies = {};
  const LOG_MESSAGE = 'just a log message';
  const ERROR_MESSAGE = 'here is an error message';

  beforeEach(() => {
    spies.log = jest.spyOn(global.console, 'log').mockImplementation(() => {});
    spies.error = jest
      .spyOn(global.console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    Object.values(spies).forEach(spy => spy.mockRestore());
  });

  it('can be instantiated', () => {
    expect(() => new Logger()).not.toThrow();
  });

  describe('when verbose', () => {
    beforeEach(() => {
      sut = new Logger({ verbose: true });
    });

    it('logs', () => {
      sut.log(LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(LOG_MESSAGE);
    });

    it('logs all arguments', () => {
      sut.log(LOG_MESSAGE, ERROR_MESSAGE, LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(
        LOG_MESSAGE,
        ERROR_MESSAGE,
        LOG_MESSAGE,
      );
    });

    it('errors', () => {
      sut.error(ERROR_MESSAGE);
      expect(spies.error).toHaveBeenCalledWith(ERROR_MESSAGE);
    });

    it('errors all arguments', () => {
      sut.error(LOG_MESSAGE, ERROR_MESSAGE, LOG_MESSAGE);
      expect(spies.error).toHaveBeenCalledWith(
        LOG_MESSAGE,
        ERROR_MESSAGE,
        LOG_MESSAGE,
      );
    });

    it('prints divider', () => {
      sut.divider();
      expect(spies.log).toHaveBeenCalled();
      expect(spies.log.mock.calls[0][0]).toMatch(/^-{4,}$/);
    });
  });

  describe('when not verbose', () => {
    beforeEach(() => {
      sut = new Logger({ verbose: false });
    });

    it('does not log', () => {
      sut.log(LOG_MESSAGE);
      expect(spies.log).not.toHaveBeenCalled();
    });

    it('errors', () => {
      sut.error(ERROR_MESSAGE);
      expect(spies.error).toHaveBeenCalledWith(ERROR_MESSAGE);
    });

    it('does not print divider', () => {
      sut.divider();
      expect(spies.log).not.toHaveBeenCalled();
    });
  });

  describe('when quiet', () => {
    beforeEach(() => {
      sut = new Logger({ quiet: true, verbose: Math.random() > 0.5 });
    });

    it('does not log', () => {
      sut.log(LOG_MESSAGE);
      expect(spies.log).not.toHaveBeenCalled();
    });

    it('does not error', () => {
      sut.error(ERROR_MESSAGE);
      expect(spies.error).not.toHaveBeenCalled();
    });

    it('does not print divider', () => {
      sut.divider();
      expect(spies.log).not.toHaveBeenCalled();
    });
  });
});
