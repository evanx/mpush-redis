
global.assert = require('assert');
global.bluebird = require('bluebird');
global.bunyan = require('bunyan');
global.fs = require('fs');
global.http = require('http');
global.lodash = require('lodash');
global.redisLib = require('redis');

bluebird.promisifyAll(redisLib.RedisClient.prototype);
bluebird.promisifyAll(redisLib.Multi.prototype);
redisLib.RedisClient.prototype.multiExecAsync = function(fn) {
   var multi = this.multi();
   fn(multi);
   return multi.execAsync();
};

global.loggerLevel = 'info';
if (process.env.loggerLevel) {
   global.loggerLevel = process.env.loggerLevel;
} else if (process.env.NODE_ENV === 'development') {
   global.loggerLevel = 'debug';
}
var logger = global.bunyan.createLogger({name: 'entry', level: 'debug'});
require("babel-polyfill");
require('babel-core/register');
//logger.debug('babel');
global.Loggers = require('./src/Loggers');
global.Asserts = require('./src/Asserts');
var Service = require('./src/Service').default;
//logger.debug('App', typeof App, Object.keys(App));
global.service = new Service();
global.service.start().then(function() {
   logger.info('started');
   process.on('SIGTERM', function() {
      global.service.end();
   });
}).catch(function(err) {
   logger.error(err);
   setTimeout(function() {
      global.service.end();
   }, 1000);
});
