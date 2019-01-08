const EventEmitter = require('events');
const uuid4 = require('uuid/v4');

const ALLOWED_FIELDS = {
  created: new Date(0).toISOString(),
  updated: new Date().toISOString(),
  title: '',
  tags: [],
  preamble: '',
  content: '',
  src: '',
  authors: [],
};
Object.freeze(ALLOWED_FIELDS);

class NotesStore extends EventEmitter {
  constructor() {
    super();
    this.notes = {};
    this.validatorReference = Object.preventExtensions(
      Object.assign({}, ALLOWED_FIELDS),
    );
  }

  read() {
    const records = Object.values(this.notes);
    return records;
  }

  create(records = []) {
    const keys = [];
    [].concat(records).forEach(record => {
      if (!record.src) {
        this.emit('error', 'Missing src field');
        return;
      }

      const key = record.key || uuid4();
      this.notes[key] = Object.entries(ALLOWED_FIELDS).reduce(
        (accumulator, [fieldName, defaultValue]) => {
          accumulator[fieldName] = record[fieldName] || defaultValue;
          return accumulator;
        },
        { key },
      );
      keys.push(key);
    });
    return Array.isArray(records) ? keys : keys[0];
  }
}

module.exports = NotesStore;
