const EventEmitter = require('events');

class JobsStore extends EventEmitter {
  constructor() {
    super();
    this.jobs = [];
  }

  all() {
    return this.jobs.slice(0);
  }

  create(records = []) {
    this.jobs = this.jobs.concat(records);
  }
}

module.exports = JobsStore;
