const Logger = require('../lib/Logger');

describe('Logger', () => {
  let sut;
  let spies = {};
  const LOG_MESSAGE = 'just a log message';
  const ERROR_MESSAGE = 'here is an error message';
  const INFO_MESSAGE = 'and finally an info message';

  beforeEach(() => {
    spies.log = jest.spyOn(global.console, 'log').mockImplementation(() => {});
    spies.info = jest
      .spyOn(global.console, 'info')
      .mockImplementation(() => {});
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
      sut = new Logger({ verbose: true, dryRun: Math.random() > 0.5 });
    });

    it('logs', () => {
      sut.log(LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(LOG_MESSAGE);
    });

    it('logs all arguments', () => {
      sut.log(INFO_MESSAGE, ERROR_MESSAGE, LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(
        INFO_MESSAGE,
        ERROR_MESSAGE,
        LOG_MESSAGE,
      );
    });

    it('infos', () => {
      sut.info(INFO_MESSAGE);
      expect(spies.info).toHaveBeenCalledWith(INFO_MESSAGE);
    });

    it('infos all arguments', () => {
      sut.info(INFO_MESSAGE, ERROR_MESSAGE, LOG_MESSAGE);
      expect(spies.info).toHaveBeenCalledWith(
        INFO_MESSAGE,
        ERROR_MESSAGE,
        LOG_MESSAGE,
      );
    });

    it('errors', () => {
      sut.error(ERROR_MESSAGE);
      expect(spies.error).toHaveBeenCalledWith(ERROR_MESSAGE);
    });

    it('errors all arguments', () => {
      sut.error(LOG_MESSAGE, ERROR_MESSAGE, INFO_MESSAGE);
      expect(spies.error).toHaveBeenCalledWith(
        LOG_MESSAGE,
        ERROR_MESSAGE,
        INFO_MESSAGE,
      );
    });

    it('prints divider', () => {
      sut.divider();
      expect(spies.log).toHaveBeenCalled();
      expect(spies.log.mock.calls[0][0]).toMatch(/^-{4,}$/);
    });
  });

  describe('when dryRun', () => {
    beforeEach(() => {
      sut = new Logger({ verbose: Math.random() > 0.5, dryRun: true });
    });

    it('dryRuns', () => {
      sut.dryRun(LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(LOG_MESSAGE);
    });

    it('dryRun all arguments', () => {
      sut.dryRun(INFO_MESSAGE, ERROR_MESSAGE, LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(
        INFO_MESSAGE,
        ERROR_MESSAGE,
        LOG_MESSAGE,
      );
    });
  });

  describe('when not verbose', () => {
    beforeEach(() => {
      sut = new Logger({ verbose: false, dryRun: Math.random() > 0.5 });
    });

    it('does not info', () => {
      sut.info(INFO_MESSAGE);
      expect(spies.info).not.toHaveBeenCalled();
    });

    it('logs', () => {
      sut.log(LOG_MESSAGE);
      expect(spies.log).toHaveBeenCalledWith(LOG_MESSAGE);
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
      sut = new Logger({
        quiet: true,
        verbose: Math.random() > 0.5,
        dryRun: true,
      });
    });

    it('does not info', () => {
      sut.info(INFO_MESSAGE);
      expect(spies.info).not.toHaveBeenCalled();
    });

    it('does not dryRun', () => {
      sut.dryRun(INFO_MESSAGE);
      expect(spies.info).not.toHaveBeenCalled();
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
