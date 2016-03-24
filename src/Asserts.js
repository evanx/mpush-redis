
import assert from 'assert';

export default class Asserts {

   static assertString(value, name) {
      assert(value, name);
      assert(typeof value === 'string', name);
   }

   static assertInt(value, name) {
      assert(value, name);
      assert(Number.isInteger(value), name);
   }

   static assertIntMin(value, name, min) {
      assert(value, name);
      assert(Number.isInteger(value), name);
      assert(value >= min, name);
   }

   static assertStringArray(value, name) {
      Asserts.assertArray(value, name);
      value.forEach(item => {
         Asserts.assertString(item, name);
      });
   }

   static assertArray(value, name) {
      assert(value, name);
      assert(lodash.isArray(value), 'not array: ' + name);
      assert(!lodash.isEmpty(value), 'empty: ' + name);
   }
}
