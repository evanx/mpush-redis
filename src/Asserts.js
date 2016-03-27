
import assert from 'assert';

function format(type, options) {
   return type + ': ' + options.toString();
}

module.exports = {
   assert(value, name) {
      assert(value, name);
      return value;
   },
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
   assertIntMax(value, name, max) {
      if (!max) {
         min = Invariants.props[name].max;
      }
      assert(value, {name, value});
      assert(Number.isInteger(value), format('integer', {name, value}));
      assert(value <= max, format('max', {name, value, max}));
      return value;
   },
   assertIntMin(value, name, min) {
      if (!min) {
         min = Invariants.props[name].min;
      }
      assert(value, {name, value});
      assert(Number.isInteger(value), format('integer', {name, value}));
      assert(value >= min, format('min', {name, value, min}));
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
