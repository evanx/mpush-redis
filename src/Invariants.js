
var props = {
   serviceExpire: {
      defaultValue: 60,
      min: 30,
   },
   serviceRenew: {
      defaultValue: 15,
      min: 5
   },
   serviceCapacity: {
      defaultValue: 10
   },
   messageExpire: {
      defaultValue: 60
   },
   messageTimeout: {
      defaultValue: 10
   },
   messageCapacity: {
      defaultValue: 1000
   },
   popTimeout: {
      max: 30
   }
};

var that = {
   defaultProps: {},
   props: props,
   validateProps: function(p) {
      Asserts.assertIntMax(p.serviceRenew, 'serviceRenew', p.serviceExpire - 5);
   },
   start: function() {
      initProps();
   }
};

function initProps() {
   Object.keys(props).forEach(function(key) {
      props[key].key = key;
      var defaultValue = props[key].defaultValue;
      if (defaultValue) {
         that.defaultProps[key] = defaultValue;
      }
   });
   console.log('defaultProps', that.defaultProps);
   that.validateProps(that.defaultProps);
}

module.exports = that;
