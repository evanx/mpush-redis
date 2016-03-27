
// ES5 so can be used before Babel is registered

var that = {
   defaultProps: {},
   validateProps: function(p) {
      Asserts.assertIntMax(p.serviceRenew, 'serviceRenew', p.serviceExpire - 5);
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
   }
};

module.exports = that;
