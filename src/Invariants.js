
module.exports = {
   defaultProps: {
   },
   props: {
      serviceExpire: {
         type: 'integer',
         defaultValue: 60,
         min: 30,
         renew: 15 // must be less than min
      },
      popTimeout: {
         max: 30
      },
      serviceCapacity: {
         min: 1,
         defaultValue: 10
      }
   }
};

Object.keys(module.exports.props).forEach(function(key) {
   var defaultValue = module.exports.props[key].defaultValue;
   if (defaultValue) {
      module.exports.defaultProps[key] = defaultValue;
   }
});

console.log('defaultProps', module.exports.defaultProps);

function assertProps(props) {
   assert(props.serviceExpire.renew < props.serviceExpire.min - 5);
}

assertProps(module.exports.props);
