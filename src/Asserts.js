
import assert from 'assert';

module.exports = {
   assertString(value, name) {
      assert(value, name);
      assert(typeof value === 'string', name);
      return value;
   },
   assertString(value, name) {
      assert(value, name);
      assert(typeof value === 'string', name);
      return value;
   },
   assertInt(value, name) {
      assert(value, name);
      assert(Number.isInteger(value), name);
      return value;
   },
   assertIntMin(value, name, min) {
      assert(value, name);
      assert(Number.isInteger(value), name);
      assert(value >= min, name);
      return value;
   },
   assertStringArray(value, name) {
      Asserts.assertArray(value, name);
      value.forEach(item => {
         Asserts.assertString(item, name);
      });
      return value;
   },
   assertArray(value, name) {
      assert(value, name);
      assert(lodash.isArray(value), 'not array: ' + name);
      assert(!lodash.isEmpty(value), 'empty: ' + name);
      return value;
   }
};
