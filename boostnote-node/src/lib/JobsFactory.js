const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const matchUrl = require('match-url-wildcard');

class JobsFactory extends EventEmitter {
  constructor({ routesPath = path.join(__dirname, 'routes') } = {}) {
    super();
    this.rules = fs
      .readdirSync(routesPath)
      .map(filePath => require(path.join(routesPath, filePath), 'utf8'));
  }

  generateJobs({ src }) {
    if (!src) return [];

    let i = this.rules.length;
    let matchedRoute;
    while (i-- && !matchedRoute) {
      const rule = this.rules[i];
      const routes = rule.routes;
      if (!routes) continue;

      if (routes === '*') {
        matchedRoute = i;
        return rule.jobs;
      }

      if (matchUrl(src, routes)) {
        matchedRoute = i;
        return rule.jobs;
      }
    }

    return [];
  }
}

module.exports = JobsFactory;
