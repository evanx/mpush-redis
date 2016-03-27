
var props = {
   serviceExpire: {
      type: 'integer',
      defaultValue: 60,
      min: 30,
   },
   serviceRenew: {
      defaultValue: 15,
      min: 5
   },
   popTimeout: {
      max: 30
   },
   serviceCapacity: {
      min: 1,
      defaultValue: 10
   }
}

var that = {
   defaultProps: {},
   props: props,
   validateProps: function(p) {
      Asserts.assertIntMax(p.serviceRenew, p.serviceExpire - 5);
   }
};

function initProps() {
   Object.keys(props).forEach(function(key) {
      var defaultValue = props[key].defaultValue;
      if (defaultValue) {
         that.defaultProps[key] = defaultValue;
      }
   });
}

initProps();
console.log('defaultProps', that.defaultProps);
that.validateProps(that.defaultProps);
