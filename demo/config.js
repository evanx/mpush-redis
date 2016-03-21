
module.exports = {
   redis: 'redis://localhost:6379',
   redisNamespace: 'demo:mpush',
   popTimeout: 60,
   messageExpire: 30,
   messageTimeout: 10,
   messageCapacity: 1000,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   done: 'demo:mpush:done',
   out: ['demo:mpush:out1', 'demo:mpush:out2']
};
