
global.assert = require('assert');
global.bluebird = require('bluebird');
global.bunyan = require('bunyan');
global.fs = require('fs');
global.http = require('http');
global.lodash = require('lodash');
global.redisLib = require('redis');

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
var App = require('./src/App').default;
//logger.debug('App', typeof App, Object.keys(App));
global.app = new App();
global.app.start().then(function() {
   logger.info('started');
}).catch(function(err) {
   logger.error(err);
   setTimeout(function() {
      global.app.end();
   }, 1000);
});
