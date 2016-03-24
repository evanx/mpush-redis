
module.exports = {
   redis: 'redis://localhost:6379/0',
   redisNamespace: 'demo:mpush',
   popTimeout: 60,
   messageExpire: 30,
   messageTimeout: 10,
   messageCapacity: 1000,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   done: 'demo:mpush:done',
   out: ['demo:mpush:out0', 'redis://localhost:6379/1/demo:mpush:out1']
};
