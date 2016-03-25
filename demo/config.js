
module.exports = {
   redis: 'redis://localhost:6379/0',
   redisNamespace: 'demo:mpush',
   popTimeout: 60,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   out: ['demo:mpush:out0', 'demo:mpush:out1']
};
