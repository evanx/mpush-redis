
// ES5 so can be used before Babel is registered

var that = {
   defaultProps: {},
   validateProps: function(p) {
      Asserts.assertIntegerMax(p.serviceRenew, 'serviceRenew', p.serviceExpire - 5);
   },
   start: function(props) {
      Object.keys(props).forEach(function(key) {
         props[key].key = key;
         var defaultValue = props[key].defaultValue;
         if (defaultValue) {
            that.defaultProps[key] = defaultValue;
         }
      });
      console.log('defaultProps', that.defaultProps);
      that.validateProps(that.defaultProps);
      that.props = props;
   },
   validate(name, value) {
      var meta = that.props[name];
      if (meta) {
         if (value === undefined) {
            if (!meta.optional) {
               throw new Error(`missing ${name}`);
            }
         }
         if (meta.min) {
            if (value >= meta.min) {
            } else {
               throw new Error(`${name} (${value}) min ${meta.min}`);
            }
         }
         if (meta.max) {
            if (value > meta.max) {
               throw new Error(`${name} (${value}) max ${meta.max}`);
            }
         }
      }
      return value;
   },
   validateInteger(name, value) {
      return that.validate(name, value);
   },
   validateIntegerMin(name, value, min) {
      that.validate(name, value);
      if (value >= min) {
      } else {
         throw new Error(`${name} (${value}) min ${min}`);
      }
      return value;
   }
};

module.exports = that;
