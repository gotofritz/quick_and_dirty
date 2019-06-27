module.exports = class CaseInsensitiveSet extends Set {
  constructor(values) {
    super(Array.from(values, x => x.toLowerCase()));
  }

  has(prop) {
    prop = prop.toLowerCase();
    return super.has(prop);
  }
};
