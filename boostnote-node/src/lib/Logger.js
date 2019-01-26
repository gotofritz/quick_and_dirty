/* eslint-disable no-console */

/**
 * Logger simple logger that logs and errors depending values of a quiet and
 * verbose flag
 */
class Logger {
  constructor({ verbose = false, quiet = false, dryRun = false } = {}) {
    this.verbose = verbose;
    this.quiet = quiet;
    this.doDryRun = dryRun;
  }

  dryRun(...args) {
    if (!this.quiet && this.doDryRun) {
      console.log(...args);
    }
  }

  log(...args) {
    if (!this.quiet) {
      console.log(...args);
    }
  }

  info(...args) {
    if (!this.quiet && this.verbose) {
      console.info(...args);
    }
  }

  error(...args) {
    if (!this.quiet) {
      console.error(...args);
    }
  }

  divider() {
    if (!this.quiet && this.verbose) {
      console.log('-'.repeat(62));
    }
  }
}

module.exports = Logger;
